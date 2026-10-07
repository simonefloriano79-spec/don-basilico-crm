"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Session } from "next-auth";
import { AutoStampa } from "@/components/layout/AutoStampa";
import { fermaSquillo, impostaSuonoMuto, suonaNuovoOrdine, suonaSquillo, suonoMuto } from "@/lib/suono-ordine";

// Nuovo ordine: suoneria continua per 20 s; poi, finché resta da accettare, un richiamo di 6 s ogni 25 s.
const SQUILLO_NUOVO_SEC = 20;
const SQUILLO_RICHIAMO_SEC = 6;
const RIPETI_OGNI_MS = 25000;

// Barra del pannello ordini online: sede, contatore "da accettare", suono (che si ripete finché c'è
// qualcosa da accettare), schermo sempre acceso, stampa automatica, uscita.
export function PannelloBar({ session }: { session: Session }) {
  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sedi, setSedi] = useState<{ id: string; nome: string }[]>([]);
  const [daAccettare, setDaAccettare] = useState(0);
  const [sospese, setSospese] = useState<string[]>([]);
  const [muto, setMuto] = useState(false);
  const [audioPronto, setAudioPronto] = useState(false);
  const [schermoAcceso, setSchermoAcceso] = useState(false);
  const precedente = useRef<number | null>(null);
  const ultimoSuono = useRef(0);
  const wakeLock = useRef<any>(null);

  useEffect(() => { setMuto(suonoMuto()); }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/sedi").then((r) => (r.ok ? r.json() : [])).then((d) => Array.isArray(d) && setSedi(d)).catch(() => {});
  }, [isSuperAdmin]);

  // Contatore + suono: al nuovo ordine subito, poi ripetuto ogni 25 s finché resta da accettare.
  useEffect(() => {
    let attivo = true;
    const carica = () =>
      fetch("/api/ordini/da-accettare").then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!attivo || !d) return;
        const adesso = Date.now();
        const nuovo = d.n > (precedente.current ?? 0);
        if (d.n === 0) {
          fermaSquillo();
        } else if (nuovo) {
          suonaSquillo(SQUILLO_NUOVO_SEC);
          ultimoSuono.current = adesso + SQUILLO_NUOVO_SEC * 1000;
        } else if (adesso - ultimoSuono.current >= RIPETI_OGNI_MS) {
          suonaSquillo(SQUILLO_RICHIAMO_SEC);
          ultimoSuono.current = adesso + SQUILLO_RICHIAMO_SEC * 1000;
        }
        precedente.current = d.n;
        setDaAccettare(d.n);
        setSospese(Array.isArray(d.sospese) ? d.sospese.map((s: any) => s.nome) : []);
      }).catch(() => {});
    carica();
    const iv = setInterval(carica, 5000);
    return () => { attivo = false; clearInterval(iv); fermaSquillo(); };
  }, []);

  // Titolo della scheda col numero: si vede anche con la scheda in background.
  useEffect(() => {
    document.title = daAccettare > 0 ? `(${daAccettare}) Da accettare — Don Basilico` : "Ordini online — Don Basilico";
  }, [daAccettare]);

  // Schermo sempre acceso (dove il browser lo permette), da riprendere quando la scheda torna visibile.
  const accendiSchermo = async () => {
    try {
      const nav: any = navigator;
      if (!nav.wakeLock) return false;
      wakeLock.current = await nav.wakeLock.request("screen");
      setSchermoAcceso(true);
      wakeLock.current.addEventListener?.("release", () => setSchermoAcceso(false));
      return true;
    } catch { return false; }
  };
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && audioPronto) accendiSchermo(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [audioPronto]);

  // Il browser permette l'audio solo dopo un click: un pulsante evidente lo "sblocca".
  const attiva = async () => {
    suonaNuovoOrdine(true);
    setAudioPronto(true);
    await accendiSchermo();
  };

  const cambiaSede = (v: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (v) p.set("sede", v); else p.delete("sede");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const btn: React.CSSProperties = {
    background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "8px 14px",
    borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap",
  };

  return (
    <>
      <header style={{
        minHeight: 64, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex",
        alignItems: "center", flexWrap: "wrap", padding: "8px 18px", gap: 12, position: "sticky", top: 0, zIndex: 20,
      }}>
        <img src="/brand/don-basilico-logo.svg" alt="Don Basilico" style={{ height: 34 }} />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 500, color: "var(--text)", margin: 0 }}>
          Ordini online
        </h1>
        {daAccettare > 0 && (
          <span style={{ background: "var(--danger)", color: "#fff", borderRadius: 20, fontSize: 13, fontWeight: 600, padding: "3px 12px" }}>
            {daAccettare} da accettare
          </span>
        )}
        {sospese.length > 0 && (
          <span title={sospese.join(", ")} style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)", borderRadius: 20, fontSize: 12, fontWeight: 600, padding: "3px 10px" }}>
            STOP: {sospese.join(", ")}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {isSuperAdmin ? (
            <select value={searchParams.get("sede") ?? ""} onChange={(e) => cambiaSede(e.target.value)}
              style={{ ...btn, padding: "8px 12px" }}>
              <option value="">Tutte le sedi</option>
              {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          ) : user.sedeNome ? (
            <span style={{ ...btn, background: "var(--surface-muted)", cursor: "default" }}>{user.sedeNome}</span>
          ) : null}

          <button style={btn} onClick={() => { const v = !muto; setMuto(v); impostaSuonoMuto(v); if (v) fermaSquillo(); else suonaNuovoOrdine(true); }}>
            {muto ? "🔕 Suono spento" : "🔔 Suono acceso"}
          </button>
          <button style={btn} onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()}>
            Schermo intero
          </button>
          <button style={btn} onClick={() => signOut({ callbackUrl: "/login?da=/pannello" })}>Esci</button>
        </div>
      </header>

      {!audioPronto && (
        <button onClick={attiva} style={{
          display: "block", width: "100%", border: "none", background: "var(--text)", color: "#fff", padding: "13px 18px",
          fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>
          Tocca qui per attivare suono e schermo sempre acceso: serve ogni volta che apri o ricarichi la pagina
        </button>
      )}
      {audioPronto && !schermoAcceso && (
        <div style={{ background: "var(--surface-muted)", color: "var(--text-muted)", fontSize: 12, padding: "5px 18px" }}>
          Suono attivo. Lo schermo potrebbe spegnersi: impostalo su «mai» dalle impostazioni del dispositivo.
        </div>
      )}

      <div style={{ padding: "0 18px" }}>
        <AutoStampa sedeId={user.sedeId} isSuperAdmin={isSuperAdmin} />
      </div>
    </>
  );
}
