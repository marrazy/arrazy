import asyncio
import logging
import time
from datetime import UTC, datetime, timedelta, timezone
from typing import Any
 
import httpx
from fastapi import APIRouter, Response
from pydantic import BaseModel
 
log = logging.getLogger(__name__)
 
API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
JAKARTA = {"latitude": -6.2088, "longitude": 106.8456, "timezone": "Asia/Jakarta"}
HISTORY_HOURS = 24
CACHE_SECONDS = 600  # 10 minutes
ERROR_CACHE_SECONDS = 60
SOURCE = "Open-Meteo (CAMS)"
 
# US EPA AQI bands: (highest value in the band, name)
CATEGORIES = [
    (50, "Good"),
    (100, "Moderate"),
    (150, "Unhealthy for sensitive groups"),
    (200, "Unhealthy"),
    (300, "Very unhealthy"),
]
 
 
class AqiPoint(BaseModel):
    time: str  # local Jakarta time, e.g. "2026-11-08T21:00"
    aqi: int | None
 
 
class AqiReading(BaseModel):
    available: bool
    aqi: int | None = None
    category: str | None = None
    pm2_5: float | None = None  # μg/m³
    observed_at: str | None = None  # hour the value is for, with Jakarta's UTC offset
    fetched_at: str | None = None  # when this server last asked Open-Meteo (UTC)
    history: list[AqiPoint] = []  # oldest first, up to the current hour
    source: str = SOURCE
 
 
def category_for(aqi: int | None) -> str | None:
    if aqi is None:
        return None
    for upper, name in CATEGORIES:
        if aqi <= upper:
            return name
    return "Hazardous"
 
 
def _to_int(value: Any) -> int | None:
    return None if value is None else round(value)
 
 
def parse_reading(data: dict[str, Any], fetched_at: datetime) -> AqiReading:
    """Turn Open-Meteo's reply into the small shape the site needs."""
    current = data["current"]
    now_local = current["time"]  # "YYYY-MM-DDTHH:MM", Jakarta time
    aqi = _to_int(current.get("us_aqi"))
 
    # Hourly data covers yesterday, today and some forecast hours.
    # Keep only hours up to now, then the last 24 of them.
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    values = hourly.get("us_aqi") or []
    past = [
        AqiPoint(time=t, aqi=_to_int(v))
        for t, v in zip(times, values)
        if t <= now_local  # same fixed format, so text order is time order
    ]
 
    offset = timezone(timedelta(seconds=data.get("utc_offset_seconds", 0)))
    observed = datetime.fromisoformat(now_local).replace(tzinfo=offset)
 
    return AqiReading(
        available=aqi is not None,
        aqi=aqi,
        category=category_for(aqi),
        pm2_5=current.get("pm2_5"),
        observed_at=observed.isoformat(),
        fetched_at=fetched_at.isoformat(timespec="seconds"),
        history=past[-HISTORY_HOURS:],
    )
 
 
class AqiClient:
    def __init__(self, http: httpx.AsyncClient | None = None):
        self.http = http or httpx.AsyncClient(timeout=5)
        self._cached: AqiReading | None = None
        self._cached_at = 0.0
        self._lock = asyncio.Lock()
 
    async def aclose(self) -> None:
        await self.http.aclose()
 
    async def _fetch(self) -> AqiReading:
        response = await self.http.get(
            API_URL,
            params={
                **JAKARTA,
                "current": "us_aqi,pm2_5",
                "hourly": "us_aqi",
                "past_days": 1,
                "forecast_days": 1,
            },
        )
        response.raise_for_status()
        return parse_reading(response.json(), datetime.now(UTC))
 
    async def jakarta(self) -> AqiReading:
        # The lock stops many visitors from calling Open-Meteo at the same moment
        async with self._lock:
            if self._cached:
                max_age = (
                    CACHE_SECONDS if self._cached.available else ERROR_CACHE_SECONDS
                )
                if time.monotonic() - self._cached_at < max_age:
                    return self._cached
 
            try:
                result = await self._fetch()
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
                # Covers timeouts, Open-Meteo errors and unexpected replies
                log.warning("Air quality request failed: %r", error)
                result = AqiReading(available=False)
 
            self._cached = result
            self._cached_at = time.monotonic()
            return result
 
 
aqi_client = AqiClient()
 
router = APIRouter(prefix="/aqi", tags=["aqi"])
 
 
@router.get("/jakarta", response_model=AqiReading)
async def jakarta_aqi(response: Response) -> AqiReading:
    # Let browsers reuse the answer for 5 minutes
    response.headers["Cache-Control"] = "public, max-age=300"
    return await aqi_client.jakarta()