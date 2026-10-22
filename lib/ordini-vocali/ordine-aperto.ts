import { prisma } from "@/lib/prisma";
import { finestraCliente, MAX_MODIFICHE_CLIENTE } from "@/lib/modifica-ordine";
import { FILTRO_ACCETTAZIONE } from "@/lib/accettazione";
import { trovaClientePerTelefono } from "./cliente";
import type { ArticoloOrdinatoInput } from "./pricing";

// Un ordine fatto da poco (app o assistente) che il cliente può ancora cambiare o annullare chiamando di nuovo:
// stesse regole dell'app (lib/modifica-ordine.ts): fino a 30 minuti prima dell'orario concordato, finché non è in
// preparazione, al massimo 2 modifiche.

interface RigaOrdine {
  menuItemId: string | null;
  nomeSnapshot: string;
  quantita: number;
  noteItem: string | null;
  notaCliente: string | null;
  ingredientiRimossi: string[];
  ingredientiAggiunti: string[];
  impastoId: string | null;
  comboScelte: unknown;
}

// Le righe salvate → gli articoli nel formato di `prepara_ordine`, per rimandarli (modificati) al calcolo.
export function articoliDaRighe(righe: RigaOrdine[]): ArticoloOrdinatoInput[] {
  return righe
    .filter((r) => r.menuItemId)
    .map((r) => {
      const sc = (r.comboScelte && typeof r.comboScelte === "object" ? r.comboScelte : {}) as any;
      const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
      return {
        menuItemId: r.menuItemId!,
        quantita: r.quantita,
        taglia: /\(maxi\)/i.test(r.nomeSnapshot) ? ("maxi" as const) : ("normale" as const),
        ingredientiAggiuntiIds: r.ingredientiAggiunti,
        ingredientiRimossi: r.ingredientiRimossi,
        impastoId: r.impastoId ?? undefined,
        note: r.notaCliente ?? undefined,
        ...(typeof sc.secondaMeta === "string" ? { secondaMeta: sc.secondaMeta } : {}),
        ...(sc.bibite || sc.pizze ? { comboScelte: { bibite: lista(sc.bibite), pizze: lista(sc.pizze) } } : {}),
      };
    });
}

export const euroTesto = (n: number) => n.toFixed(2).replace(".", ",");

export type OrdineAperto =
  | {
      modificabile: true;
      id: string;
      numeroOrdine: number;
      stato: string;
      tipo: string;
      sedeSlug: string;
      sedeNome: string;
      indirizzo: string | null;
      nomeCitofono: string | null;
      metodoPagamento: string | null;
      oraRichiesta: string;
      note: string | null;
      totale: number;
      modificheRimaste: number;
      righe: string[];
      articoli: ArticoloOrdinatoInput[];
    }
  | { modificabile: false; numeroOrdine: number; motivo: string; puoAnnullare: boolean; id?: string };

// L'ordine più recente del cliente (ultime 24 ore, non ancora in preparazione) o, se non si può più cambiare, perché.
export async function trovaOrdineAperto(telefono: string): Promise<OrdineAperto | null> {
  const cliente = await trovaClientePerTelefono(telefono);
  if (!cliente) return null;

  const ordine = await prisma.ordine.findFirst({
    where: {
      clienteId: cliente.id,
      ...FILTRO_ACCETTAZIONE,
      stato: { in: ["nuovo", "confermato"] },
      createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    include: {
      sede: { select: { slug: true, nome: true } },
      items: {
        select: {
          menuItemId: true, nomeSnapshot: true, quantita: true, noteItem: true, notaCliente: true,
          ingredientiRimossi: true, ingredientiAggiunti: true, impastoId: true, comboScelte: true,
        },
      },
    },
  });
  if (!ordine) return null;

  const f = finestraCliente(ordine);
  if (!f.puoAnnullare) return { modificabile: false, numeroOrdine: ordine.numeroOrdine, motivo: f.motivo ?? "L'ordine non si può più cambiare", puoAnnullare: false };
  const articoli = articoliDaRighe(ordine.items);
  const ricostruibile = ordine.items.length > 0 && ordine.items.every((i) => !!i.menuItemId);
  if (!ricostruibile) return { modificabile: false, numeroOrdine: ordine.numeroOrdine, motivo: "Questo ordine si può solo annullare: per modificarlo chiama la pizzeria.", puoAnnullare: true, id: ordine.id };
  if (!f.puoModificare) return { modificabile: false, numeroOrdine: ordine.numeroOrdine, motivo: f.motivo ?? "L'ordine non si può più modificare", puoAnnullare: true, id: ordine.id };

  return {
    modificabile: true,
    id: ordine.id,
    numeroOrdine: ordine.numeroOrdine,
    stato: ordine.stato,
    tipo: ordine.tipo,
    sedeSlug: ordine.sede.slug,
    sedeNome: ordine.sede.nome,
    indirizzo: ordine.clienteIndirizzo,
    nomeCitofono: ordine.nomeCitofono,
    metodoPagamento: ordine.metodoPagamento,
    oraRichiesta: (ordine.oraConsegnaComunicata ?? ordine.oraRichiesta).toISOString(),
    note: ordine.note,
    totale: parseFloat(ordine.totale.toString()),
    modificheRimaste: MAX_MODIFICHE_CLIENTE - ordine.modificheCliente,
    righe: ordine.items.map((i) => `${i.quantita}x ${i.nomeSnapshot}${i.noteItem ? ` (${i.noteItem})` : ""}`),
    articoli,
  };
}
