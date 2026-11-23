import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/conti/metodo — { ordineId, metodo: "contanti" | "pos" }
// Corregge come ha davvero pagato il cliente al domicilio (in app aveva dichiarato altro): i conti dei rider si basano su questo.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  const { ordineId, metodo } = await req.json().catch(() => ({}));
  if (!ordineId || !["contanti", "pos"].includes(metodo)) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const ordine = await prisma.ordine.findUnique({ where: { id: ordineId }, select: { sedeId: true, tipo: true } });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  if (ordine.tipo !== "domicilio") return NextResponse.json({ error: "Il metodo di pagamento si corregge solo per le consegne a domicilio" }, { status: 400 });

  await prisma.ordine.update({ where: { id: ordineId }, data: { metodoPagamento: metodo } });
  return NextResponse.json({ ok: true });
}
