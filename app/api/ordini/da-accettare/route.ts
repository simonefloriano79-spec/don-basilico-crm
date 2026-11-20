import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FILTRO_ACCETTAZIONE } from "@/lib/accettazione";

// GET /api/ordini/da-accettare — quanti ordini online attendono l'accettazione
// (della sede dell'utente, o di tutte per il super admin): per il contatore in sidebar.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  // `ids`: gli ordini in attesa, così il pannello sa quali ha già mostrato (smette di suonare per quelli visualizzati).
  const inAttesa = await prisma.ordine.findMany({
    where: {
      ...FILTRO_ACCETTAZIONE,
      stato: "nuovo",
      ...(user.ruolo !== "super_admin" && user.sedeId ? { sedeId: user.sedeId } : {}),
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const n = inAttesa.length;
  const ids = inAttesa.map((o) => o.id);
  const sospese = await prisma.sede.findMany({
    where: { attiva: true, ordiniOnlineAttivi: false, ...(user.ruolo !== "super_admin" && user.sedeId ? { id: user.sedeId } : {}) },
    select: { id: true, nome: true },
  });
  return NextResponse.json({ n, ids, sospese });
}
