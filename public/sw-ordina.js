// Service worker minimo dell'app ordini: serve solo a rendere l'app installabile sul telefono.
// Non salva nulla in cache (le pagine e i menù arrivano sempre aggiornati dalla rete).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
