import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";

// GET /api/ordini-vocali/info-sedi — le pizzerie attive con indirizzo, telefono e orari: servono all'assistente per
// rispondere a «dov'è la pizzeria?» e per dare il numero quando il cliente deve chiamare direttamente.
export async function GET(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const sedi = await prisma.sede.findMany({
    where: { attiva: true },
    orderBy: { nome: "asc" },
    select: { slug: true, nome: true, indirizzo: true, citta: true, telefono: true, orarioApertura: true, orarioChiusura: true },
  });
  return NextResponse.json({ sedi });
}
