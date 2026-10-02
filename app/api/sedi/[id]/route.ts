import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/sedi/[id] — impostazioni online della sede (aggiornamento parziale):
// - capienza cucina: massimo di pizze equivalenti per finestra di N minuti
//   (default 15 ogni 15). Limita solo gli orari prenotabili online, non cassa/telefono.
// - ordiniOnlineAttivi: interruttore per sospendere/riprendere gli ordini dal sito clienti.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  if (user.ruolo !== "super_admin" && !(user.ruolo === "sede_manager" && user.sedeId === params.id)) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { capacitaPizze?: number; finestraCapacitaMin?: number; ordiniOnlineAttivi?: boolean } = {};

  if (body.capacitaPizze !== undefined || body.finestraCapacitaMin !== undefined) {
    const capacitaPizze = Math.round(Number(body.capacitaPizze));
    const finestraCapacitaMin = Math.round(Number(body.finestraCapacitaMin));
    if (!(capacitaPizze >= 1 && capacitaPizze <= 200) || !(finestraCapacitaMin >= 5 && finestraCapacitaMin <= 60)) {
      return NextResponse.json({ error: "Capienza non valida (1–200 pizze, finestra 5–60 minuti)" }, { status: 400 });
    }
    data.capacitaPizze = capacitaPizze;
    data.finestraCapacitaMin = finestraCapacitaMin;
  }
  if (body.ordiniOnlineAttivi !== undefined) {
    if (typeof body.ordiniOnlineAttivi !== "boolean") {
      return NextResponse.json({ error: "Valore non valido" }, { status: 400 });
    }
    data.ordiniOnlineAttivi = body.ordiniOnlineAttivi;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Niente da aggiornare" }, { status: 400 });

  const sede = await prisma.sede.update({ where: { id: params.id }, data }).catch(() => null);
  if (!sede) return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    capacitaPizze: sede.capacitaPizze,
    finestraCapacitaMin: sede.finestraCapacitaMin,
    ordiniOnlineAttivi: sede.ordiniOnlineAttivi,
  });
}
