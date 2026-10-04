import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { etichettaGiorno, oraLocaleHHMM } from "@/lib/slot-ritiro";

// "alle 20:40" / "domani alle 20:40" / "03/10 alle 20:40"
export function descriviOrario(istante: Date): string {
  const giorno = etichettaGiorno(istante);
  return `${giorno === "oggi" ? "" : giorno + " "}alle ${oraLocaleHHMM(istante)}`;
}

export function euroSms(n: number): string {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

// Autenticazione staff + caricamento ordine + controllo sede (stesso criterio di app/api/ordini/[id]).
export async function caricaOrdineStaff(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { errore: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) } as const;
  const user = session.user as any;

  const ordine = await prisma.ordine.findUnique({
    where: { id },
    include: { sede: { select: { nome: true } } },
  });
  if (!ordine) return { errore: NextResponse.json({ error: "Non trovato" }, { status: 404 }) } as const;
  if (user.ruolo !== "super_admin" && ordine.sedeId !== user.sedeId) {
    return { errore: NextResponse.json({ error: "Permesso negato" }, { status: 403 }) } as const;
  }
  return { ordine, user } as const;
}

export function leggiOrario(valore: unknown): Date | null {
  const d = new Date(String(valore ?? ""));
  return Number.isNaN(d.getTime()) ? null : d;
}
