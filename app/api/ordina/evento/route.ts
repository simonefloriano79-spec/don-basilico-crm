import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIPI_EVENTO, PIATTAFORME } from "@/lib/eventi-app";

// POST /api/ordina/evento — contatori anonimi dell'app ordini (pubblico: lo chiama il telefono del cliente).
// Accetta solo tipi e piattaforme dell'elenco e una provenienza breve e pulita; non salva nient'altro (niente IP, niente cookie).
// Best-effort: se la tabella non c'è ancora o qualcosa fallisce, risponde comunque senza errori al telefono.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const tipo = (TIPI_EVENTO as readonly string[]).includes(b?.tipo) ? b.tipo : null;
    if (!tipo) return new NextResponse(null, { status: 204 });
    const piattaforma = (PIATTAFORME as readonly string[]).includes(b?.piattaforma) ? b.piattaforma : "altro";
    const sorgente = typeof b?.sorgente === "string" ? b.sorgente.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40) || null : null;
    await prisma.eventoApp.create({ data: { tipo, piattaforma, sorgente } });
  } catch {
    // niente: il conteggio non deve mai dare fastidio al cliente
  }
  return new NextResponse(null, { status: 204 });
}
