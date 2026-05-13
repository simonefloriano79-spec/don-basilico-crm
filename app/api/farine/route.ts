import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/farine
export async function GET() {
  const farine = await (prisma as any).farineSpeciali.findMany({
    where: { disponibile: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(farine);
}

// PATCH /api/farine — admin aggiorna prezzo/disponibilità
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const { id, prezzoExtra, disponibile } = await req.json();

  const updated = await (prisma as any).farineSpeciali.update({
    where: { id },
    data: {
      ...(prezzoExtra !== undefined && { prezzoExtra }),
      ...(disponibile !== undefined && { disponibile }),
    },
  });

  return NextResponse.json(updated);
}
