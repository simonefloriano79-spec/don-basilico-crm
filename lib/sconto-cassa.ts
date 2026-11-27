// Sconto netto in euro scritto in cassa: mai negativo e mai più di quanto c'è da pagare (puro: cassa e server).
export function scontoCassaValido(scritto: unknown, daPagare: number): number {
  const n = parseFloat(String(scritto ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(Math.min(n, daPagare) * 100) / 100;
}
