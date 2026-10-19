import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { endpointPushValido } from "@/lib/push";

const MAX_TELEFONI_PER_CLIENTE = 5;

// POST /api/ordina/push — iscrive questo telefono alle notifiche del cliente collegato.
export async function POST(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Accedi per attivare le notifiche" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sub = body?.subscription;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpointPushValido(sub?.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "Iscrizione non valida" }, { status: 400 });
  }

  try {
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 200) || null;
    // Se lo stesso telefono era iscritto a un altro cliente (telefono condiviso), passa a quello collegato ora.
    await prisma.pushIscrizione.upsert({
      where: { endpoint: sub.endpoint },
      create: { clienteId, endpoint: sub.endpoint, p256dh, auth, userAgent },
      update: { clienteId, p256dh, auth, userAgent },
    });
    // Tiene al massimo gli ultimi telefoni iscritti.
    const tutte = await prisma.pushIscrizione.findMany({ where: { clienteId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (tutte.length > MAX_TELEFONI_PER_CLIENTE) {
      await prisma.pushIscrizione.deleteMany({ where: { id: { in: tutte.slice(MAX_TELEFONI_PER_CLIENTE).map((t) => t.id) } } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Iscrizione push non salvata", err);
    return NextResponse.json({ error: "Non siamo riusciti ad attivare le notifiche, riprova più tardi" }, { status: 500 });
  }
}

// DELETE /api/ordina/push — toglie l'iscrizione di questo telefono.
export async function DELETE(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ error: "Sessione scaduta" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!endpointPushValido(body?.endpoint)) return NextResponse.json({ error: "Iscrizione non valida" }, { status: 400 });
  await prisma.pushIscrizione.deleteMany({ where: { endpoint: body.endpoint, clienteId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
