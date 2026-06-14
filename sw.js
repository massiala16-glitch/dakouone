/* DAKOUONE — Service Worker (PWA)
   Stratégie : réseau d'abord (l'app a besoin du temps réel Firebase),
   le SW sert surtout à rendre l'app installable et à gérer l'icône. */

const CACHE = "dakouone-v1";
const A_PRECACHER = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(A_PRECACHER)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  // Ne jamais mettre en cache Firebase, les tuiles de carte ou le reCAPTCHA (temps réel)
  if (url.includes("firebase") || url.includes("googleapis") ||
      url.includes("gstatic") || url.includes("cartocdn") ||
      url.includes("recaptcha") || e.request.method !== "GET") {
    return; // laisse passer au réseau normalement
  }
  // Pour le reste (HTML, CSS local) : réseau d'abord, cache en secours
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {});
        return rep;
      })
      .catch(() => caches.match(e.request))
  );
});
