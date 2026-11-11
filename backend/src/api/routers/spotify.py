import asyncio
import logging
import time
from typing import Any
 
import httpx
from fastapi import APIRouter, Response
from pydantic import BaseModel
 
from api.config import settings
from api.models import NowPlaying
 
log = logging.getLogger(__name__)
 
TOKEN_URL = "https://accounts.spotify.com/api/token"
API_URL = "https://api.spotify.com/v1"
CACHE_SECONDS = 20
TOKEN_MARGIN_SECONDS = 60 
ARTIST_CACHE_SIZE = 500  # artist photos remembered, so each artist is looked up once
 
 
def pick_image(images: list[dict[str, Any]] | None) -> str | None:
    """Spotify lists images largest first; the middle one (about 300px) is plenty for a small card."""
    if not images:
        return None
    return (images[1] if len(images) > 1 else images[0]).get("url")
 
 
def to_now_playing(
    item: dict[str, Any] | None, *, playing: bool, played_at: str | None = None
) -> NowPlaying:
    """Pick out only the fields the site needs from a Spotify track or episode."""
    if not item:
        return NowPlaying(playing=False)
 
    artist_image = None
    if item.get("type") == "episode":
        show = item.get("show") or {}
        artist = show.get("name")
        artist_image = pick_image(show.get("images"))
        artist_url = (show.get("external_urls") or {}).get("spotify")
        images = item.get("images") or show.get("images") or []
    else:
        artists = item.get("artists") or []
        names = [a.get("name") for a in artists if a.get("name")]
        artist = ", ".join(names) or None
        # The photo isn't in the track data; SpotifyClient looks it up afterwards
        artist_url = (artists[0].get("external_urls") or {}).get("spotify") if artists else None
        images = (item.get("album") or {}).get("images") or []
 
    return NowPlaying(
        playing=playing,
        title=item.get("name"),
        artist=artist,
        artist_image=artist_image,
        artist_url=artist_url,
        album_art=images[0].get("url") if images else None,
        url=(item.get("external_urls") or {}).get("spotify"),
        played_at=played_at,
    )
 
 
class SpotifyClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        http: httpx.AsyncClient | None = None,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.http = http or httpx.AsyncClient(timeout=5)
 
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = asyncio.Lock()
 
        self._artist_images: dict[str, str | None] = {}
 
        self._cached: NowPlaying | None = None
        self._cached_at = 0.0
        self._cache_lock = asyncio.Lock()
 
    async def aclose(self) -> None:
        await self.http.aclose()
 
    async def access_token(self, force_refresh: bool = False) -> str:
        async with self._token_lock:
            if (
                not force_refresh
                and self._token
                and time.monotonic() < self._token_expires_at - TOKEN_MARGIN_SECONDS
            ):
                return self._token
 
            response = await self.http.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                },
                auth=(self.client_id, self.client_secret),
            )
            response.raise_for_status()
            data = response.json()
 
            self._token = data["access_token"]
            self._token_expires_at = time.monotonic() + data.get("expires_in", 3600)
            if data.get("refresh_token"):
                self.refresh_token = data["refresh_token"]
            return self._token
 
    async def _get(
        self, path: str, params: dict[str, Any] | None = None
    ) -> httpx.Response:
        """GET from Spotify, getting a fresh token once if the old one is rejected."""
        token = await self.access_token()
        response = await self.http.get(
            f"{API_URL}{path}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            token = await self.access_token(force_refresh=True)
            response = await self.http.get(
                f"{API_URL}{path}",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
        response.raise_for_status()
        return response
 
    async def _add_artist_image(
        self, result: NowPlaying, item: dict[str, Any] | None
    ) -> NowPlaying:
        """Fill in the first artist's photo. Remembered per artist, and skipped quietly if Spotify fails."""
        artists = (item or {}).get("artists") or []
        artist_id = artists[0].get("id") if artists else None
        if result.artist_image or not artist_id:
            return result
        if artist_id not in self._artist_images:
            try:
                response = await self._get(f"/artists/{artist_id}")
                image = pick_image(response.json().get("images"))
            except (httpx.HTTPError, ValueError) as error:
                log.warning("Spotify artist lookup failed: %r", error)
                return result  # not remembered, so it's tried again next time
            if len(self._artist_images) >= ARTIST_CACHE_SIZE:
                self._artist_images.clear()
            self._artist_images[artist_id] = image
        result.artist_image = self._artist_images[artist_id]
        return result
 
    async def _fetch_now_playing(self) -> NowPlaying:
        response = await self._get(
            "/me/player/currently-playing", params={"additional_types": "track,episode"}
        )
        if response.status_code == 200 and response.content:
            data = response.json()
            if data.get("item"):
                result = to_now_playing(
                    data["item"], playing=bool(data.get("is_playing"))
                )
                return await self._add_artist_image(result, data["item"])
 
        response = await self._get("/me/player/recently-played", params={"limit": 1})
        items = response.json().get("items") or []
        if not items:
            return NowPlaying(playing=False)
        track = items[0].get("track")
        result = to_now_playing(track, playing=False, played_at=items[0].get("played_at"))
        return await self._add_artist_image(result, track)
 
    async def now_playing(self) -> NowPlaying:
        async with self._cache_lock:
            if self._cached and time.monotonic() - self._cached_at < CACHE_SECONDS:
                return self._cached
 
            if not self.refresh_token:
                log.warning("SPOTIFY_REFRESH_TOKEN is not set")
                result = NowPlaying(playing=False)
            else:
                try:
                    result = await self._fetch_now_playing()
                except (httpx.HTTPError, ValueError, KeyError) as error:
                    log.warning("Spotify request failed: %r", error)
                    result = NowPlaying(playing=False)
 
            self._cached = result
            self._cached_at = time.monotonic()
            return result
 
 
spotify = SpotifyClient(
    settings.spotify_client_id,
    settings.spotify_client_secret,
    settings.spotify_refresh_token,
)
 
router = APIRouter(prefix="/spotify", tags=["spotify"])
 
 
@router.get("/now-playing", response_model=NowPlaying)
async def now_playing(response: Response) -> NowPlaying:
    response.headers["Cache-Control"] = "public, max-age=15"
    return await spotify.now_playing()