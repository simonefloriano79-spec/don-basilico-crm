import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";

// GET /api/ordina/ordini — gli ordini fatti dal sito dal cliente collegato (più recenti per primi), con lo stato.
export async function GET(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo" }, { status: 401 });

  const ordini = await prisma.ordine.findMany({
    where: { clienteId, canale: "online" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, numeroOrdine: true, stato: true, tipo: true, createdAt: true,
      oraRichiesta: true, oraConsegnaComunicata: true, modalitaConsegna: true,
      totale: true, costoConsegna: true, scontoFedelta: true, clienteIndirizzo: true,
      sede: { select: { nome: true } },
      items: { select: { id: true, nomeSnapshot: true, quantita: true, prezzoSnapshot: true, noteItem: true } },
    },
  });
  return NextResponse.json({ ordini });
}
