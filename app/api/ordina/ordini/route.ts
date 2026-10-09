import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { finestraCliente } from "@/lib/modifica-ordine";

// GET /api/ordina/ordini — gli ordini fatti dal sito dal cliente collegato (più recenti per primi), con lo stato
// e, per ognuno, se si può ancora modificare o annullare (regola in lib/modifica-ordine.ts).
export async function GET(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo" }, { status: 401 });

  const ordini = await prisma.ordine.findMany({
    where: { clienteId, canale: "online" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, numeroOrdine: true, canale: true, stato: true, tipo: true, createdAt: true,
      oraRichiesta: true, oraConsegnaComunicata: true, modalitaConsegna: true,
      totale: true, costoConsegna: true, scontoFedelta: true, clienteIndirizzo: true,
      nomeCitofono: true, metodoPagamento: true, note: true, modificheCliente: true,
      sede: { select: { id: true, slug: true, nome: true, telefono: true } },
      items: {
        select: {
          id: true, menuItemId: true, nomeSnapshot: true, quantita: true, prezzoSnapshot: true, noteItem: true,
          ingredientiRimossi: true, ingredientiAggiunti: true, impastoId: true, notaCliente: true,
        },
      },
    },
  });

  const adesso = new Date();
  return NextResponse.json({
    ordini: ordini.map((o) => {
      const f = finestraCliente(o, adesso);
      // Gli ordini fatti prima di questa funzione non hanno le scelte salvate in modo strutturato: per quelli solo «annulla».
      const ricostruibile = o.items.length > 0 && o.items.every((i) => !!i.menuItemId);
      return {
        ...o,
        puoAnnullare: f.puoAnnullare,
        puoModificare: f.puoModificare && ricostruibile,
        scadenzaModifica: f.scadenza ? f.scadenza.toISOString() : null,
        motivoNo: f.motivo ?? null,
      };
    }),
  });
}
