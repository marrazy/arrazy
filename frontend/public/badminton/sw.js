// Offline support for /badminton/. Serves saved files first, then refreshes them in the background,
// so the app opens instantly at the court even with no signal and picks up updates on the next visit.
const CACHE = "badminton-v3";
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

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
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

  // Pages are looked up without their query string so "/badminton/?x" still works offline.
  const key = req.mode === "navigate" ? "/badminton/" : req;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(fresh.catch(() => {}));
        return cached;
      }
      return fresh.then((res) => res || Response.error());
    }),
  );
});
