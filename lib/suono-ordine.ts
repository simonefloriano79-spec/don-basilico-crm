// Suono "nuovo ordine online" condiviso da sidebar del CRM e pannello ordini.
// Il silenziamento resta salvato su questo dispositivo.
const CHIAVE_MUTO = "db_suono_muto";

export function suonoMuto(): boolean {
  try { return localStorage.getItem(CHIAVE_MUTO) === "1"; } catch { return false; }
}

export function impostaSuonoMuto(v: boolean) {
  try { localStorage.setItem(CHIAVE_MUTO, v ? "1" : "0"); } catch {}
}

// Doppio "din" breve; se il browser blocca l'audio (nessun click ancora sulla pagina) non succede nulla.
export function suonaNuovoOrdine(forza = false) {
  if (!forza && suonoMuto()) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = t ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}
