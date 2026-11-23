import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/conti/assegna — { ordineId, fattorinoId }
// La cassa assegna a un rider una consegna che nessuno ha scansionato (o che era finita sul rider sbagliato).
// Scrive nella tabella `consegne` dell'app dei rider (stesso database), come fa la sua pagina admin.
//  - ordine già «consegnato» nel CRM: la consegna nasce già chiusa (i contanti contano subito come «da versare»);
//  - altrimenti nasce «assegnata»: compare nell'app del rider, che la chiude a fine corsa.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  const { ordineId, fattorinoId } = await req.json().catch(() => ({}));
  if (!ordineId || !fattorinoId) return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });

  const ordine = await prisma.ordine.findUnique({ where: { id: ordineId }, select: { sedeId: true, tipo: true, stato: true } });
  if (!ordine) return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  if (ordine.tipo !== "domicilio") return NextResponse.json({ error: "Solo le consegne a domicilio hanno un rider" }, { status: 400 });
  if (ordine.stato === "annullato") return NextResponse.json({ error: "Ordine annullato" }, { status: 400 });

  try {
    const [rider] = await prisma.$queryRaw<{ id: string; nome: string; sedeId: string | null; attivo: boolean }[]>`
      SELECT id::text AS "id", nome, sede_id::text AS "sedeId", attivo FROM fattorini WHERE id = ${fattorinoId}::uuid
    `;
    if (!rider || !rider.attivo) return NextResponse.json({ error: "Rider non trovato" }, { status: 404 });
    if (rider.sedeId && rider.sedeId !== ordine.sedeId) return NextResponse.json({ error: "Questo rider è di un'altra sede" }, { status: 403 });

    const [attuale] = await prisma.$queryRaw<{ stato: string }[]>`SELECT stato::text AS "stato" FROM consegne WHERE ordine_id = ${ordineId}::uuid`;
    if (attuale?.stato === "consegnata") return NextResponse.json({ error: "Questa consegna è già stata chiusa da un rider" }, { status: 409 });

    if (ordine.stato === "consegnato") {
      await prisma.$executeRaw`
        INSERT INTO consegne (ordine_id, fattorino_id, stato, assegnata_at, consegnata_at)
        VALUES (${ordineId}::uuid, ${fattorinoId}::uuid, 'consegnata'::consegna_stato, now(), now())
        ON CONFLICT (ordine_id) DO UPDATE
          SET fattorino_id = EXCLUDED.fattorino_id, stato = 'consegnata'::consegna_stato, assegnata_at = now(), consegnata_at = now()
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO consegne (ordine_id, fattorino_id, stato, assegnata_at)
        VALUES (${ordineId}::uuid, ${fattorinoId}::uuid, 'assegnata'::consegna_stato, now())
        ON CONFLICT (ordine_id) DO UPDATE
          SET fattorino_id = EXCLUDED.fattorino_id, stato = 'assegnata'::consegna_stato, assegnata_at = now(), consegnata_at = NULL
      `;
    }
    return NextResponse.json({ ok: true, rider: rider.nome, chiusa: ordine.stato === "consegnato" });
  } catch (e: any) {
    console.error("Conti: assegnazione rider fallita:", e?.message ?? e);
    return NextResponse.json({ error: "Non riesco ad assegnare il rider" }, { status: 500 });
  }
}
