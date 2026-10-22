import { prisma } from "@/lib/prisma";

// Ricerca di una pizza per INGREDIENTI («patate e salsiccia» → Campagnola), per quando il cliente non dice il nome.
// Gli ingredienti di ogni pizza sono già nel database: qui si confrontano le parole del cliente con quelle degli
// ingredienti, tollerando singolare/plurale («patate» = «Patate alla brace») e piccoli errori di trascrizione.

const PAROLE_VUOTE = new Set([
  "e", "ed", "con", "di", "del", "dei", "della", "delle", "dello", "degli", "la", "il", "lo", "le", "i", "gli",
  "un", "una", "uno", "alla", "al", "allo", "ai", "alle", "agli", "pizza", "pizze", "vorrei", "quella", "quello",
  "che", "ha", "hanno", "mi", "per", "in", "su", "tipo", "poi", "anche", "più", "senza", "extra",
  // come si chiede una pizza a voce, e le quantità
  "fai", "fammi", "faresti", "farei", "vorrei", "voglio", "volevo", "vorremmo", "prendo", "prenderei", "metti", "mettimi",
  "dammi", "darei", "desidero", "gradirei", "ordino", "ordinare", "aggiungi", "aggiungere", "due", "tre", "quattro", "cinque",
]);

// «patate» e «patata» → «patat»; «salsiccia» e «salsicce» → «salsicc». Togliere le vocali finali basta a far coincidere
// singolare e plurale senza confondere «patate» con «patatine» (che resta «patatin»).
const radice = (parola: string) => parola.replace(/[aeiou]+$/, "") || parola;

const senzaAccenti = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const parole = (s: string) => senzaAccenti(s).split(/[^a-z0-9]+/).filter(Boolean);

function distanzaUno(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const paroleUguali = (token: string, parolaIngrediente: string) => {
  const a = radice(token);
  const b = radice(parolaIngrediente);
  return a === b || distanzaUno(a, b);
};

// Le parole che contano di una richiesta, ridotte alla radice (senza «una», «e», «pizza»…): serve a confrontare
// «una prosciutto e funghi» con «funghi e prosciutto» come la stessa cosa.
export const radiciRichiesta = (richiesta: string): string[] =>
  parole(richiesta).filter((t) => t.length >= 3 && !PAROLE_VUOTE.has(t)).map(radice);

interface PizzaConIngredienti {
  id: string;
  categoria: string;
  nome: string;
  ingredienti: { id: string; nome: string; radici: string[] }[];
}

let cache: { alle: number; pizze: PizzaConIngredienti[] } | null = null;
const DURATA_CACHE_MS = 5 * 60 * 1000;

async function pizzeConIngredienti(): Promise<PizzaConIngredienti[]> {
  if (cache && Date.now() - cache.alle < DURATA_CACHE_MS) return cache.pizze;
  const righe = await prisma.menuItem.findMany({
    where: { isAttivo: true, categoria: { not: "combo" }, ingredienti: { some: {} } },
    select: { id: true, nome: true, categoria: true, ingredienti: { select: { ingrediente: { select: { id: true, nome: true } } } } },
  });
  const pizze = righe.map((r) => ({
    id: r.id,
    categoria: r.categoria as string,
    nome: r.nome,
    ingredienti: r.ingredienti.map((i) => ({ id: i.ingrediente.id, nome: i.ingrediente.nome, radici: parole(i.ingrediente.nome) })),
  }));
  cache = { alle: Date.now(), pizze };
  return pizze;
}

export interface RisultatoIngredienti {
  /** Pizze che contengono TUTTI gli ingredienti nominati (almeno due), dalla più «semplice» alla più ricca. */
  coprono: { id: string; ingredientiTrovati: string[] }[];
  /** Pizze che ne contengono almeno uno (usate solo se la richiesta nomina un solo ingrediente). */
  parziali: { id: string; ingredientiTrovati: string[] }[];
}

// Le parole della richiesta che corrispondono a un ingrediente di una pizza (per ciascuna pizza).
export async function cercaPerIngredienti(richiesta: string): Promise<RisultatoIngredienti> {
  const tokens = parole(richiesta).filter((t) => t.length >= 3 && !PAROLE_VUOTE.has(t));
  if (!tokens.length) return { coprono: [], parziali: [] };

  // I calzoni si propongono solo se il cliente li nomina; «Crea la tua pizza» non è una pizza da proporre.
  const vuoleCalzone = /calzon/i.test(richiesta);
  const pizze = (await pizzeConIngredienti()).filter((p) => (vuoleCalzone || p.categoria !== "calzoni") && !/crea la tua/i.test(p.nome));

  // Una parola conta solo se corrisponde a un ingrediente reale (così «margherita» o «diavola» non diventano ingredienti).
  const tokenIngrediente = tokens.filter((t) => pizze.some((p) => p.ingredienti.some((i) => i.radici.some((r) => paroleUguali(t, r)))));
  if (!tokenIngrediente.length) return { coprono: [], parziali: [] };

  const esiti = pizze
    .map((p) => {
      const trovati = new Map<string, string>(); // token → nome ingrediente
      for (const t of tokenIngrediente) {
        const ing = p.ingredienti.find((i) => i.radici.some((r) => paroleUguali(t, r)));
        if (ing) trovati.set(t, ing.nome);
      }
      return { id: p.id, trovati: trovati.size, totale: p.ingredienti.length, ingredientiTrovati: Array.from(trovati.values()) };
    })
    .filter((e) => e.trovati > 0);

  const richiesti = tokenIngrediente.length;
  // A parità di ingredienti nominati, vince la pizza con meno ingredienti in più (più vicina a ciò che ha chiesto).
  const ordina = (a: { totale: number }, b: { totale: number }) => a.totale - b.totale;
  const coprono = richiesti >= 2 ? esiti.filter((e) => e.trovati === richiesti).sort(ordina) : [];
  const parziali = esiti.filter((e) => e.trovati < richiesti || richiesti === 1).sort((a, b) => b.trovati - a.trovati || ordina(a, b));

  return {
    coprono: coprono.map((e) => ({ id: e.id, ingredientiTrovati: e.ingredientiTrovati })),
    parziali: parziali.map((e) => ({ id: e.id, ingredientiTrovati: e.ingredientiTrovati })),
  };
}
