import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviaSmsDettaglio } from "@/lib/customer-auth/sms";
import { caricaOrdineStaff, descriviOrario, euroSms, leggiOrario } from "@/lib/ordini-online";

// POST /api/ordini/[id]/accetta — la pizzeria accetta un ordine online "da accettare"
// fissando l'orario confermato (proposto = quello richiesto, modificabile). Solo ora
// il cliente riceve l'SMS di conferma.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await caricaOrdineStaff(params.id);
  if ("errore" in r) return r.errore;
  const { ordine, user } = r;

  if (ordine.canale !== "online" || ordine.stato !== "nuovo") {
    return NextResponse.json({ error: "Solo gli ordini online in attesa possono essere accettati" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const orario = leggiOrario(body.oraConfermata);
  if (!orario) return NextResponse.json({ error: "Orario confermato non valido" }, { status: 400 });

  await prisma.$transaction([
    prisma.ordine.update({
      where: { id: ordine.id },
      data: { stato: "confermato", oraConsegnaComunicata: orario, modalitaConsegna: "alle_ore" },
    }),
    prisma.ordineStatoLog.create({
      data: { ordineId: ordine.id, stato: "confermato", utenteId: user.id, note: `Accettato per ${descriviOrario(orario)}` },
    }),
  ]);

  let smsInviato = false;
  let smsErrore: string | undefined;
  if (ordine.clienteTelefono && body.avvisa !== false) {
    const esitoSms = await inviaSmsDettaglio(
      ordine.clienteTelefono,
      // Se il cliente l'ha modificato dall'app, l'SMS lo dice (altrimenti non capirebbe che la modifica è stata accettata).
      `Don Basilico ${ordine.sede.nome.replace("Don Basilico ", "")}: ordine #${ordine.numeroOrdine} ` +
        `${ordine.modificatoAt ? "con le tue modifiche CONFERMATO" : "CONFERMATO"}. ` +
        `${ordine.tipo === "domicilio" ? "Consegna" : "Ritiro"} ${descriviOrario(orario)}. ` +
        `Totale ${euroSms(parseFloat(ordine.totale.toString()))}.`
    );
    smsInviato = esitoSms.ok;
    smsErrore = esitoSms.errore;
  }
  return NextResponse.json({ ok: true, smsInviato, smsErrore });
}
