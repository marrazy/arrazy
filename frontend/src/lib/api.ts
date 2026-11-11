// Calls to api.arrazy.com and the shapes it returns.
import { SITE } from "../config";

export type NowPlaying = {
  playing: boolean;
  title: string | null;
  artist: string | null;
  album_art: string | null;
  url: string | null;
  played_at?: string | null;
};

export type TopArtist = { name: string | null; image: string | null; url: string | null; hours: number | null };

export type Track = { title: string; artists: string[]; url: string | null };
export type Album = { title: string; year: string; image: string | null; url: string | null; tracks: Track[] };
export type Playlist = { artists: Array<{ name: string; albums: Album[] }> };

export async function getJSON<T>(path: string, timeoutMs = 4000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(SITE.api + path, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
