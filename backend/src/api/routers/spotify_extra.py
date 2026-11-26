"""Extra Spotify routes for the website.

GET /v1/spotify/top-artist   your most played artist over about the last 6 months
GET /v1/spotify/playlist     the albums listed in data/playlist.json, filled in from Spotify
                             at startup and every 12 hours by keep_playlist_fresh()

Both reuse the shared SpotifyClient from routers/spotify.py, so there is only one
token and one HTTP connection. top-artist needs the "user-top-read" scope on your
refresh token.
"""

import asyncio
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from api.routers.spotify import pick_image, spotify

log = logging.getLogger(__name__)

router = APIRouter(prefix="/spotify", tags=["spotify"])

API = "https://api.spotify.com/v1"
PLAYLIST_FILE = Path(__file__).resolve().parent.parent / "data" / "playlist.json"
TOP_ARTIST_CACHE_SECONDS = 6 * 60 * 60
PLAYLIST_REFRESH_SECONDS = 12 * 60 * 60  # albums rarely change, so keep Spotify calls low
PLAYLIST_RETRY_SECONDS = 5 * 60  # after a failed load, try again sooner


# ---------- shapes ----------


class TopArtist(BaseModel):
    name: str | None = None
    image: str | None = None
    url: str | None = None
    # Spotify does not give listening time, so this stays empty
    hours: float | None = None


class Track(BaseModel):
    title: str
    artists: list[str]
    url: str | None = None


class Album(BaseModel):
    title: str
    year: str
    image: str | None = None
    url: str | None = None
    tracks: list[Track]


class Artist(BaseModel):
    name: str
    albums: list[Album]


class Playlist(BaseModel):
    artists: list[Artist]
    fetched_at: int


# ---------- helpers ----------


async def spotify_get(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """GET from Spotify with the shared client. Gets a fresh token once if the old one is rejected."""
    for attempt in range(2):
        token = await spotify.access_token(force_refresh=attempt > 0)
        r = await spotify.http.get(
            url, params=params, headers={"Authorization": f"Bearer {token}"}
        )
        if r.status_code != 401:
            r.raise_for_status()
            return r.json()
    r.raise_for_status()
    return {}


def album_id(value: str) -> str:
    """Accepts an album link, a spotify:album: URI, or a bare 22-character ID."""
    value = value.strip()
    m = re.search(r"album[/:]([A-Za-z0-9]{22})", value) or re.fullmatch(
        r"([A-Za-z0-9]{22})", value
    )
    if not m:
        raise ValueError(f"Not a Spotify album link or ID: {value}")
    return m.group(1)


async def fetch_album(aid: str) -> dict[str, Any]:
    album = await spotify_get(f"{API}/albums/{aid}")
    tracks = album["tracks"]["items"]
    nxt = album["tracks"].get("next")
    while nxt:  # long albums come in pages
        page = await spotify_get(nxt)
        tracks += page.get("items", [])
        nxt = page.get("next")
    album["tracks"]["items"] = tracks
    return album


def shape_album(album: dict[str, Any]) -> Album:
    return Album(
        title=album["name"],
        year=(album.get("release_date") or "")[:4],
        image=pick_image(album.get("images")),
        url=(album.get("external_urls") or {}).get("spotify"),
        tracks=[
            Track(
                title=t["name"],
                artists=[a["name"] for a in t.get("artists") or [] if a.get("name")],
                url=(t.get("external_urls") or {}).get("spotify"),
            )
            for t in album["tracks"]["items"]
        ],
    )


# ---------- routes ----------

_top: dict[str, Any] = {"data": None, "at": 0.0}
_top_lock = asyncio.Lock()


@router.get("/top-artist", response_model=TopArtist)
async def top_artist(response: Response) -> TopArtist:
    response.headers["Cache-Control"] = "public, max-age=600"
    async with _top_lock:
        if _top["data"] and time.monotonic() - _top["at"] < TOP_ARTIST_CACHE_SECONDS:
            return _top["data"]
        try:
            # Spotify's ranges: short_term ~4 weeks, medium_term ~6 months, long_term ~1 year
            data = await spotify_get(
                f"{API}/me/top/artists", {"time_range": "medium_term", "limit": 1}
            )
            items = data.get("items") or []
            if not items:
                return TopArtist()
            a = items[0]
            result = TopArtist(
                name=a.get("name"),
                image=pick_image(a.get("images")),
                url=(a.get("external_urls") or {}).get("spotify"),
            )
        except httpx.HTTPError:
            # fail softly, the site shows sample text
            return _top["data"] or TopArtist()
        _top.update(data=result, at=time.monotonic())
        return result


_playlist: Playlist | None = None


async def load_playlist() -> Playlist:
    """Fill in every album in playlist.json from Spotify."""
    config = json.loads(PLAYLIST_FILE.read_text(encoding="utf-8"))
    artists: list[Artist] = []
    for entry in config.get("artists", []):
        raw = [await fetch_album(album_id(link)) for link in entry.get("albums", [])]
        main = ((raw[0].get("artists") or [{}])[0].get("name")) if raw else None
        artists.append(
            Artist(
                name=entry.get("name") or main or "Unknown artist",
                albums=[shape_album(a) for a in raw],
            )
        )
    return Playlist(artists=artists, fetched_at=int(time.time()))


async def keep_playlist_fresh() -> None:
    """Runs for the life of the server: loads the albums at startup, then every 12 hours,
    so no visitor ever waits for Spotify."""
    global _playlist
    while True:
        try:
            _playlist = await load_playlist()
            wait = PLAYLIST_REFRESH_SECONDS
        except Exception:  # any error must not stop the loop; the last good list stays
            log.exception("Could not load the playlist from Spotify")
            wait = PLAYLIST_RETRY_SECONDS
        await asyncio.sleep(wait)


@router.get("/playlist", response_model=Playlist)
async def playlist(response: Response) -> Playlist:
    if _playlist is None:
        # Only before the first load has worked; the site then shows sample albums
        raise HTTPException(503, "The playlist is still loading")
    response.headers["Cache-Control"] = "public, max-age=600"
    return _playlist
