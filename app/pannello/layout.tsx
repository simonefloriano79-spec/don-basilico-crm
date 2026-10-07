import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { PannelloControlli } from "./PannelloControlli";

export const metadata = { title: "Ordini online — Don Basilico", robots: { index: false, follow: false } };

// Pannello ordini online: stesso aspetto dell'app ordini del CRM (barra laterale e barra in alto),
// ma con la sola voce "Online". Usa gli stessi accessi e gli stessi dati del CRM.
export default async function PannelloLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?da=/pannello");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div className="sidebar-desktop" style={{ display: "flex" }}>
        <Sidebar session={session} pannello />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Suspense fallback={null}>
          <Topbar session={session} />
        </Suspense>
        <PannelloControlli />
        <main className="main-content" style={{ flex: 1, overflowY: "auto", padding: "26px 26px 60px" }}>
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
