import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PannelloBar } from "./PannelloBar";

export const metadata = { title: "Ordini online — Don Basilico", robots: { index: false, follow: false } };

// Pannello ordini online: solo ciò che serve per ricevere e gestire gli ordini del sito,
// senza il resto del CRM. Usa gli stessi accessi (e gli stessi dati) del CRM.
export default async function PannelloLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?da=/pannello");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f7f6f1)" }}>
      <Suspense fallback={null}>
        <PannelloBar session={session} />
      </Suspense>
      <main style={{ padding: "18px 18px 60px", maxWidth: 1500, margin: "0 auto" }}>
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  );
}
