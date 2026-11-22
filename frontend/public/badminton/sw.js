// Offline support for /badminton/.
// Online, every file comes from the server first, checked past the browser's own cache, so a new
// release always arrives complete and never mixes old and new files. The saved copy is used only
// when there is no connection, or when the network takes too long (a weak signal at the court).
const CACHE = "badminton-v4";
const FILES = [
  "/badminton/",
  "/badminton/index.html",
  "/badminton/styles.css",
  "/badminton/app.js",
  "/badminton/logic.js",
  "/badminton/icons.js",
  "/badminton/fonts/geist-latin-wght-normal.woff2",
  "/badminton/fonts/geist-mono-latin-wght-normal.woff2",
  "/badminton/manifest.webmanifest",
  "/badminton/icon.svg",
  "/badminton/icon-192.png",
  "/badminton/icon-512.png",
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  // cache: "reload" downloads every file fresh, so an old copy in the browser cache can't sneak in.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("badminton-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith("/badminton/")) return;

  // Pages are saved under one key, without their query string, so "/badminton/?x" works offline too.
  const key = req.mode === "navigate" ? "/badminton/" : url.pathname;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // "no-cache" makes the browser check with the server every time (a quick "not changed" when nothing changed).
      // A plain request built from the address: the browser does not allow changing the cache mode of a page load request.
      const network = fetch(url.href, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
        if (res.ok && res.type === "basic" && !res.redirected) cache.put(key, res.clone());
        return res;
      });
      const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
      try {
        const res = await Promise.race([network, timeout]);
        if (res) return res;
      } catch {
        // offline: fall through to the saved copy
      }
      const cached = await cache.match(key);
      if (cached) return cached;
      return network.catch(() => Response.error());
    })(),
  );
});
