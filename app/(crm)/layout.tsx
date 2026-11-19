import type { Metadata } from "next";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";

// CRM installabile sul telefono (icona baffo verde + «CRM»). Il sito dichiara come base ordina.donbasilico.it (app clienti):
// per il CRM manifest e icone devono invece partire dall'indirizzo da cui si sta aprendo il CRM.
export async function generateMetadata(): Promise<Metadata> {
  const h = headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "don-basilico-crm.vercel.app").split(",")[0].trim();
  const proto = /^localhost|^127\./.test(host) ? "http" : "https";
  return {
    metadataBase: new URL(`${proto}://${host}`),
    manifest: "/manifest-crm.webmanifest",
    icons: { apple: "/crm-icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "CRM", statusBarStyle: "default" },
  };
}

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar — solo desktop */}
      <div className="sidebar-desktop" style={{ display: "flex" }}>
        <Sidebar session={session} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Topbar session={session} />
        <main className="main-content" style={{ flex: 1, overflowY: "auto", padding: "26px 26px 60px" }}>
          {children}
        </main>
      </div>

      {/* Bottom nav — solo mobile */}
      <MobileNav session={session} />
    </div>
  );
}
