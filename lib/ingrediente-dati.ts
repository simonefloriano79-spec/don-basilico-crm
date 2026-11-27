import { ALLERGENI } from "@/lib/allergeni";

// Controllo dei dati di un ingrediente scritti dalla pagina «Ingredienti» (nuovo o modifica).
export interface DatiIngrediente {
  nome?: string;
  prezzoAggiunta?: number;
  allergeni?: string[];
  isAllergene?: boolean;
  allergeniDaVerificare?: boolean;
  escludiCompensazione?: boolean;
}

export function leggiIngrediente(body: any, { nuovo }: { nuovo: boolean }): DatiIngrediente | { errore: string } {
  const d: DatiIngrediente = {};
  if (nuovo || body.nome !== undefined) {
    const nome = String(body.nome ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!nome) return { errore: "Scrivi il nome dell'ingrediente" };
    d.nome = nome;
  }
  if (nuovo || body.prezzoAggiunta !== undefined) {
    const p = Number(String(body.prezzoAggiunta ?? "").replace(",", ".") || 0);
    if (!Number.isFinite(p) || p < 0 || p >= 100) return { errore: "Prezzo non valido" };
    d.prezzoAggiunta = Math.round(p * 100) / 100;
  }
  if (Array.isArray(body.allergeni)) {
    d.allergeni = ALLERGENI.map((a) => a.codice).filter((c) => body.allergeni.includes(c));
    d.isAllergene = d.allergeni.length > 0;
  }
  // Finché nessuno dichiara di aver controllato gli allergeni, l'app dice al cliente di chiedere al personale.
  if (typeof body.allergeniDaVerificare === "boolean") d.allergeniDaVerificare = body.allergeniDaVerificare;
  else if (nuovo) d.allergeniDaVerificare = true;
  if (typeof body.escludiCompensazione === "boolean") d.escludiCompensazione = body.escludiCompensazione;
  return d;
}
