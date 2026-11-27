import { prisma } from "@/lib/prisma";
import { ingredientiDellaSede } from "@/lib/menu-sede";

// Vero se tutti gli ingredienti scelti si possono usare in un prodotto di quella sede (o comune, se sedeId è vuoto).
export async function ingredientiAmmessi(ids: string[] | undefined, sedeId: string | null) {
  if (!ids?.length) return true;
  const trovati = await prisma.ingrediente.count({ where: { id: { in: ids }, ...ingredientiDellaSede(sedeId) } });
  return trovati === ids.length;
}
