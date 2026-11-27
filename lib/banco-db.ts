import { prisma } from "@/lib/prisma";

export type VenditaBanco = {
  id: string; sedeId: string; margherita: number; farcito: number; speciale: number; totale: number; createdAt: Date;
};

// Vendite al banco non annullate create da `inizio` (e prima di `fine`, se c'è). Se la tabella non c'è ancora
// restituisce una lista vuota: Conti, Panoramica e Statistiche non si devono mai fermare per questo.
export async function venditeBanco(inizio: Date, fine?: Date, sedeId?: string): Promise<VenditaBanco[]> {
  try {
    const righe = await prisma.venditaBanco.findMany({
      where: { annullata: false, createdAt: { gte: inizio, ...(fine && { lt: fine }) }, ...(sedeId && { sedeId }) },
      orderBy: { createdAt: "desc" },
    });
    return righe.map((r) => ({ ...r, totale: parseFloat(r.totale.toString()) }));
  } catch (e: any) {
    console.error("Vendite al banco non leggibili:", e?.message ?? e);
    return [];
  }
}
