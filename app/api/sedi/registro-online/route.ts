import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/sedi/registro-online — ultime accensioni/spegnimenti degli ordini online
// (tutte le sedi per il super admin, solo la propria per gli altri).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const where = user.ruolo === "super_admin" ? {} : { sedeId: user.sedeId ?? "-" };
  const righe = await prisma.registroOrdiniOnline
    .findMany({ where, orderBy: { createdAt: "desc" }, take: 20 })
    .catch(() => null);
  // ok=false: la tabella non esiste ancora (manca il SQL in Supabase).
  return NextResponse.json({ ok: righe !== null, righe: righe ?? [] });
}
