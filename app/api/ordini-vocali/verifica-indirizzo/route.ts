import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";
import { geocodificaIndirizzo, trovaSedeCompetente } from "@/lib/ordini-vocali/copertura";
import { verificaSedeAperta } from "@/lib/ordini-vocali/capacita";
import { senzaItalia } from "@/lib/ordini-vocali/telefono";

// POST /api/ordini-vocali/verifica-indirizzo  { indirizzo }
// Tool da chiamare appena il cliente dice l'indirizzo di consegna, PRIMA degli articoli: dice se è
// coperto, da quale pizzeria (serve per cercare nel menù di quella sede) e se è aperta adesso.
export async function POST(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const indirizzo = String(body.indirizzo ?? "").trim();
  if (!indirizzo) {
    return NextResponse.json({ ok: false, esito: "errore", motivo: "Indirizzo mancante" }, { status: 400 });
  }

  const geo = await geocodificaIndirizzo(indirizzo);
  if (!geo) {
    return NextResponse.json({
      ok: false,
      esito: "errore",
      motivo: "Indirizzo non riconosciuto: chiedi al cliente di ripeterlo con via, numero civico e città",
    });
  }

  const copertura = await trovaSedeCompetente(geo.lat, geo.lng);
  if (!copertura) {
    return NextResponse.json({
      ok: false,
      esito: "fuori_zona",
      motivo: "L'indirizzo è fuori dalla zona di consegna delle nostre pizzerie: puoi proporre il ritiro in una sede",
      indirizzoConfermato: senzaItalia(geo.indirizzoFormattato),
    });
  }

  const sede = await prisma.sede.findUnique({
    where: { id: copertura.sedeId },
    select: { slug: true, nome: true, orarioApertura: true, orarioChiusura: true },
  });
  const aperta = await verificaSedeAperta(copertura.sedeId, new Date());

  return NextResponse.json({
    ok: true,
    sedeSlug: sede?.slug,
    sedeNome: copertura.nome,
    indirizzoConfermato: senzaItalia(geo.indirizzoFormattato),
    apertaOra: aperta.ok,
    orario: sede ? `${sede.orarioApertura}-${sede.orarioChiusura}` : null,
  });
}
