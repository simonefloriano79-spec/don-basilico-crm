import { testoImpasto } from "@/lib/impasti";
import type { ArticoloPrezzato } from "@/lib/ordini-vocali/pricing";

// Righe di un ordine online come si salvano nel database: sia alla creazione (conferma) sia alla modifica.
// Oltre alla nota leggibile («Senza: … | Con: … | …») si salvano le scelte in forma strutturata, così l'ordine si può
// rimettere nel carrello per modificarlo.
export function righeOrdineDaArticoli(articoli: ArticoloPrezzato[]) {
  return articoli.map((a) => ({
    menuItemId: a.menuItemId,
    nomeSnapshot: a.taglia === "maxi" ? `${a.nomeSnapshot} (Maxi)` : a.nomeSnapshot,
    prezzoSnapshot: a.prezzoSnapshot,
    quantita: a.quantita,
    ingredientiRimossi: a.rimossi.map((r) => r.ingredienteId),
    ingredientiAggiunti: a.extra.map((e) => e.ingredienteId),
    notaCliente: a.note ?? null,
    impastoId: a.impasto?.id ?? null,
    impasto: a.impasto?.nome ?? null,
    noteItem:
      [
        a.impasto ? testoImpasto(a.impasto.nome) : "",
        a.rimossi.length ? `Senza: ${a.rimossi.map((r) => r.nome).join(", ")}` : "",
        a.extra.length ? `Con: ${a.extra.map((e) => e.nome).join(", ")}` : "",
        a.note ?? "",
      ]
        .filter(Boolean)
        .join(" | ") || null,
  }));
}
