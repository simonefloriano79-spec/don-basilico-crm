// Un «battito» regolare che continua anche quando la finestra è coperta da un'altra o la scheda è dietro.
// Chrome rallenta i timer normali (setInterval) delle pagine nascoste: dopo pochi minuti scattano UNA VOLTA AL MINUTO, e un
// pannello ordini che controlla i nuovi ordini con quei timer sembra «addormentato» finché non lo si rimette davanti.
// I timer dentro un Web Worker non vengono rallentati: il worker batte, la pagina reagisce ai messaggi.
// Restituisce la funzione per fermarlo. Se i worker non sono disponibili ricade su setInterval.
export function avviaBattito(ms: number, alBattito: () => void): () => void {
  try {
    const blob = new Blob([`setInterval(function(){postMessage(1)},${Math.max(250, Math.round(ms))})`], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = () => alBattito();
    return () => { worker.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const id = setInterval(alBattito, ms);
    return () => clearInterval(id);
  }
}

// Chiede al browser di non congelare né mettere «a dormire» questa scheda finché è aperta (dove supportato).
export function tieniSchedaSveglia(nome: string): () => void {
  let chiudi: (() => void) | null = null;
  try {
    const locks = (navigator as any).locks;
    if (locks?.request) {
      locks.request(nome, () => new Promise<void>((resolve) => { chiudi = resolve; })).catch(() => {});
    }
  } catch {}
  return () => { try { chiudi?.(); } catch {} };
}
