import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Ordina online — Don Basilico",
  description: "Ordina la pizza di Don Basilico online: ritiro in sede o consegna a domicilio a Pescara, Montesilvano e Chieti Scalo.",
  // Le pagine degli ordini sono quelle che devono comparire su Google (il CRM no: vedi app/layout.tsx).
  robots: { index: true, follow: true },
  openGraph: {
    type: "website", locale: "it_IT", siteName: "Don Basilico",
    title: "Don Basilico — Ordina la tua pizza online",
    description: "Ritiro in sede o consegna a domicilio. Impasto con lievitazione di almeno 48 ore.",
    images: [{ url: "/ordina-icons/icon-512.png", width: 512, height: 512 }],
  },
  manifest: "/manifest-ordina.webmanifest",
  icons: { icon: "/ordina-icons/icon-192.png", apple: "/ordina-icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Don Basilico", statusBarStyle: "default" },
};

export default function OrdinaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#F6F6F1", WebkitTapHighlightColor: "transparent" }}>
      <style>{".db-scroll-x{scrollbar-width:none}.db-scroll-x::-webkit-scrollbar{display:none}"}</style>
      {/* Playfair Display: titoli e importi dell'app ordini */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" />
      <main style={{ maxWidth: 640, width: "100%", margin: "0 auto", padding: "14px 16px 60px" }}>
        {children}
      </main>
    </div>
  );
}
