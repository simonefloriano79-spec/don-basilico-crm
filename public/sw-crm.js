// Service worker del CRM: serve solo a rendere il CRM installabile sul telefono (icona «CRM» in home).
// Non salva nulla in cache e non intercetta nulla: pagine e dati arrivano sempre dalla rete.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
