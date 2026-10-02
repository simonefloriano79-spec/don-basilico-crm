import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth/session";

// GET /api/ordina/sessione — chi è il cliente collegato in questo browser, se c'è.
export async function GET(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ cliente: null });

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, telefono: true, indirizzoDefault: true },
  });
  return NextResponse.json({ cliente: cliente ?? null });
}

// DELETE /api/ordina/sessione — logout.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(CUSTOMER_SESSION_COOKIE);
  return res;
}
