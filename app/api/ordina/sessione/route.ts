import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth/session";

// GET /api/ordina/sessione — chi è il cliente collegato in questo browser, se c'è.
export async function GET(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  // `staff`: chi è loggato nel CRM può entrare in modalità prova (beta) senza SMS.
  const staff = !!(await getServerSession(authOptions).catch(() => null));
  if (!clienteId) return NextResponse.json({ cliente: null, staff });

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, telefono: true, indirizzoDefault: true },
  });
  return NextResponse.json({ cliente: cliente ?? null, staff });
}

// DELETE /api/ordina/sessione — logout.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(CUSTOMER_SESSION_COOKIE);
  return res;
}
