import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviaSmsDettaglio } from "@/lib/customer-auth/sms";
import { caricaOrdineStaff, descriviOrario, leggiOrario } from "@/lib/ordini-online";

// POST /api/ordini/[id]/sposta — cambia l'orario confermato di un ordine online già accettato,
// con avviso SMS opzionale al cliente (avvisa !== false).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await caricaOrdineStaff(params.id);
  if ("errore" in r) return r.errore;
  const { ordine, user } = r;

  if (ordine.canale !== "online" || ["annullato", "consegnato"].includes(ordine.stato)) {
    return NextResponse.json({ error: "L'orario di questo ordine non può essere spostato" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const orario = leggiOrario(body.oraConfermata);
  if (!orario) return NextResponse.json({ error: "Orario non valido" }, { status: 400 });

  await prisma.$transaction([
    prisma.ordine.update({
      where: { id: ordine.id },
      data: { oraConsegnaComunicata: orario, modalitaConsegna: "alle_ore" },
    }),
    prisma.ordineStatoLog.create({
      data: { ordineId: ordine.id, stato: ordine.stato, utenteId: user.id, note: `Orario spostato a ${descriviOrario(orario)}` },
    }),
  ]);

  let smsInviato = false;
  let smsErrore: string | undefined;
  if (ordine.clienteTelefono && body.avvisa !== false) {
    const esitoSms = await inviaSmsDettaglio(
      ordine.clienteTelefono,
      `Don Basilico ${ordine.sede.nome.replace("Don Basilico ", "")}: ordine #${ordine.numeroOrdine}, nuovo orario ` +
        `${ordine.tipo === "domicilio" ? "di consegna" : "di ritiro"}: ${descriviOrario(orario)}. Ci scusiamo per la variazione.`
    );
    smsInviato = esitoSms.ok;
    smsErrore = esitoSms.errore;
  }
  return NextResponse.json({ ok: true, smsInviato, smsErrore });
}
