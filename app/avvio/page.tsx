import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Indirizzo di avvio dell'app «CRM» installata (vedi manifest-crm.webmanifest): una sola app per tutti, che si apre sulla
// schermata che serve a chi la usa. La direzione (super admin) parte dalla Panoramica; chi ha un account di sede parte
// dal Pannello ordini (gli ordini online, con suono e avvisi).
export default async function Avvio() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?da=/avvio");
  redirect((session.user as any).ruolo === "super_admin" ? "/dashboard" : "/pannello");
}
