import { ALLERGENI } from "@/lib/allergeni";

// Controllo dei dati di un prodotto del menù scritti dal modulo «Nuova voce» / «Modifica» (POST e PATCH /api/menu).

export const CATEGORIE_PRODOTTO = ["combo", "pizze_rosse", "pizze_bianche", "calzoni", "focacce", "menu_speciale", "fritti", "bevande", "dolci", "extra"];

export interface DatiProdotto {
  nome?: string;
  descrizione?: string | null;
  categoria?: string;
  prezzoBase?: number;
  prezzoOnline?: number | null;
  allergeniExtra?: string[];
  allergeniDaVerificare?: boolean;
  ingredientiIds?: string[];
}

const prezzo = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
};

// `nuovo`: nome, categoria e prezzo sono obbligatori. In modifica si cambiano solo i campi mandati.
// I «Menù Combo» si possono creare solo dal super admin (la loro composizione si configura a parte).
export function leggiProdotto(body: any, { nuovo, isSuperAdmin }: { nuovo: boolean; isSuperAdmin: boolean }): DatiProdotto | { errore: string } {
  const d: DatiProdotto = {};

  if (nuovo || body.nome !== undefined) {
    const nome = String(body.nome ?? "").trim().slice(0, 60);
    if (!nome) return { errore: "Scrivi il nome del prodotto" };
    d.nome = nome;
  }
  if (nuovo || body.categoria !== undefined) {
    if (!CATEGORIE_PRODOTTO.includes(body.categoria) || (body.categoria === "combo" && !isSuperAdmin)) return { errore: "Categoria non valida" };
    d.categoria = body.categoria;
  }
  if (nuovo || body.prezzoBase !== undefined) {
    const p = prezzo(body.prezzoBase);
    if (p === null) return { errore: "Prezzo non valido" };
    d.prezzoBase = p;
  }
  if (body.prezzoOnline !== undefined) {
    if (body.prezzoOnline === null || body.prezzoOnline === "") d.prezzoOnline = null;
    else {
      const p = prezzo(body.prezzoOnline);
      if (p === null) return { errore: "Prezzo app non valido" };
      d.prezzoOnline = p;
    }
  }
  if (body.descrizione !== undefined) d.descrizione = String(body.descrizione ?? "").trim().slice(0, 200) || null;
  if (Array.isArray(body.allergeniExtra)) {
    d.allergeniExtra = ALLERGENI.map((a) => a.codice).filter((c) => body.allergeniExtra.includes(c));
  }
  // Finché nessuno dichiara di aver controllato gli allergeni, l'app dice al cliente di chiedere al personale.
  if (typeof body.allergeniDaVerificare === "boolean") d.allergeniDaVerificare = body.allergeniDaVerificare;
  else if (nuovo) d.allergeniDaVerificare = true;
  if (Array.isArray(body.ingredientiIds)) {
    d.ingredientiIds = Array.from(new Set(body.ingredientiIds.filter((x: unknown): x is string => typeof x === "string")));
  }
  return d;
}
