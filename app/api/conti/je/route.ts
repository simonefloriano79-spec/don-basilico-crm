import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dataValida } from "@/lib/conti";

// PUT /api/conti/je — { sedeId, data, giaPagato, contanti }: incasso Just Eat della serata, inserito a mano dalla sede.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  const body = await req.json().catch(() => ({}));

  const sedeId = String(body.sedeId ?? "");
  if (!sedeId) return NextResponse.json({ error: "Scegli una sede" }, { status: 400 });
  if (user.ruolo !== "super_admin" && user.sedeId !== sedeId) return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  if (!dataValida(body.data)) return NextResponse.json({ error: "Data non valida" }, { status: 400 });

  const giaPagato = Number(String(body.giaPagato ?? 0).replace(",", "."));
  const contanti = Number(String(body.contanti ?? 0).replace(",", "."));
  if (![giaPagato, contanti].every((n) => Number.isFinite(n) && n >= 0 && n < 100000)) {
    return NextResponse.json({ error: "Importi non validi" }, { status: 400 });
  }

  const giorno = new Date(body.data + "T00:00:00Z");
  try {
    await prisma.contiJe.upsert({
      where: { sedeId_giorno: { sedeId, giorno } },
      create: { sedeId, giorno, giaPagato, contanti, utenteId: user.id ?? null, utenteNome: user.name ?? null },
      update: { giaPagato, contanti, utenteId: user.id ?? null, utenteNome: user.name ?? null },
    });
  } catch (e: any) {
    console.error("Conti Just Eat non salvato:", e?.message ?? e);
    return NextResponse.json({ error: "Non riesco a salvare: controlla che il database sia aggiornato (manca la tabella conti_je)" }, { status: 500 });
  }

  // Pizze Just Eat: colonna aggiunta dopo (prisma/sql/conti_je_pizze.sql). Salvata a parte, così gli importi si salvano comunque.
  const pizze = Math.round(Number(String(body.pizze ?? 0).replace(",", ".")));
  if (!Number.isFinite(pizze) || pizze < 0 || pizze > 5000) return NextResponse.json({ error: "Numero di pizze non valido" }, { status: 400 });
  try {
    await prisma.$executeRaw`UPDATE conti_je SET pizze = ${pizze} WHERE sede_id = ${sedeId}::uuid AND giorno = ${body.data}::date`;
  } catch (e: any) {
    console.error("Pizze Just Eat non salvate:", e?.message ?? e);
    return NextResponse.json({ error: "Importi salvati, ma le pizze no: manca la colonna nel database (SQL conti_je_pizze da eseguire)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
