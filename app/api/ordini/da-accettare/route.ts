import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ordini/da-accettare — quanti ordini online attendono l'accettazione
// (della sede dell'utente, o di tutte per il super admin): per il contatore in sidebar.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const n = await prisma.ordine.count({
    where: {
      canale: "online",
      stato: "nuovo",
      ...(user.ruolo !== "super_admin" && user.sedeId ? { sedeId: user.sedeId } : {}),
    },
  });
  const sospese = await prisma.sede.findMany({
    where: { attiva: true, ordiniOnlineAttivi: false, ...(user.ruolo !== "super_admin" && user.sedeId ? { id: user.sedeId } : {}) },
    select: { id: true, nome: true },
  });
  return NextResponse.json({ n, sospese });
}
