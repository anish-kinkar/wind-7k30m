"""WindScope API. Historical Elexon data is fetched on demand; no sample data is passed off as real."""
from __future__ import annotations
import asyncio
from datetime import datetime, timedelta, timezone, date
from statistics import mean
from math import sqrt
from functools import lru_cache
from typing import Any
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE = 'https://data.elexon.co.uk/bmrs/api/v1/datasets'
app = FastAPI(title='WindScope API', version='1.0.0')
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_methods=['GET'],allow_headers=['*'])

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00','Z')

def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(timezone.utc)

def valid_day(value: str) -> date:
    try: d=date.fromisoformat(value)
    except ValueError: raise HTTPException(422,'Date must be YYYY-MM-DD')
    if d.year!=2026 or d.month!=1: raise HTTPException(422,'Decision date must be in January 2026')
    return d

def normalize(rows: list[dict], actual: bool) -> list[dict]:
    out=[]
    for row in rows:
        if actual and str(row.get('fuelType','')).upper()!='WIND': continue
        if not all(k in row for k in ('startTime','generation')): continue
        if not actual and 'publishTime' not in row: continue
        try:
            item={'startTime':iso(parse_dt(row['startTime'])),'generation':float(row['generation'])}
            if not actual: item['publishTime']=iso(parse_dt(row['publishTime']))
            out.append(item)
        except (TypeError,ValueError,OverflowError): continue
    return out

def select_forecasts(rows: list[dict], cutoff: datetime, start: datetime, end: datetime) -> dict[str,dict]:
    """Choose latest publication <= historical cutoff per target interval."""
    selected={}
    for r in rows:
        target=parse_dt(r['startTime']); pub=parse_dt(r['publishTime'])
        if start<=target<end and pub<=cutoff:
            old=selected.get(r['startTime'])
            if old is None or parse_dt(old['publishTime'])<pub: selected[r['startTime']]=r
    return selected

def calculate(pairs: list[dict]) -> dict:
    errors=[p['forecast']-p['actual'] for p in pairs if p.get('forecast') is not None and p.get('actual') is not None]
    return {'count':len(errors),'mae':round(mean(abs(e) for e in errors),1) if errors else None,'rmse':round(sqrt(mean(e*e for e in errors)),1) if errors else None,'bias':round(mean(errors),1) if errors else None}

async def fetch_dataset(client:httpx.AsyncClient, name:str, start:datetime, end:datetime) -> list[dict]:
    # Elexon stream endpoint commonly accepts from/to; verify against live docs if API changes.
    url=f'{BASE}/{name}/stream'
    response=await client.get(url,params={'from':iso(start),'to':iso(end)},headers={'Accept':'application/json'})
    response.raise_for_status()
    data=response.json()
    if isinstance(data,list): return data
    if isinstance(data,dict):
        for key in ('data','results','items'):
            if isinstance(data.get(key),list): return data[key]
    raise ValueError(f'Unexpected {name} API response structure')

@app.get('/api/health')
def health(): return {'status':'ok','source':'Elexon BMRS','mode':'live'}

@app.get('/api/metadata')
def metadata(): return {'source':'Elexon BMRS','actualDataset':'FUELHH','forecastDataset':'WINDFOR','period':'January 2026 decisions','timezone':'Europe/London','decisionCutoff':'12:00 UTC (configurable scenario assumption, NOT an official market deadline)','dataMode':'live'}

@app.get('/api/analysis')
async def analysis(day:str=Query('2026-01-15'),cutoff_hour:int=Query(12,ge=0,le=23)):
    d=valid_day(day)
    # A Jan decision concerns the following UTC delivery day, including Feb 1 for Jan 31.
    cutoff=datetime(d.year,d.month,d.day,cutoff_hour,tzinfo=timezone.utc)
    delivery_start=datetime(d.year,d.month,d.day,tzinfo=timezone.utc)+timedelta(days=1)
    delivery_end=delivery_start+timedelta(days=1)
    # Pull forecasts across the preceding week so historical publication vintages are available.
    # Querying WINDFOR by publication date (from/to), then selecting delivery startTime in memory.
    forecast_start=cutoff-timedelta(days=7)
    actual_end=delivery_end
    try:
        async with httpx.AsyncClient(timeout=28.0,follow_redirects=True) as client:
            # Keep requests chunked to reduce size and respect common API window limits.
            windows=[]; cursor=forecast_start
            while cursor<cutoff:
                nxt=min(cursor+timedelta(days=1),cutoff)
                windows.append(fetch_dataset(client,'WINDFOR',cursor,nxt));cursor=nxt
            forecast_chunks=await asyncio.gather(*windows)
            # If WINDFOR filters by delivery time instead of publication time,
            # try the delivery window as well. Preserve all returned vintages.
            forecast_chunks.append(await fetch_dataset(client,'WINDFOR',delivery_start,delivery_end))
            actual_rows=await fetch_dataset(client,'FUELHH',delivery_start,actual_end)
    except (httpx.HTTPError,ValueError) as exc:
        raise HTTPException(502,detail=f'Elexon data unavailable or returned an unexpected response: {str(exc)[:260]}')
    forecast_rows=normalize([r for chunk in forecast_chunks for r in chunk],False)
    actual_rows=normalize(actual_rows,True)
    selected=select_forecasts(forecast_rows,cutoff,delivery_start,delivery_end)
    actual_by_time={r['startTime']:r['generation'] for r in actual_rows if delivery_start<=parse_dt(r['startTime'])<delivery_end}
    points=[]
    for i in range(48):
        t=iso(delivery_start+timedelta(minutes=30*i))
        f=selected.get(t);a=actual_by_time.get(t)
        points.append({'time':t,'forecast':f['generation'] if f else None,'actual':a,'publishTime':f['publishTime'] if f else None,'error':round(f['generation']-a,2) if f and a is not None else None,'leadHours':round((parse_dt(t)-parse_dt(f['publishTime'])).total_seconds()/3600,1) if f else None})
    pairs=[p for p in points if p['forecast'] is not None and p['actual'] is not None]
    stats=calculate(pairs)
    return {'decisionDate':day,'cutoff':iso(cutoff),'deliveryDate':delivery_start.date().isoformat(),'points':points,'metrics':stats,'coverage':{'forecast':sum(p['forecast'] is not None for p in points),'actual':sum(p['actual'] is not None for p in points),'matched':len(pairs),'expected':48},'source':'Elexon FUELHH + WINDFOR','method':'Latest eligible forecast published at or before decision cutoff; cutoff is a scenario assumption, not a market deadline.'}
@app.get("/api/debug-elexon")
async def debug_elexon():
    async with httpx.AsyncClient(timeout=25) as client:
        output = {}

        for dataset in ["FUELHH", "WINDFOR"]:
            try:
                response = await client.get(
                    f"{BASE}/{dataset}/stream",
                    params={
                        "from": "2026-01-16T00:00:00Z",
                        "to": "2026-01-16T02:00:00Z"
                    }
                )

                data = response.json()

                output[dataset] = {
                    "status": response.status_code,
                    "count": len(data) if isinstance(data, list) else None,
                    "sample": data[:2] if isinstance(data, list) else data
                }

            except Exception as exc:
                output[dataset] = {"error": str(exc)}

        return output
