import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function autorizza(sedeId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { err: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) } as const;
  const user = session.user as any;
  if (user.ruolo !== "super_admin" && !(user.ruolo === "sede_manager" && user.sedeId === sedeId)) {
    return { err: NextResponse.json({ error: "Permesso negato" }, { status: 403 }) } as const;
  }
  return { ok: true } as const;
}

// GET /api/sedi/[id]/impasti — tutti gli impasti speciali con l'indicazione se la pizzeria li fa.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await autorizza(params.id);
  if ("err" in a) return a.err;
  const [tutti, attivi] = await Promise.all([
    prisma.impasto.findMany({ where: { attivo: true }, orderBy: { ordine: "asc" } }),
    prisma.sedeImpasto.findMany({ where: { sedeId: params.id }, select: { impastoId: true } }),
  ]);
  const set = new Set(attivi.map((x) => x.impastoId));
  return NextResponse.json({
    impasti: tutti.map((i) => ({ id: i.id, nome: i.nome, supplemento: parseFloat(i.supplemento.toString()), inSede: set.has(i.id) })),
  });
}

// PUT /api/sedi/[id]/impasti — { impastoIds: string[] }: l'elenco completo degli impasti che la pizzeria prepara.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await autorizza(params.id);
  if ("err" in a) return a.err;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.impastoIds) ? body.impastoIds.filter((x: unknown) => typeof x === "string") : [];

  const validi = await prisma.impasto.findMany({ where: { id: { in: ids }, attivo: true }, select: { id: true } });
  await prisma.$transaction([
    prisma.sedeImpasto.deleteMany({ where: { sedeId: params.id } }),
    prisma.sedeImpasto.createMany({ data: validi.map((v) => ({ sedeId: params.id, impastoId: v.id })) }),
  ]);
  return NextResponse.json({ ok: true, attivi: validi.length });
}
