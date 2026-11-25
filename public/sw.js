/* KRIS SKIN service worker.
 * Caches ONLY immutable static assets (build files, fonts, icons).
 * It never touches pages, server actions, /api, Supabase Storage or PDFs: medical data, photos and
 * documents are never stored by the service worker (ADR-013). */
const CACHE = "kris-static-v1";
const STATIC = /^\/(_next\/static|fonts|icons)\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !STATIC.test(url.pathname)) return; // everything else: network, untouched
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
