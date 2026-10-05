import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteIdDaRichiesta } from "@/lib/customer-auth/session";
import { statoTessera, TIMBRI_PER_CICLO } from "@/lib/fedelta";

// GET /api/ordina/tessera — stato della tessera fedeltà del cliente collegato (timbri e sconto maturato).
export async function GET(req: NextRequest) {
  const clienteId = clienteIdDaRichiesta(req);
  if (!clienteId) return NextResponse.json({ tessera: null });
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { telefono: true } });
  if (!cliente?.telefono) return NextResponse.json({ tessera: null });

  const stato = await statoTessera(cliente.telefono).catch(() => null);
  if (!stato) return NextResponse.json({ tessera: null, perCiclo: TIMBRI_PER_CICLO });
  return NextResponse.json({
    perCiclo: TIMBRI_PER_CICLO,
    tessera: {
      token: stato.token,
      timbri: stato.timbri,
      totaleCiclo: stato.totaleCiclo,
      scontoDisponibile: stato.scontoDisponibile,
      importoSconto: stato.importoSconto,
    },
  });
}
