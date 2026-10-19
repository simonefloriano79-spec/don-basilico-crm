import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { verificaCodice } from "@/lib/codice-sconto";

// POST /api/ordina/codice — controlla un codice sconto per il cliente collegato (non lo "consuma":
// l'uso si registra solo quando l'ordine viene creato, dove il codice viene ricontrollato).
export async function POST(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Accedi per usare un codice sconto" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const esito = await verificaCodice(prisma, body?.codice, clienteId).catch(() => null);
  if (!esito) return NextResponse.json({ error: "Non riusciamo a controllare il codice, riprova tra poco" }, { status: 500 });
  if (!esito.ok) return NextResponse.json({ error: esito.motivo }, { status: 422 });
  return NextResponse.json({ ok: true, codice: esito.codice, percentuale: esito.percentuale });
}
