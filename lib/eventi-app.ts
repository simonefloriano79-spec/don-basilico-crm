// Contatori anonimi dell'app ordini: quante persone vedono «Scarica l'app», toccano i pulsanti, installano, aprono l'app.
// Niente dati personali: solo il tipo di evento, il tipo di telefono e da dove arriva la visita (Google, QR, diretto…).

export const TIPI_EVENTO = [
  "pagina_app",       // aperta la pagina «Scarica l'app» (/ordina/app), una volta per visita
  "tocco_play",       // toccato «Scarica l'app da Google Play»
  "tocco_installa",   // toccato «Installa l'app» / «Oppure installala dal browser»
  "installata",       // installazione dal browser completata
  "apertura_app",     // app installata dal browser (icona sul telefono) aperta, una volta per visita
  "apertura_nativa",  // app dello store (Android/iOS) aperta, una volta per visita
] as const;
export type TipoEvento = (typeof TIPI_EVENTO)[number];

export const PIATTAFORME = ["android", "ios", "computer", "altro"] as const;
export type Piattaforma = (typeof PIATTAFORME)[number];

export const ETICHETTE_EVENTO: Record<TipoEvento, string> = {
  pagina_app: "Pagina «Scarica l'app» aperta",
  tocco_play: "Tocchi su «Scarica da Google Play»",
  tocco_installa: "Tocchi su «Installa l'app»",
  installata: "Installazioni dal browser",
  apertura_app: "Aperture dell'app installata (icona)",
  apertura_nativa: "Aperture dell'app degli store",
};

function piattaformaTelefono(): Piattaforma {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "computer";
}

// Da dove arriva la visita: utm_source/src se c'è (es. nei QR), altrimenti il sito di provenienza, altrimenti «diretto».
function sorgenteVisita(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    const esplicita = p.get("utm_source") || p.get("src");
    if (esplicita) return esplicita.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40) || "diretto";
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname) return host.slice(0, 40);
    }
  } catch {}
  return "diretto";
}

// Invia l'evento senza mai disturbare il cliente: se qualcosa va storto non succede nulla.
// `unaVolta`: lo conta una sola volta per visita (la memoria della scheda del browser evita doppi conteggi).
export function segnala(tipo: TipoEvento, opzioni: { unaVolta?: boolean } = {}) {
  try {
    if (opzioni.unaVolta) {
      const chiave = `evt_${tipo}`;
      if (sessionStorage.getItem(chiave)) return;
      sessionStorage.setItem(chiave, "1");
    }
    const corpo = JSON.stringify({ tipo, piattaforma: piattaformaTelefono(), sorgente: sorgenteVisita() });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/ordina/evento", new Blob([corpo], { type: "application/json" }))) return;
    fetch("/api/ordina/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
  } catch {}
}
