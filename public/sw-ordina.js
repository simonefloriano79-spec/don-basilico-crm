// Service worker dell'app ordini: rende l'app installabile sul telefono e mostra le notifiche push
// (ordine confermato, spostato, pronto). Non salva nulla in cache (pagine e menù arrivano sempre dalla rete).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let dati = {};
  try { dati = event.data ? event.data.json() : {}; } catch (e) { dati = { titolo: "Don Basilico", testo: event.data ? event.data.text() : "" }; }
  const titolo = dati.titolo || "Don Basilico";
  event.waitUntil(
    self.registration.showNotification(titolo, {
      body: dati.testo || "",
      icon: "/ordina-icons/icon-192.png",
      badge: "/ordina-icons/icon-192.png",
      tag: dati.tag || undefined,
      renotify: !!dati.tag,
      data: { url: dati.url || "/ordina" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/ordina";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((finestre) => {
      for (const f of finestre) {
        if (f.url.indexOf("/ordina") !== -1 && "focus" in f) return f.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
