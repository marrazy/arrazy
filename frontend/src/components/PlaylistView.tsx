// Playlist page. Albums come from api.arrazy.com/v1/spotify/playlist,
// which reads backend/src/api/data/playlist.json. Shows sample albums until that works.
import { useEffect, useState } from "react";
import { getJSON, type Playlist } from "../lib/api";
import { samplePlaylist } from "../data/sample";

export default function PlaylistView() {
  const [data, setData] = useState<Playlist>(samplePlaylist);
  const [isSample, setIsSample] = useState(true);

  useEffect(() => {
    getJSON<Playlist>("/spotify/playlist", 15000)
      .then((d) => {
        if (d.artists?.length) {
          setData(d);
          setIsSample(false);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {isSample && <p className="note">These are sample albums. Add your own to playlist.json in the backend.</p>}
      {data.artists.map((artist) => (
        <div className="artist" key={artist.name}>
          <h2>{artist.name}</h2>
          <div className="albums">
            {artist.albums.map((al) => (
              <div className="album" key={al.title + al.year}>
                {al.image && al.url ? (
                  <a className="cover" href={al.url} target="_blank" rel="noopener" aria-label={`${al.title} on Spotify`}>
                    <img src={al.image} alt="" loading="lazy" />
                  </a>
                ) : (
                  <div className="cover">{al.title}</div>
                )}
                <p className="album-name">{al.title}{al.year && ` · ${al.year}`}</p>
                <ul className="tracks">
                  {al.tracks.map((t, i) => (
                    <li key={i}>
                      {t.url ? <a href={t.url} target="_blank" rel="noopener">{t.title}</a> : t.title}
                      {t.artists.length > 0 && <span className="alt">{t.artists.join(", ")}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
