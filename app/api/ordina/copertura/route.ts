import { NextRequest, NextResponse } from "next/server";
import { geocodificaIndirizzo, trovaSedeCompetente } from "@/lib/ordini-vocali/copertura";

// POST /api/ordina/copertura — dato un indirizzo, dice se è coperto da una
// sede e da quale, per validare l'indirizzo di consegna prima del checkout.
// Riusa lo stesso motore di geocoding/zone dell'agente vocale.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const indirizzo = String(body.indirizzo ?? "").trim();

  if (!indirizzo) {
    return NextResponse.json({ error: "Indirizzo mancante" }, { status: 400 });
  }

  const geo = await geocodificaIndirizzo(indirizzo);
  if (!geo) {
    return NextResponse.json({ coperto: false, motivo: "Indirizzo non riconosciuto: prova ad aggiungere numero civico e città" });
  }

  const sede = await trovaSedeCompetente(geo.lat, geo.lng);
  if (!sede) {
    return NextResponse.json({ coperto: false, motivo: "Indirizzo fuori dalla zona di consegna", indirizzoFormattato: geo.indirizzoFormattato });
  }

  return NextResponse.json({
    coperto: true,
    sedeId: sede.sedeId,
    sedeNome: sede.nome,
    indirizzoFormattato: geo.indirizzoFormattato,
  });
}
