import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";

// POST /api/ordina/privacy — il cliente già registrato accetta l'informativa (e, se vuole, il marketing).
export async function POST(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.privacy !== true) return NextResponse.json({ error: "Per continuare devi accettare l'informativa privacy" }, { status: 400 });

  const adesso = new Date();
  await prisma.cliente.update({
    where: { id: clienteId },
    data: { privacyAt: adesso, ...(body.marketing === true ? { marketingAt: adesso } : {}) },
  });
  return NextResponse.json({ ok: true });
}
