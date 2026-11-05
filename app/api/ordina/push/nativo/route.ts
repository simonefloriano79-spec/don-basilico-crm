import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";

const MAX_TELEFONI_PER_CLIENTE = 5;

// Un token Firebase è una stringa lunga di lettere, numeri e pochi simboli: tutto il resto si scarta.
function tokenValido(t: unknown): t is string {
  return typeof t === "string" && t.length >= 50 && t.length <= 400 && /^[A-Za-z0-9_:\-]+$/.test(t);
}

// POST /api/ordina/push/nativo — collega questo telefono (app Android/iOS) alle notifiche del cliente.
export async function POST(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Accedi per attivare le notifiche" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = body?.token;
  const piattaforma = body?.piattaforma === "ios" ? "ios" : "android";
  if (!tokenValido(token)) return NextResponse.json({ error: "Token non valido" }, { status: 400 });

  try {
    // Se lo stesso telefono era collegato a un altro cliente (telefono condiviso), passa a quello collegato ora.
    await prisma.pushTokenNativo.upsert({
      where: { token },
      create: { clienteId, token, piattaforma },
      update: { clienteId, piattaforma },
    });
    const tutti = await prisma.pushTokenNativo.findMany({ where: { clienteId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (tutti.length > MAX_TELEFONI_PER_CLIENTE) {
      await prisma.pushTokenNativo.deleteMany({ where: { id: { in: tutti.slice(MAX_TELEFONI_PER_CLIENTE).map((t) => t.id) } } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Token push nativo non salvato", err);
    return NextResponse.json({ error: "Non siamo riusciti ad attivare le notifiche, riprova più tardi" }, { status: 500 });
  }
}

// DELETE /api/ordina/push/nativo — scollega questo telefono.
export async function DELETE(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!tokenValido(body?.token)) return NextResponse.json({ error: "Token non valido" }, { status: 400 });
  await prisma.pushTokenNativo.deleteMany({ where: { token: body.token, clienteId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
