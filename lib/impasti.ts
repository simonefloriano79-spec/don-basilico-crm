import { prisma } from "@/lib/prisma";

// Gli impasti speciali si scelgono su pizze (rosse, bianche, speciali, «Crea la tua pizza») e focacce: non su calzoni,
// fritti o bevande. Il «classico» è l'impasto di base: sempre incluso, senza supplemento, non è in elenco.
export const CATEGORIE_IMPASTO = new Set(["pizze_rosse", "pizze_bianche", "menu_speciale", "focacce"]);

export interface ImpastoDisponibile {
  id: string;
  nome: string;
  descrizione: string | null;
  supplemento: number;
}

// Impasti speciali che una pizzeria prepara (in ordine di elenco).
export async function impastiDellaSede(sedeId: string): Promise<ImpastoDisponibile[]> {
  const righe = await prisma.sedeImpasto.findMany({
    where: { sedeId, impasto: { attivo: true } },
    include: { impasto: true },
    orderBy: { impasto: { ordine: "asc" } },
  });
  return righe.map((r) => ({
    id: r.impasto.id,
    nome: r.impasto.nome,
    descrizione: r.impasto.descrizione,
    supplemento: parseFloat(r.impasto.supplemento.toString()),
  }));
}

export const testoImpasto = (nome: string) => `IMPASTO ${nome.toUpperCase()}`;
