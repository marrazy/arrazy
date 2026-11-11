// The music sentence on the home page, with the small Spotify cards.
// Loads from api.arrazy.com and refreshes every minute. Falls back to sample data if the API fails.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getJSON, type NowPlaying, type TopArtist } from "../lib/api";
import { sampleNowPlaying, sampleTopArtist } from "../data/sample";

type CardKind = "track" | "artist" | "top";

const initials = (name: string | null) =>
  (name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function ago(since: number, now: number) {
  const s = Math.max(0, Math.round((now - since) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

export default function MusicLine() {
  const [np, setNp] = useState<NowPlaying>(sampleNowPlaying);
  const [top, setTop] = useState<TopArtist>(sampleTopArtist);
  const [sample, setSample] = useState({ np: true, top: true });
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [card, setCard] = useState<{ kind: CardKind; left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Load now, then every minute
  useEffect(() => {
    let alive = true;
    async function load() {
      const [n, t] = await Promise.allSettled([
        getJSON<NowPlaying>("/spotify/now-playing"),
        getJSON<TopArtist>("/spotify/top-artist"),
      ]);
      if (!alive) return;
      if (n.status === "fulfilled" && n.value.title) {
        setNp(n.value);
        setSample((s) => ({ ...s, np: false }));
      }
      if (t.status === "fulfilled" && t.value.name) {
        setTop(t.value);
        setSample((s) => ({ ...s, top: false }));
      }
      setFetchedAt(Date.now());
    }
    load();
    const every = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(every); };
  }, []);

  // Tick the "Fetched Xs ago" text while a card is open
  useEffect(() => {
    if (!card) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [card]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!card) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!cardRef.current?.contains(target) && !target.closest(".pick")) setCard(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCard(null);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [card]);

  function open(kind: CardKind, el: HTMLElement) {
    if (card?.kind === kind) return setCard(null);
    const r = el.getBoundingClientRect();
    const width = Math.min(340, document.documentElement.clientWidth - 32);
    const left = Math.min(Math.max(16, r.left + scrollX), scrollX + document.documentElement.clientWidth - width - 16);
    setCard({ kind, left, top: r.bottom + scrollY + 12 });
  }

  const Pick = ({ kind, children }: { kind: CardKind; children: ReactNode }) => (
    <button className="pick" aria-expanded={card?.kind === kind} onClick={(e) => open(kind, e.currentTarget)}>
      {children}
    </button>
  );

  return (
    <>
      <p>
        i enjoy listening to music, especially from <Pick kind="top">{top.name}</Pick>, and{" "}
        {np.playing ? "am currently listening to" : "the last song i played was"}{" "}
        <Pick kind="track">{np.title}</Pick> by <Pick kind="artist">{np.artist}</Pick>. check my{" "}
        <a className="u" href="/playlist/">playlists</a>.
      </p>
      {card &&
        createPortal(
          <div className="np-card" role="dialog" ref={cardRef} style={{ left: card.left, top: card.top }}>
            <CardBody
              kind={card.kind}
              np={np}
              top={top}
              foot={`via Spotify · Fetched ${ago(fetchedAt, now)}${(card.kind === "top" ? sample.top : sample.np) ? " · sample data" : ""}`}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function CardBody({ kind, np, top, foot }: { kind: CardKind; np: NowPlaying; top: TopArtist; foot: string }) {
  let label: ReactNode, image: string | null, name: string | null, sub: string | null, url: string | null, round: boolean;
  if (kind === "track") {
    label = np.playing ? <><span className="eq"><i /><i /><i /></span>Now playing</> : "Last played";
    [image, name, sub, url, round] = [np.album_art, np.title, np.artist, np.url, false];
  } else if (kind === "top") {
    label = "Most played, past 6 months";
    [image, name, url, round] = [top.image, top.name, top.url, true];
    sub = top.hours != null ? `${top.hours} hours listened in the past 6 months` : null;
  } else {
    // Same layout as the top artist card: round photo, name, Spotify link
    label = "Artist";
    [image, name, sub, url, round] = [np.artist_image ?? null, np.artist, null, np.artist_url ?? null, true];
  }
  return (
    <>
      <p className="np-label">{label}</p>
      <div className="np-row">
        <div className={`np-img${round ? " round" : ""}`}>{image ? <img src={image} alt="" /> : initials(name)}</div>
        <div>
          <p className="np-title">{name}</p>
          {sub && <p className="np-sub">{sub}</p>}
          {url && <a className="np-link" href={url} target="_blank" rel="noopener">Open in Spotify ↗</a>}
        </div>
      </div>
      <p className="np-foot">{foot}</p>
    </>
  );
}
