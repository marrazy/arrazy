"""Tests for the AQI router. Open-Meteo is faked with respx, so no real calls are made."""

import httpx
import pytest
import respx

from api.routers.aqi import API_URL, AqiClient, category_for


def open_meteo_reply(current_aqi=87, now="2026-11-08T21:00"):
    # 30 hours of hourly data ending 3 hours after "now" (forecast hours must be dropped)
    times = [f"2026-11-07T{h:02d}:00" for h in range(18, 24)] + [
        f"2026-11-08T{h:02d}:00" for h in range(24)
    ]
    values = [50 + i for i in range(len(times))]
    values[10] = None  # a missing hour
    return {
        "utc_offset_seconds": 25200,
        "timezone": "Asia/Jakarta",
        "current": {"time": now, "us_aqi": current_aqi, "pm2_5": 28.4},
        "hourly": {"time": times, "us_aqi": values},
    }


@pytest.fixture
def client():
    return AqiClient(http=httpx.AsyncClient())


@pytest.mark.parametrize(
    "aqi, expected",
    [
        (None, None),
        (0, "Good"),
        (50, "Good"),
        (51, "Moderate"),
        (100, "Moderate"),
        (101, "Unhealthy for sensitive groups"),
        (151, "Unhealthy"),
        (201, "Very unhealthy"),
        (301, "Hazardous"),
    ],
)
def test_category_bands(aqi, expected):
    assert category_for(aqi) == expected


async def test_reading_is_parsed(client):
    with respx.mock as mock:
        mock.get(API_URL).respond(200, json=open_meteo_reply())
        result = await client.jakarta()

    assert result.available is True
    assert result.aqi == 87
    assert result.category == "Moderate"
    assert result.pm2_5 == 28.4
    assert result.observed_at == "2026-11-08T21:00:00+07:00"
    assert result.source == "Open-Meteo (CAMS)"
    # Last 24 hours up to and including 21:00, nothing from the forecast hours
    assert len(result.history) == 24
    assert result.history[-1].time == "2026-11-08T21:00"
    assert result.history[0].time == "2026-11-07T22:00"
    assert any(point.aqi is None for point in result.history)


async def test_request_asks_for_jakarta(client):
    with respx.mock as mock:
        route = mock.get(API_URL).respond(200, json=open_meteo_reply())
        await client.jakarta()

    params = route.calls[0].request.url.params
    assert params["latitude"] == "-6.2088"
    assert params["timezone"] == "Asia/Jakarta"
    assert params["current"] == "us_aqi,pm2_5"


async def test_error_returns_unavailable(client):
    with respx.mock as mock:
        mock.get(API_URL).respond(500)
        result = await client.jakarta()

    assert result.available is False
    assert result.aqi is None
    assert result.history == []


async def test_missing_current_value_is_unavailable(client):
    with respx.mock as mock:
        mock.get(API_URL).respond(200, json=open_meteo_reply(current_aqi=None))
        result = await client.jakarta()

    assert result.available is False
    assert result.category is None


async def test_answer_is_cached(client):
    with respx.mock as mock:
        route = mock.get(API_URL).respond(200, json=open_meteo_reply())
        await client.jakarta()
        await client.jakarta()

    assert route.call_count == 1


def test_route_is_under_v1():
    from api.app import app

    assert "/v1/aqi/jakarta" in app.openapi()["paths"]