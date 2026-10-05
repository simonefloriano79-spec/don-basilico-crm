import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ordina online — Don Basilico",
  description: "Ordina la tua pizza: ritiro in sede o consegna a domicilio.",
  manifest: "/manifest-ordina.webmanifest",
  icons: { icon: "/ordina-icons/icon-192.png", apple: "/ordina-icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Don Basilico", statusBarStyle: "default" },
};

export default function OrdinaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", WebkitTapHighlightColor: "transparent" }}>
      <main style={{ maxWidth: 640, width: "100%", margin: "0 auto", padding: "14px 16px 60px" }}>
        {children}
      </main>
    </div>
  );
}
