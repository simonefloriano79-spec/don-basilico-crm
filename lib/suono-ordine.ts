// Suono "nuovo ordine online" condiviso da sidebar del CRM e pannello ordini.
// Il silenziamento resta salvato su questo dispositivo.
//
// È pensato per una pizzeria rumorosa: onde «quadre» (ricche di armoniche, tagliano il rumore di fondo) su note alte,
// tre bip rapidi che si ripetono come un allarme, volume al massimo con un compressore che lo rende ancora più forte.
// Il volume vero resta quello del dispositivo: va messo al massimo.
const CHIAVE_MUTO = "db_suono_muto";

export function suonoMuto(): boolean {
  try { return localStorage.getItem(CHIAVE_MUTO) === "1"; } catch { return false; }
}

export function impostaSuonoMuto(v: boolean) {
  try { localStorage.setItem(CHIAVE_MUTO, v ? "1" : "0"); } catch {}
}

const CICLO_SEC = 1.1;                 // un «ciclo» = tre bip + pausa
const NOTE_BIP = [1900, 2500, 1900];   // alterna due note alte: più fastidioso di un suono solo
const DURATA_BIP = 0.11;
const PASSO_BIP = 0.16;

// Un solo contesto audio per tutta la vita della pagina, creato dopo il tocco del popup: così il suono parte anche
// quando la finestra è dietro un'altra (un contesto nuovo creato in background potrebbe restare muto).
let ctxCondiviso: AudioContext | null = null;
function contesto(): AudioContext | null {
  try {
    if (!ctxCondiviso || ctxCondiviso.state === "closed") {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ctxCondiviso = new Ctx();
    }
    if (ctxCondiviso!.state === "suspended") ctxCondiviso!.resume().catch(() => {});
    return ctxCondiviso;
  } catch { return null; }
}

// Da chiamare nel gestore del tocco (popup «Attiva suono»): sblocca l'audio per tutto il resto della sessione.
export function sbloccaAudio() { contesto(); }

let oscMantieniSveglio: OscillatorNode | null = null;

// Un tono continuo a 30 Hz a volume bassissimo (sotto ciò che gli altoparlanti di un PC riproducono): Chrome non rallenta né
// mette «a dormire» le finestre che emettono audio, quindi il pannello resta sveglio anche se coperto da altre finestre.
// Da chiamare dopo il tocco di attivazione. Restituisce true se il tono è partito.
export function mantieniSveglio(): boolean {
  if (oscMantieniSveglio) return true;
  const ctx = contesto();
  if (!ctx) return false;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 30;
    g.gain.value = 0.01;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    oscMantieniSveglio = o;
    return true;
  } catch { return false; }
}

// Stato del contesto audio («running» = può suonare, «suspended» = bloccato dal browser): serve alla diagnostica del pannello.
export function statoAudio(): string { return ctxCondiviso ? ctxCondiviso.state : "non creato"; }

// Il browser lascia già suonare senza un tocco (es. collegamento Chrome con autoplay consentito)? Allora il popup non serve.
export async function audioGiaConsentito(): Promise<boolean> {
  const ctx = contesto();
  if (!ctx) return false;
  try { await ctx.resume(); } catch {}
  return ctx.state === "running";
}

// Programma `cicli` cicli dell'allarme sul contesto audio, a partire da adesso. Restituisce il volume generale
// (scollegarlo ferma subito il suono).
function programmaAllarme(ctx: AudioContext, cicli: number): GainNode {
  // Compressore + guadagno finale: alza il volume percepito senza distorcere.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 0; comp.ratio.value = 20; comp.attack.value = 0.001; comp.release.value = 0.05;
  const master = ctx.createGain();
  master.gain.value = 1.5; // misurato: il picco resta sotto 1 (nessuna distorsione), circa 5 volte più forte del vecchio «din din»
  comp.connect(master); master.connect(ctx.destination);

  for (let c = 0; c < cicli; c++) {
    NOTE_BIP.forEach((freq, i) => {
      const t = ctx.currentTime + c * CICLO_SEC + i * PASSO_BIP;
      // Due onde quadre (la nota e la sua ottava) sullo stesso bip: più «cattivo» e più udibile.
      [freq, freq * 2].forEach((f, k) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square"; o.frequency.value = f;
        const picco = k === 0 ? 0.9 : 0.35;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(picco, t + 0.005);
        g.gain.setValueAtTime(picco, t + DURATA_BIP - 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + DURATA_BIP);
        o.connect(g); g.connect(comp);
        o.start(t); o.stop(t + DURATA_BIP + 0.01);
      });
    });
  }
  return master;
}

// Un solo allarme (tre bip). `forza`: suona anche se il suono è silenziato (es. tasto «Prova suono»).
// Se il browser blocca l'audio (nessun tocco ancora sulla pagina) non succede nulla.
export function suonaNuovoOrdine(forza = false) {
  if (!forza && suonoMuto()) return;
  const ctx = contesto();
  if (!ctx) return;
  try {
    const master = programmaAllarme(ctx, 2);
    setTimeout(() => { try { master.disconnect(); } catch {} }, (2 * CICLO_SEC + 1) * 1000);
  } catch {}
}

let masterSquillo: GainNode | null = null;

// Suoneria prolungata: l'allarme si ripete per `durataSec` secondi. Si può interrompere con fermaSquillo().
export function suonaSquillo(durataSec: number) {
  if (suonoMuto()) return;
  fermaSquillo();
  const ctx = contesto();
  if (!ctx) return;
  try {
    const master = programmaAllarme(ctx, Math.max(1, Math.ceil(durataSec / CICLO_SEC)));
    masterSquillo = master;
    setTimeout(() => { try { master.disconnect(); } catch {} if (masterSquillo === master) masterSquillo = null; }, (durataSec + 1) * 1000);
  } catch {}
}

export function fermaSquillo() {
  if (!masterSquillo) return;
  try { masterSquillo.disconnect(); } catch {}
  masterSquillo = null;
}

// Sul telefono fa anche vibrare (dove il browser lo permette).
export function vibraNuovoOrdine() {
  try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch {}
}
