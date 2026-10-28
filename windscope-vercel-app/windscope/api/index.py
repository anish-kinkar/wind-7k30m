"""WindScope: January 2026 historical wind forecast analysis, sourced from Elexon BMRS."""
from __future__ import annotations

import asyncio
import math
from datetime import date, datetime, timedelta, timezone
from statistics import mean

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
UTC = timezone.utc
app = FastAPI(title="WindScope API", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp lacks timezone")
    return parsed.astimezone(UTC)


def valid_day(value: str) -> date:
    try:
        result = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, "Date must be YYYY-MM-DD")
    if result.year != 2026 or result.month != 1:
        raise HTTPException(422, "Decision date must be in January 2026")
    return result


def normalize(rows: list[dict], actual: bool) -> list[dict]:
    output = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if actual and str(row.get("fuelType", "")).upper() != "WIND":
            continue
        if any(row.get(key) is None for key in ("startTime", "generation")):
            continue
        if not actual and not row.get("publishTime"):
            continue
        try:
            value = float(row["generation"])
            if not math.isfinite(value):
                continue
            item = {"startTime": iso(parse_dt(row["startTime"])), "generation": value}
            if not actual:
                item["publishTime"] = iso(parse_dt(row["publishTime"]))
            output.append(item)
        except (ValueError, TypeError, OverflowError):
            continue
    return output


def select_forecasts(rows: list[dict], cutoff: datetime, start: datetime, end: datetime) -> dict[str, dict]:
    selected = {}
    for row in rows:
        target = parse_dt(row["startTime"])
        published = parse_dt(row["publishTime"])
        if start <= target < end and published <= cutoff:
            old = selected.get(row["startTime"])
            if old is None or parse_dt(old["publishTime"]) < published:
                selected[row["startTime"]] = row
    return selected


def calculate(pairs: list[dict]) -> dict:
    errors = [p["forecast"] - p["actual"] for p in pairs]
    return {
        "count": len(errors),
        "mae": round(mean(abs(e) for e in errors), 1) if errors else None,
        "rmse": round(math.sqrt(mean(e * e for e in errors)), 1) if errors else None,
        "bias": round(mean(errors), 1) if errors else None,
    }


async def fetch_dataset(client: httpx.AsyncClient, name: str, start: datetime, end: datetime) -> list[dict]:
    """Use the dataset-specific date filters, never generic from/to on these streams."""
    if name == "FUELHH":
        params = {
            "settlementDateFrom": start.date().isoformat(),
            "settlementDateTo": end.date().isoformat(),
        }
    elif name == "WINDFOR":
        params = {
            "publishDateTimeFrom": iso(start),
            "publishDateTimeTo": iso(end),
