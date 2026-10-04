import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caricoPerFinestra, inizioFinestra } from "@/lib/capacita-pizze";

// GET /api/ordini/carico?sedeId=…&ora=ISO[&escludi=ordineId] — carico cucina (pizze equivalenti)
// della finestra che contiene l'orario, per decidere a che ora accettare un ordine online.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const sedeId = req.nextUrl.searchParams.get("sedeId") ?? "";
  const ora = new Date(req.nextUrl.searchParams.get("ora") ?? "");
  const escludi = req.nextUrl.searchParams.get("escludi") ?? undefined;
  if (Number.isNaN(ora.getTime())) return NextResponse.json({ error: "Orario non valido" }, { status: 400 });
  if (user.ruolo !== "super_admin" && sedeId !== user.sedeId) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const sede = await prisma.sede.findUnique({ where: { id: sedeId } }).catch(() => null);
  if (!sede) return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });

  const inizio = inizioFinestra(ora, sede.finestraCapacitaMin);
  const fine = new Date(inizio.getTime() + sede.finestraCapacitaMin * 60000);
  const carico = await caricoPerFinestra(sede.id, inizio, fine, sede.finestraCapacitaMin, escludi);

  return NextResponse.json({
    usati: carico.get(inizio.getTime()) ?? 0,
    capacita: sede.capacitaPizze,
    finestraMin: sede.finestraCapacitaMin,
  });
}
