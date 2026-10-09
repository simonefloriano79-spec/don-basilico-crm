import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { finestraCliente } from "@/lib/modifica-ordine";
import { ripristinaSconto } from "@/lib/fedelta";

// POST /api/ordina/ordini/[id]/annulla — il cliente annulla un suo ordine, ma solo nella finestra consentita
// (fino a 30 minuti prima dell'orario concordato, o finché non è accettato se «appena possibile»).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });

  const ordine = await prisma.ordine.findFirst({ where: { id: params.id, clienteId, canale: "online" } });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });

  const f = finestraCliente(ordine);
  if (!f.puoAnnullare) {
    return NextResponse.json({ error: f.motivo ?? "L'ordine non si può più annullare" }, { status: 409 });
  }

  // updateMany con le condizioni di prima: se nel frattempo la pizzeria l'ha messo in preparazione non si annulla.
  const fatto = await prisma.ordine.updateMany({
    where: { id: ordine.id, stato: { in: ["nuovo", "confermato"] } },
    data: { stato: "annullato", modificatoAt: new Date() },
  });
  if (!fatto.count) return NextResponse.json({ error: "L'ordine è appena passato in preparazione: chiama la pizzeria" }, { status: 409 });

  await prisma.ordineStatoLog.create({
    data: { ordineId: ordine.id, stato: "annullato", note: "Annullato dal cliente dall'app" },
  });
  // Se l'ordine aveva usato lo sconto fedeltà, torna disponibile.
  await ripristinaSconto(ordine.id).catch((e) => console.error("Sconto fedeltà non ripristinato", e));

  return NextResponse.json({ ok: true });
}
