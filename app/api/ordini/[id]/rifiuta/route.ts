import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviaSmsDettaglio } from "@/lib/customer-auth/sms";
import { caricaOrdineStaff } from "@/lib/ordini-online";

// POST /api/ordini/[id]/rifiuta — la pizzeria non può preparare l'ordine online: lo annulla e avvisa il cliente.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await caricaOrdineStaff(params.id);
  if ("errore" in r) return r.errore;
  const { ordine, user } = r;

  if (ordine.canale !== "online" || ordine.stato !== "nuovo") {
    return NextResponse.json({ error: "Solo gli ordini online in attesa possono essere rifiutati" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  await prisma.$transaction([
    prisma.ordine.update({ where: { id: ordine.id }, data: { stato: "annullato" } }),
    prisma.ordineStatoLog.create({
      data: { ordineId: ordine.id, stato: "annullato", utenteId: user.id, note: "Rifiutato dalla pizzeria" },
    }),
  ]);

  let smsInviato = false;
  let smsErrore: string | undefined;
  if (ordine.clienteTelefono && body.avvisa !== false) {
    const esitoSms = await inviaSmsDettaglio(
      ordine.clienteTelefono,
      `Don Basilico ${ordine.sede.nome.replace("Don Basilico ", "")}: purtroppo non riusciamo a preparare l'ordine #${ordine.numeroOrdine} ` +
        `per l'orario richiesto. Puoi riprovare con un altro orario oppure chiamarci. Ci scusiamo per il disagio.`
    );
    smsInviato = esitoSms.ok;
    smsErrore = esitoSms.errore;
  }
  return NextResponse.json({ ok: true, smsInviato, smsErrore });
}
