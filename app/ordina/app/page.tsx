import type { Metadata } from "next";
import QRCode from "qrcode";
import InstallaApp from "./InstallaApp";

// Pagina d'arrivo del QR / link «scarica l'app» (si stampa su cartoni, volantini, locali):
// riconosce il telefono e spiega come mettere Don Basilico tra le app, senza passare dagli store.
export const metadata: Metadata = {
  title: "Installa l'app — Don Basilico",
  description: "Metti Don Basilico sulla schermata Home del tuo telefono: ordini in due tocchi e ricevi le notifiche.",
  robots: { index: false, follow: true },
};

const INDIRIZZO = "https://ordina.donbasilico.it/ordina/app";

export default async function PaginaInstallaApp() {
  const qr = await QRCode.toString(INDIRIZZO, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1B1E17", light: "#FFFFFF" } });
  return <InstallaApp qrSvg={qr} />;
}
