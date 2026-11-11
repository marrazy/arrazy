from pydantic import BaseModel


class NowPlaying(BaseModel):
    playing: bool
    title: str | None = None
    artist: str | None = None
    artist_image: str | None = None  # the (first) artist's photo, or the podcast's cover
    artist_url: str | None = None  # the (first) artist's or podcast's Spotify page
    album_art: str | None = None
    url: str | None = None
    played_at: str | None = None