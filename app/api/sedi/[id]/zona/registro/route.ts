import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/sedi/[id]/zona/registro — ultime modifiche alla zona di consegna della sede
// (il super admin le vede di ogni sede, gli altri solo quelle della propria).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  if (user.ruolo !== "super_admin" && user.sedeId !== params.id) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }
  const righe = await prisma.registroZoneConsegna
    .findMany({ where: { sedeId: params.id }, orderBy: { createdAt: "desc" }, take: 10 })
    .catch(() => null);
  // ok=false: la tabella non esiste ancora (manca il SQL in Supabase).
  return NextResponse.json({ ok: righe !== null, righe: righe ?? [] });
}
