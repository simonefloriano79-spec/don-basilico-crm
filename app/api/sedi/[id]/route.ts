import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/sedi/[id] — imposta la capienza cucina della sede: massimo di pizze
// equivalenti per finestra di N minuti (default 15 pizze ogni 15 minuti).
// Limita solo gli orari prenotabili online; non blocca mai cassa/telefono.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  if (user.ruolo !== "super_admin" && !(user.ruolo === "sede_manager" && user.sedeId === params.id)) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const capacitaPizze = Math.round(Number(body.capacitaPizze));
  const finestraCapacitaMin = Math.round(Number(body.finestraCapacitaMin));
  if (!(capacitaPizze >= 1 && capacitaPizze <= 200) || !(finestraCapacitaMin >= 5 && finestraCapacitaMin <= 60)) {
    return NextResponse.json({ error: "Capienza non valida (1–200 pizze, finestra 5–60 minuti)" }, { status: 400 });
  }

  const sede = await prisma.sede
    .update({ where: { id: params.id }, data: { capacitaPizze, finestraCapacitaMin } })
    .catch(() => null);
  if (!sede) return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  return NextResponse.json({ ok: true, capacitaPizze: sede.capacitaPizze, finestraCapacitaMin: sede.finestraCapacitaMin });
}
