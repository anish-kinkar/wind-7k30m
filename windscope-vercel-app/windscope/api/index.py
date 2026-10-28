
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
        }
    else:
        raise ValueError(f"Unsupported dataset: {name}")

    response = await client.get(
        f"{BASE}/{name}/stream", params=params, headers={"Accept": "application/json"}
    )
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = next((payload[k] for k in ("data", "results", "items") if isinstance(payload.get(k), list)), None)
        if rows is None:
            raise ValueError(f"Unexpected {name} response object")
    else:
        raise ValueError(f"Unexpected {name} response type")

    # Fail visibly if the API silently ignores our historical date filters.
    if rows:
        date_field = "startTime" if name == "FUELHH" else "publishTime"
        checked = [parse_dt(r[date_field]) for r in rows if isinstance(r, dict) and r.get(date_field)]
        if not checked:
            raise ValueError(f"{name} response has no {date_field} timestamps")
        if name == "FUELHH":
            lower, upper = start.date(), end.date()
            if any(not (lower <= t.date() <= upper) for t in checked):
                raise ValueError(f"{name} ignored settlement date filters")
        elif any(not (start <= t <= end) for t in checked):
            raise ValueError(f"{name} ignored publication date filters")
    return rows


@app.get("/api/health")
def health():
    return {"status": "ok", "source": "Elexon BMRS", "mode": "live"}


@app.get("/api/metadata")
def metadata():
    return {
        "source": "Elexon BMRS",
        "actualDataset": "FUELHH",
        "forecastDataset": "WINDFOR",
        "period": "January 2026 decisions",
        "timezone": "Europe/London",
        "decisionCutoff": "12:00 UTC (configurable scenario assumption, NOT an official market deadline)",
        "dataMode": "live",
    }


@app.get("/api/analysis")
async def analysis(day: str = Query("2026-01-15"), cutoff_hour: int = Query(12, ge=0, le=23)):
    decision_day = valid_day(day)
    cutoff = datetime(decision_day.year, decision_day.month, decision_day.day, cutoff_hour, tzinfo=UTC)
    delivery_start = datetime(decision_day.year, decision_day.month, decision_day.day, tzinfo=UTC) + timedelta(days=1)
    delivery_end = delivery_start + timedelta(days=1)

    # Fetch all forecast publications in the 7 days preceding the decision.
    # Two-day chunks reduce request count without assuming all vintages are daily.
    forecast_start = cutoff - timedelta(days=7)
    forecast_windows = []
    cursor = forecast_start
    while cursor < cutoff:
        nxt = min(cursor + timedelta(days=2), cutoff)
        forecast_windows.append((cursor, nxt))
        cursor = nxt

    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            forecasts_task = asyncio.gather(*(
                fetch_dataset(client, "WINDFOR", s, e) for s, e in forecast_windows
            ))
            actuals_task = fetch_dataset(client, "FUELHH", delivery_start, delivery_start)
            forecast_chunks, actual_rows_raw = await asyncio.gather(forecasts_task, actuals_task)
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, detail=f"Elexon retrieval failed: {str(exc)[:300]}")

    forecast_rows = normalize([row for chunk in forecast_chunks for row in chunk], actual=False)
    actual_rows = normalize(actual_rows_raw, actual=True)
    selected = select_forecasts(forecast_rows, cutoff, delivery_start, delivery_end)
    actual_by_time = {
        row["startTime"]: row["generation"]
        for row in actual_rows
        if delivery_start <= parse_dt(row["startTime"]) < delivery_end
    }

    points = []
    for i in range(48):
        target = iso(delivery_start + timedelta(minutes=30 * i))
        forecast = selected.get(target)
        actual = actual_by_time.get(target)
        fval = forecast["generation"] if forecast else None
        points.append({
            "time": target,
            "forecast": fval,
            "actual": actual,
            "publishTime": forecast["publishTime"] if forecast else None,
            "error": round(fval - actual, 2) if fval is not None and actual is not None else None,
            "leadHours": round((parse_dt(target) - parse_dt(forecast["publishTime"])).total_seconds() / 3600, 1) if forecast else None,
        })

    pairs = [p for p in points if p["forecast"] is not None and p["actual"] is not None]
    return {
        "decisionDate": day,
        "cutoff": iso(cutoff),
        "deliveryDate": delivery_start.date().isoformat(),
        "points": points,
        "metrics": calculate(pairs),
        "coverage": {
            "forecast": sum(p["forecast"] is not None for p in points),
            "actual": sum(p["actual"] is not None for p in points),
            "matched": len(pairs),
            "expected": 48,
        },
        "source": "Elexon FUELHH + WINDFOR",
        "method": "Latest eligible forecast published at or before decision cutoff; cutoff is a scenario assumption, not a market deadline.",
    }
