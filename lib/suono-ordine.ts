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

let ctxSquillo: AudioContext | null = null;

// Suoneria prolungata: il doppio "din" si ripete per `durataSec` secondi. Si può interrompere con fermaSquillo().
export function suonaSquillo(durataSec: number) {
  if (suonoMuto()) return;
  fermaSquillo();
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    ctxSquillo = ctx;
    for (let base = 0; base < durataSec; base += 1.3) {
      [0, 0.28].forEach((t) => {
        const quando = ctx.currentTime + base + t;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = t ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, quando);
        g.gain.exponentialRampToValueAtTime(0.4, quando + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.25);
        o.connect(g); g.connect(ctx.destination);
        o.start(quando); o.stop(quando + 0.26);
      });
    }
    setTimeout(() => { if (ctxSquillo === ctx) { ctx.close().catch(() => {}); ctxSquillo = null; } }, (durataSec + 1) * 1000);
  } catch {}
}

export function fermaSquillo() {
  if (!ctxSquillo) return;
  try { ctxSquillo.close().catch(() => {}); } catch {}
  ctxSquillo = null;
}
