from pydantic import BaseModel


class NowPlaying(BaseModel):
    playing: bool
    title: str | None = None
    artist: str | None = None
    album_art: str | None = None
    url: str | None = None
    played_at: str | None = None