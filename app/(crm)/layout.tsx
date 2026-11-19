import type { Metadata } from "next";
import { metadataInstallabile } from "@/lib/crm-metadata";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";

// CRM installabile sul telefono e sul computer (icona baffo verde + «CRM»): vedi lib/crm-metadata.ts.
export async function generateMetadata(): Promise<Metadata> {
  return metadataInstallabile();
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
