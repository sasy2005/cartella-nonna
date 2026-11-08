// Service worker: apertura veloce anche con rete debole + notifiche del mattino.
// Le pagine si prendono prima dalla rete (così gli aggiornamenti arrivano subito),
// i file statici dalla cache. I dati (Supabase) non passano mai di qui.
const CACHE = "cartella-nonna-v3";
const CONDIVISI = "cartella-nonna-condivisi";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // "Condividi → Nonna" (Android): il file arriva qui, lo teniamo da parte e apriamo l'app
  if (req.method === "POST" && url.origin === self.location.origin && url.pathname.endsWith("/condividi")) {
    e.respondWith(
      (async () => {
        try {
          const dati = await req.formData();
          const file = dati.getAll("file").find((f) => f && typeof f !== "string");
          if (file) {
            const c = await caches.open(CONDIVISI);
            await c.put("ultimo", new Response(file, { headers: { "content-type": file.type || "application/octet-stream", "x-nome": encodeURIComponent(file.name || "") } }));
          }
        } catch (_) {
          /* niente file: si apre comunque l'app */
        }
        return Response.redirect(new URL("./#condividi", self.registration.scope).href, 303);
      })(),
    );
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return r;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./"))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return r;
        }),
    ),
  );
});

// (le pagine vecchie in cache vengono rimosse all'attivazione)

// Notifica in arrivo dal server
self.addEventListener("push", (e) => {
  let d = { titolo: "Cartella della Nonna", testo: "Ci sono cose da fare", tag: "promemoria", url: "./" };
  try {
    d = { ...d, ...e.data.json() };
  } catch (_) {
    if (e.data) d.testo = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(d.titolo, {
      body: d.testo,
      tag: d.tag,
      renotify: true,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: { url: d.url || "./" },
    }),
  );
});

// Tocco sulla notifica: apre l'app (o la porta in primo piano)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const dest = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      const aperta = cs.find((c) => c.url.startsWith(self.registration.scope));
      if (aperta) return aperta.focus();
      return self.clients.openWindow(dest);
    }),
  );
});
