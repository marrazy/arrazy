import httpx
import pytest
import respx
 
from api.routers.spotify import API_URL, TOKEN_URL, SpotifyClient
 
TRACK = {
    "type": "track",
    "name": "Song A",
    "artists": [{"name": "Artist 1"}, {"name": "Artist 2"}],
    "album": {
        "images": [{"url": "https://img/big.jpg"}, {"url": "https://img/small.jpg"}]
    },
    "external_urls": {"spotify": "https://open.spotify.com/track/a"},
}
 
 
@pytest.fixture
def client():
    return SpotifyClient("id", "secret", "refresh", http=httpx.AsyncClient())
 
 
def mock_token(mock):
    return mock.post(TOKEN_URL).respond(
        200, json={"access_token": "token-1", "expires_in": 3600}
    )
 
 
async def test_currently_playing(client):
    with respx.mock as mock:
        mock_token(mock)
        mock.get(f"{API_URL}/me/player/currently-playing").respond(
            200, json={"is_playing": True, "item": TRACK}
        )
        result = await client.now_playing()
 
    assert result.playing is True
    assert result.title == "Song A"
    assert result.artist == "Artist 1, Artist 2"
    assert result.album_art == "https://img/big.jpg"
    assert result.url == "https://open.spotify.com/track/a"
 
 
async def test_nothing_playing_falls_back_to_recently_played(client):
    with respx.mock as mock:
        mock_token(mock)
        mock.get(f"{API_URL}/me/player/currently-playing").respond(204)
        mock.get(f"{API_URL}/me/player/recently-played").respond(
            200, json={"items": [{"track": TRACK, "played_at": "2026-11-07T10:00:00Z"}]}
        )
        result = await client.now_playing()
 
    assert result.playing is False
    assert result.title == "Song A"
    assert result.played_at == "2026-11-07T10:00:00Z"
 
 
async def test_spotify_error_returns_not_playing(client):
    with respx.mock as mock:
        mock_token(mock)
        mock.get(f"{API_URL}/me/player/currently-playing").respond(500)
        result = await client.now_playing()
 
    assert result.playing is False
    assert result.title is None
 
 
async def test_answer_is_cached(client):
    with respx.mock as mock:
        token_route = mock_token(mock)
        playing_route = mock.get(f"{API_URL}/me/player/currently-playing").respond(
            200, json={"is_playing": True, "item": TRACK}
        )
        await client.now_playing()
        await client.now_playing()
 
    assert playing_route.call_count == 1
    assert token_route.call_count == 1
 
 
async def test_expired_token_is_refreshed_once(client):
    with respx.mock as mock:
        token_route = mock_token(mock)
        mock.get(f"{API_URL}/me/player/currently-playing").mock(
            side_effect=[
                httpx.Response(401),
                httpx.Response(200, json={"is_playing": True, "item": TRACK}),
            ]
        )
        result = await client.now_playing()
 
    assert result.playing is True
    assert token_route.call_count == 2
 
 
async def test_missing_refresh_token_returns_not_playing():
    client = SpotifyClient("id", "secret", "", http=httpx.AsyncClient())
    with respx.mock(assert_all_called=False):
        result = await client.now_playing()
    assert result.playing is False
 
 
def test_route_is_under_v1():
    from fastapi.testclient import TestClient
 
    from api.app import app
 
    assert "/v1/spotify/now-playing" in app.openapi()["paths"]
    with TestClient(app) as test_client:
        assert test_client.get("/health").json() == {"ok": True}