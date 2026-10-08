// Regole della tessera fedeltà, senza dipendenze: le usano sia il server (lib/fedelta.ts) sia le schermate dell'app
// (così le scritte «10% di sconto ogni 5 ordini» non si scollegano mai dalla regola vera).
export const TIMBRI_PER_CICLO = 5;
export const PERCENTUALE_SCONTO = 0.1;
export const PERCENTUALE_SCONTO_INTERA = Math.round(PERCENTUALE_SCONTO * 100); // 10
