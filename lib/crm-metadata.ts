import type { Metadata } from "next";
import { headers } from "next/headers";

// CRM installabile (telefono e computer): manifest e icona «CRM».
// Il sito dichiara come base ordina.donbasilico.it (app clienti): per il CRM manifest e icone devono invece
// partire dall'indirizzo da cui si sta aprendo il CRM, altrimenti l'installazione punterebbe al dominio sbagliato.
export function metadataInstallabile(): Metadata {
  const h = headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "don-basilico-crm.vercel.app").split(",")[0].trim();
  const proto = /^localhost|^127\./.test(host) ? "http" : "https";
  return {
    metadataBase: new URL(`${proto}://${host}`),
    manifest: "/manifest-crm.webmanifest",
    // Anche l'icona «normale» è quella del CRM: se il telefono crea un semplice collegamento (invece di installare l'app)
    // mostra il baffo verde + CRM e non il mappamondo generico.
    icons: {
      icon: [{ url: "/crm-icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/favicon.ico", sizes: "any" }],
      shortcut: "/crm-icons/icon-192.png",
      apple: [{ url: "/crm-icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: "CRM", statusBarStyle: "default" },
  };
}
