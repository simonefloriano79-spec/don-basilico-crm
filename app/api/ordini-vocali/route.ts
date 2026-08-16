import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ordini-vocali — lista per lo schermo cassa (polling).
// Stesso pattern RBAC del resto del CRM: operatori vedono solo la propria sede.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  const sedeFilter = user.ruolo === "super_admin" ? undefined : user.sedeId;

  const ordini = await prisma.ordineVocale.findMany({
    where: {
      ...(sedeFilter && { sedeId: sedeFilter }),
      stato: { not: "annullato" },
    },
    include: { sede: { select: { nome: true } } },
    orderBy: [{ stato: "asc" }, { createdAt: "asc" }],
    take: 100,
  });

  return NextResponse.json(ordini);
}
