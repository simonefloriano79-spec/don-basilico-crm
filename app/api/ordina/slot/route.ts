import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generaSlot } from "@/lib/slot-ritiro";
import { disponibilitaSlot } from "@/lib/capacita-pizze";

// GET /api/ordina/slot?sedeId=…&peso=N — orari di ritiro/consegna prenotabili
// (oggi e domani, ogni 10 minuti) con la disponibilità di capienza cucina.
// `peso` = pizze equivalenti dell'ordine in corso (default 1).
export async function GET(req: NextRequest) {
  const sedeId = req.nextUrl.searchParams.get("sedeId") ?? "";
  const peso = Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("peso")) || 1));

  const sede = await prisma.sede
    .findUnique({ where: { id: sedeId } })
    .catch(() => null);
  if (!sede || !sede.attiva) {
    return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });
  }

  const gen = generaSlot({ adesso: new Date(), apertura: sede.orarioApertura, chiusura: sede.orarioChiusura });
  const [dispOggi, dispDomani] = await Promise.all([
    disponibilitaSlot(sede, gen.oggi.map((s) => s.iso), peso),
    disponibilitaSlot(sede, gen.domani.map((s) => s.iso), peso),
  ]);
  const unisci = (slot: { ora: string; iso: string }[], disp: { pieno: boolean }[]) =>
    slot.map((s, i) => ({ ora: s.ora, iso: s.iso, pieno: disp[i].pieno }));

  return NextResponse.json({
    apertura: sede.orarioApertura,
    chiusura: sede.orarioChiusura,
    apertoOra: gen.apertoOra,
    primoGiorno: gen.primoGiorno,
    oggi: unisci(gen.oggi, dispOggi),
    domani: unisci(gen.domani, dispDomani),
  });
}
