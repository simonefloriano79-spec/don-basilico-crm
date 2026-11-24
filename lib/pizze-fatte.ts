import { prisma } from "@/lib/prisma";
import { pesoRiga } from "@/lib/peso-pizze";
import { leggiComboConfig } from "@/lib/combo";

// Contatore delle pizze della serata: pizze rosse/bianche, speciali e calzoni a pezzo (una maxi è UNA pizza, contata anche
// a parte), più le pizze contenute nei «Menù Combo». Fritti, bevande, dolci ed extra non contano.
// Stesse regole della capienza cucina (lib/peso-pizze.ts), ma la maxi vale 1 invece di 2.

export interface PizzeSede { pizze: number; maxi: number }

// Pizze di una riga d'ordine (e quante sono maxi). Una maxi vale 1; i combo valgono le pizze che contengono.
export function pizzeRiga(categoria: string | null | undefined, nomeSnapshot: string, quantita: number, pizzeCombo?: number | null): { pizze: number; maxi: number } {
  const peso = pesoRiga(categoria, nomeSnapshot, quantita, pizzeCombo);
  if (!peso) return { pizze: 0, maxi: 0 };
  const maxi = categoria !== "combo" && /\(maxi\)/i.test(nomeSnapshot);
  return { pizze: maxi ? peso / 2 : peso, maxi: maxi ? quantita : 0 };
}

// Pizze Just Eat inserite a mano, per serata (stringa yyyy-MM-dd) dal giorno `dal` in poi. Mappa vuota se manca la colonna.
export async function pizzeJePerGiorno(dal: string, sedeId?: string): Promise<Map<string, number>> {
  const per = new Map<string, number>();
  try {
    const righe = sedeId
      ? await prisma.$queryRaw<{ giorno: string; pizze: number }[]>`SELECT giorno::text AS "giorno", SUM(pizze)::int AS "pizze" FROM conti_je WHERE giorno >= ${dal}::date AND sede_id = ${sedeId}::uuid GROUP BY giorno`
      : await prisma.$queryRaw<{ giorno: string; pizze: number }[]>`SELECT giorno::text AS "giorno", SUM(pizze)::int AS "pizze" FROM conti_je WHERE giorno >= ${dal}::date GROUP BY giorno`;
    righe.forEach((r) => per.set(r.giorno, Number(r.pizze) || 0));
  } catch (e: any) {
    console.error("Pizze Just Eat per giorno non leggibili:", e?.message ?? e);
  }
  return per;
}

// Pizze degli ordini non annullati creati in [inizio, fine), per sede.
export async function pizzePerSede(inizio: Date, fine: Date, sedeId?: string): Promise<Map<string, PizzeSede>> {
  const ordini = await prisma.ordine.findMany({
    where: { ...(sedeId && { sedeId }), createdAt: { gte: inizio, lt: fine }, stato: { not: "annullato" } },
    select: {
      sedeId: true,
      items: {
        select: {
          quantita: true, nomeSnapshot: true,
          menuItem: { select: { categoria: true, comboConfig: true } },
          sedeExtra: { select: { categoria: true } },
        },
      },
    },
  });

  const per = new Map<string, PizzeSede>();
  for (const o of ordini) {
    const s = per.get(o.sedeId) ?? { pizze: 0, maxi: 0 };
    for (const i of o.items) {
      const cat = i.menuItem?.categoria ?? i.sedeExtra?.categoria;
      const peso = pesoRiga(cat, i.nomeSnapshot, i.quantita, leggiComboConfig(i.menuItem?.comboConfig)?.pizze);
      if (!peso) continue;
      const maxi = cat !== "combo" && /\(maxi\)/i.test(i.nomeSnapshot);
      s.pizze += maxi ? peso / 2 : peso;
      if (maxi) s.maxi += i.quantita;
    }
    per.set(o.sedeId, s);
  }
  return per;
}

// Pizze Just Eat inserite a mano (colonna `pizze` di conti_je, aggiunta con prisma/sql/conti_je_pizze.sql).
// Se la colonna non c'è ancora restituisce una mappa vuota e `ok: false`.
export async function pizzeJePerSede(giorno: string, sedeId?: string): Promise<{ ok: boolean; per: Map<string, number> }> {
  const per = new Map<string, number>();
  try {
    const righe = sedeId
      ? await prisma.$queryRaw<{ sedeId: string; pizze: number }[]>`SELECT sede_id::text AS "sedeId", pizze FROM conti_je WHERE giorno = ${giorno}::date AND sede_id = ${sedeId}::uuid`
      : await prisma.$queryRaw<{ sedeId: string; pizze: number }[]>`SELECT sede_id::text AS "sedeId", pizze FROM conti_je WHERE giorno = ${giorno}::date`;
    righe.forEach((r) => per.set(r.sedeId, Number(r.pizze) || 0));
    return { ok: true, per };
  } catch (e: any) {
    console.error("Pizze Just Eat non leggibili (manca la colonna pizze?):", e?.message ?? e);
    return { ok: false, per };
  }
}
