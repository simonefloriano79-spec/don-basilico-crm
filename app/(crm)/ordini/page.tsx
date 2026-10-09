"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { stampaBrowser } from "@/lib/print";
import { nomeOrdine } from "@/lib/ordine-utils";
import { pesoRiga } from "@/lib/peso-pizze";

const STATI_FLOW = ["nuovo", "confermato", "in_preparazione", "pronto", "consegnato"];
const STATO_LABEL: Record<string, string> = {
  nuovo: "nuovo", confermato: "confermato", in_preparazione: "in preparazione",
  pronto: "pronto", consegnato: "consegnato", annullato: "annullato",
};
const STATO_HEX: Record<string, string> = {
  nuovo: "#4a6fa5", confermato: "#b4762a", in_preparazione: "#a05a28",
  pronto: "#4d7c1c", consegnato: "#8a8c80", annullato: "#a8452f",
};
const CANALE_LABEL: Record<string, string> = { online: "online", telefono: "telefono", walk_in: "walk-in" };

// Uso interno, nessuna notifica arriva al cliente sugli stati intermedi:
// un solo passaggio porta l'ordine da "in lavorazione" a "pronto", un
// secondo (che segna anche il pagamento) lo porta a "consegnato".
function prossimaAzione(o: any): { label: string; patch: Record<string, any> } | null {
  if (inAttesaOnline(o)) return null;
  const stato = o.stato;
  if (["nuovo", "confermato", "in_preparazione"].includes(stato)) {
    return { label: "Pronto", patch: { stato: "pronto" } };
  }
  if (stato === "pronto") {
    return { label: "Vai al pagamento", patch: { stato: "consegnato", pagato: true } };
  }
  return null;
}

function euro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function ora(d: string) {
  return new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

// Ordine online non ancora accettato dalla pizzeria (nasce "nuovo").
function inAttesaOnline(o: any) {
  return o?.canale === "online" && o?.stato === "nuovo";
}
// Modifiche e annullamenti fatti dal cliente dall'app («I miei ordini»).
const modificatoDalCliente = (o: any) => o?.canale === "online" && !!o?.modificatoAt && o?.stato === "nuovo";
const annullatoDalCliente = (o: any) => o?.canale === "online" && !!o?.modificatoAt && o?.stato === "annullato";
// Un annullamento del cliente resta visibile tra gli «attivi» per 3 ore: se la comanda era già in cucina va fermata.
const annullatoRecente = (o: any) => annullatoDalCliente(o) && Date.now() - new Date(o.modificatoAt).getTime() < 3 * 3600 * 1000;
const statoEtichetta = (o: any) =>
  annullatoDalCliente(o) ? "annullato dal cliente" : modificatoDalCliente(o) ? "MODIFICATO · da riaccettare" : inAttesaOnline(o) ? "da accettare" : STATO_LABEL[o.stato];
const statoColore = (o: any) => (annullatoDalCliente(o) || inAttesaOnline(o) ? "#a8452f" : STATO_HEX[o.stato]);

// "20:40" se oggi, "domani 20:40", altrimenti "03/10 20:40".
function quando(d: string) {
  const dt = new Date(d);
  const giorno = (x: Date) => x.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const oggi = new Date();
  if (giorno(dt) === giorno(oggi)) return ora(d);
  if (giorno(dt) === giorno(new Date(oggi.getTime() + 86400000))) return `domani ${ora(d)}`;
  return `${dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" })} ${ora(d)}`;
}

// Un ordine online è "prenotato" se l'orario richiesto è molto dopo la creazione.
const prenotato = (o: any) => !!o.oraRichiesta && new Date(o.oraRichiesta).getTime() - new Date(o.createdAt).getTime() > 5 * 60000;
// Orario di riferimento da mostrare in lista (confermato, oppure richiesto se prenotato).
const orarioRif = (o: any): string | null =>
  o.oraConsegnaComunicata ?? (o.canale === "online" && prenotato(o) ? o.oraRichiesta : null);

const pad2 = (n: number) => String(n).padStart(2, "0");
const perInputLocale = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const arrotonda10 = (d: Date) => new Date(Math.ceil(d.getTime() / 600000) * 600000);

export default function OrdiniPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const percorso = usePathname();
  const soloOnline = percorso === "/online" || percorso === "/pannello";
  const sedeParam = searchParams.get("sede") ?? "";
  const user = session?.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const [ordiniTutti, setOrdini] = useState<any[]>([]);
  const ordini = soloOnline ? ordiniTutti.filter((o) => o.canale === "online") : ordiniTutti;
  const [filtroStato, setFiltroStato] = useState(soloOnline ? "attivi" : "tutti");
  const primoCaricoFatto = useRef(false);
  // Interruttore "ordini online" per sede (solo nella vista Online).
  const [sediOnline, setSediOnline] = useState<{ id: string; nome: string; ordiniOnlineAttivi: boolean }[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [selezionato, setSelezionato] = useState<any>(null);
  const [orarioConferma, setOrarioConferma] = useState("");
  const [avvisaSms, setAvvisaSms] = useState(true);
  const [inAzione, setInAzione] = useState(false);
  const [carico, setCarico] = useState<{ usati: number; capacita: number; finestraMin: number } | null>(null);

  const caricaOrdini = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "80" });
    if (isSuperAdmin && sedeParam) qs.set("sedeId", sedeParam);
    const res = await fetch(`/api/ordini?${qs}`);
    const data = await res.json();
    setOrdini(Array.isArray(data) ? data : []);
  }, [isSuperAdmin, sedeParam]);

  useEffect(() => { caricaOrdini(); }, [caricaOrdini]);

  const caricaSediOnline = useCallback(async () => {
    if (!soloOnline || !user) return;
    const res = await fetch("/api/sedi");
    const d = await res.json().catch(() => []);
    if (!Array.isArray(d)) return;
    setSediOnline(
      d
        .filter((x: any) => isSuperAdmin || x.id === user.sedeId)
        .map((x: any) => ({ id: x.id, nome: x.nome, ordiniOnlineAttivi: x.ordiniOnlineAttivi !== false }))
    );
  }, [soloOnline, user, isSuperAdmin]);

  useEffect(() => { caricaSediOnline(); }, [caricaSediOnline]);
  useEffect(() => {
    if (!soloOnline) return;
    const iv = setInterval(caricaSediOnline, 15000);
    return () => clearInterval(iv);
  }, [soloOnline, caricaSediOnline]);

  const cambiaOrdiniOnline = async (sede: { id: string; nome: string }, attivi: boolean) => {
    if (!attivi && !confirm(`Sospendere gli ordini online di ${sede.nome}?\n\nI clienti non potranno più ordinare dal sito per questa sede finché non li riattivi. Gli ordini già arrivati restano e vanno gestiti normalmente.`)) return;
    const res = await fetch(`/api/sedi/${sede.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordiniOnlineAttivi: attivi }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Errore");
    toast.success(attivi ? `Ordini online riattivati: ${sede.nome}` : `Ordini online SOSPESI: ${sede.nome}`);
    caricaSediOnline();
  };

  // In "Online", al primo caricamento si parte da "Da accettare" se ce ne sono.
  useEffect(() => {
    if (!soloOnline || primoCaricoFatto.current || !ordiniTutti.length) return;
    primoCaricoFatto.current = true;
    if (ordiniTutti.some(inAttesaOnline)) setFiltroStato("da_accettare");
  }, [soloOnline, ordiniTutti]);
  useEffect(() => {
    const iv = setInterval(caricaOrdini, 15000);
    return () => clearInterval(iv);
  }, [caricaOrdini]);

  const caricaDettaglio = useCallback(async (id: string) => {
    const res = await fetch(`/api/ordini/${id}`);
    if (res.ok) setSelezionato(await res.json());
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    const iv = setInterval(() => caricaDettaglio(selezionato.id), 15000);
    return () => clearInterval(iv);
  }, [selezionato?.id, caricaDettaglio]);

  // Orario di default per accettare/spostare un ordine online: quello già confermato,
  // altrimenti quello richiesto (se prenotato), altrimenti tra ~20 minuti.
  useEffect(() => {
    if (!selezionato || selezionato.canale !== "online") return;
    const base = selezionato.oraConsegnaComunicata
      ? new Date(selezionato.oraConsegnaComunicata)
      : prenotato(selezionato)
        ? new Date(selezionato.oraRichiesta)
        : arrotonda10(new Date(Date.now() + 20 * 60000));
    setOrarioConferma(perInputLocale(base));
    setAvvisaSms(true);
  }, [selezionato?.id]);

  // Carico della cucina nella fascia dell'orario scelto (esclude l'ordine stesso).
  useEffect(() => {
    if (!selezionato || selezionato.canale !== "online" || !orarioConferma) { setCarico(null); return; }
    const t = new Date(orarioConferma);
    if (Number.isNaN(t.getTime())) return;
    let annullato = false;
    fetch(`/api/ordini/carico?sedeId=${selezionato.sedeId}&ora=${encodeURIComponent(t.toISOString())}&escludi=${selezionato.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!annullato) setCarico(d); })
      .catch(() => {});
    return () => { annullato = true; };
  }, [selezionato?.id, orarioConferma]);

  const azioneOnline = async (ordine: any, azione: "accetta" | "rifiuta" | "sposta") => {
    const t = new Date(orarioConferma);
    if (azione !== "rifiuta" && Number.isNaN(t.getTime())) return toast.error("Scegli un orario valido");
    if (azione === "rifiuta" && !confirm(`Rifiutare l'ordine #${ordine.numeroOrdine}?${avvisaSms ? " Il cliente riceverà un SMS." : ""}`)) return;
    setInAzione(true);
    const res = await fetch(`/api/ordini/${ordine.id}/${azione}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oraConfermata: Number.isNaN(t.getTime()) ? undefined : t.toISOString(), avvisa: avvisaSms }),
    });
    setInAzione(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Errore");
    toast.success(azione === "accetta" ? `Ordine #${ordine.numeroOrdine} accettato` : azione === "rifiuta" ? "Ordine rifiutato" : "Orario spostato");
    if (avvisaSms && !data.smsInviato) toast(`SMS non inviato${data.smsErrore ? `: ${data.smsErrore}` : " (controlla la configurazione Twilio)"}`, { icon: "⚠️", duration: 10000 });
    caricaOrdini();
    caricaDettaglio(ordine.id);
  };

  const avanzaStato = async (ordine: any) => {
    const azione = prossimaAzione(ordine);
    if (!azione) return;
    const res = await fetch(`/api/ordini/${ordine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(azione.patch),
    });
    if (res.ok) {
      toast.success(`Stato → ${STATO_LABEL[azione.patch.stato]}`);
      caricaOrdini();
      caricaDettaglio(ordine.id);
    }
  };

  const annullaOrdine = async (ordine: any) => {
    if (!confirm(`Annullare l'ordine #${ordine.numeroOrdine}?`)) return;
    const res = await fetch(`/api/ordini/${ordine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: "annullato" }),
    });
    if (res.ok) {
      toast.success(`Ordine #${ordine.numeroOrdine} annullato`);
      caricaOrdini();
      caricaDettaglio(ordine.id);
    } else {
      toast.error("Errore durante l'annullamento");
    }
  };

  const gestisciStampa = async (ordine: any) => {
    await stampaBrowser({
      numero: ordine.numeroOrdine,
      ordineId: ordine.id,
      sede: ordine.sede?.nome ?? "",
      canale: ordine.canale,
      tipo: ordine.tipo,
      cliente: nomeOrdine(ordine),
      tavolo: ordine.tavolo ?? undefined,
      telefono: ordine.clienteTelefono,
      indirizzo: ordine.clienteIndirizzo,
      nomeCitofono: ordine.nomeCitofono,
      items: (ordine.items ?? []).map((i: any) => ({ nome: i.nomeSnapshot, qty: i.quantita, prezzo: parseFloat(i.prezzoSnapshot), note: i.noteItem })),
      totale: parseFloat(ordine.totale),
      costoConsegna: parseFloat(ordine.costoConsegna ?? 0) || undefined,
      scontoFedelta: parseFloat(ordine.scontoFedelta ?? 0) || undefined,
      modificato: ordine.canale === "online" && !!ordine.modificatoAt ? true : undefined,
      note: ordine.note,
      noteDomicilio: ordine.noteDomicilio,
      oraConsegnaComunicata: ordine.oraConsegnaComunicata ? quando(ordine.oraConsegnaComunicata) : undefined,
      modalitaConsegna: ordine.modalitaConsegna,
      metodoPagamento: ordine.metodoPagamento,
      ora: ora(ordine.createdAt),
    });
    await fetch(`/api/ordini/${ordine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stampato: true }) });
    caricaOrdini();
  };

  const visibili = ordini.filter((o) => {
    if (filtroStato === "da_accettare" && !inAttesaOnline(o)) return false;
    if (filtroStato === "attivi" && ["consegnato", "annullato"].includes(o.stato) && !annullatoRecente(o)) return false;
    if (STATI_FLOW.includes(filtroStato) && o.stato !== filtroStato) return false;
    if (ricerca.trim()) {
      const q = ricerca.trim().toLowerCase();
      const match = String(o.numeroOrdine).includes(q)
        || (o.clienteNome ?? "").toLowerCase().includes(q)
        || (o.tavolo ?? "").toLowerCase().includes(q)
        || (o.clienteTelefono ?? "").includes(q);
      if (!match) return false;
    }
    return true;
  });

  const nDaAccettare = ordini.filter(inAttesaOnline).length;

  const chipStyle = (attivo: boolean, hex?: string) => ({
    padding: "8px 15px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
    border: `1px solid ${attivo ? "var(--text)" : "var(--border)"}`,
    background: attivo ? "var(--text)" : "#fff",
    color: attivo ? "#fff" : "var(--text-3)",
    fontFamily: "var(--font-ui)", whiteSpace: "nowrap", flexShrink: 0,
  } as React.CSSProperties);

  return (
    <div className="animate-in" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {soloOnline && sediOnline.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {sediOnline.map((sd) => (
              <div key={sd.id} style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12,
                border: `1px solid ${sd.ordiniOnlineAttivi ? "var(--border)" : "var(--danger-border)"}`,
                background: sd.ordiniOnlineAttivi ? "#fff" : "var(--danger-bg)",
              }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: sd.ordiniOnlineAttivi ? "#4caf50" : "var(--danger)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{sd.nome}</div>
                  <div style={{ fontSize: 12, color: sd.ordiniOnlineAttivi ? "var(--text-muted)" : "var(--danger)" }}>
                    {sd.ordiniOnlineAttivi ? "Ordini online attivi" : "Ordini online SOSPESI: i clienti non possono ordinare"}
                  </div>
                </div>
                <button onClick={() => cambiaOrdiniOnline(sd, !sd.ordiniOnlineAttivi)} style={{
                  padding: "8px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
                  border: sd.ordiniOnlineAttivi ? "1px solid var(--danger-border)" : "none",
                  background: sd.ordiniOnlineAttivi ? "#fff" : "var(--text)",
                  color: sd.ordiniOnlineAttivi ? "var(--danger)" : "#fff",
                }}>{sd.ordiniOnlineAttivi ? "Sospendi ordini online" : "Riattiva ordini online"}</button>
              </div>
            ))}
          </div>
        )}
        {/* Filtri */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {nDaAccettare > 0 && (
              <button onClick={() => setFiltroStato("da_accettare")} style={{
                ...chipStyle(filtroStato === "da_accettare"),
                ...(filtroStato === "da_accettare" ? {} : { background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger-border)" }),
              }}>Da accettare ({nDaAccettare})</button>
            )}
            <button onClick={() => setFiltroStato("tutti")} style={chipStyle(filtroStato === "tutti")}>Tutti</button>
            <button onClick={() => setFiltroStato("attivi")} style={chipStyle(filtroStato === "attivi")}>Attivi</button>
            {STATI_FLOW.map((s) => (
              <button key={s} onClick={() => setFiltroStato(s)} style={chipStyle(filtroStato === s)}>{STATO_LABEL[s]}</button>
            ))}
          </div>
          <div style={{ position: "relative", marginLeft: "auto", flex: "1 1 160px", maxWidth: 300, minWidth: 0 }}>
            <span style={{ position: "absolute", left: 12, top: 9, color: "var(--text-faint)", fontSize: 13 }}>⌕</span>
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca ordine, cliente, telefono…"
              style={{
                width: "100%", padding: "9px 12px 9px 34px", border: "1px solid var(--border)",
                borderRadius: 9, fontSize: 12.5, background: "#fff", outline: "none", fontFamily: "var(--font-ui)",
              }}
            />
          </div>
        </div>

        <div className="ordini-table-desktop" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                {["Ordine", "Ora", "Cliente", "Canale", ...(isSuperAdmin ? ["Sede"] : []), "Stato", "Totale"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibili.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: "center", padding: 44, color: "var(--text-muted)", fontSize: 13 }}>Nessun ordine con questi filtri</td></tr>
              ) : visibili.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => caricaDettaglio(o.id)}
                  style={{
                    borderTop: "1px solid var(--border-soft)", cursor: "pointer",
                    background: selezionato?.id === o.id ? "var(--surface-muted)" : "transparent",
                  }}
                >
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>#{o.numeroOrdine}</td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--text-3)" }}>
                    {ora(o.createdAt)}
                    {orarioRif(o) && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-ink)" }}>per {quando(orarioRif(o)!)}</div>}
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{nomeOrdine(o)}</div>
                    {o.clienteTelefono && <div className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{o.clienteTelefono}</div>}
                    {o.tipo === "domicilio" && o.clienteIndirizzo && (
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.clienteIndirizzo}>
                        📍 {o.clienteIndirizzo}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--text-3)" }}>{CANALE_LABEL[o.canale]}</td>
                  {isSuperAdmin && <td style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>{o.sede?.nome?.replace("Don Basilico ", "") ?? "—"}</td>}
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
                      borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: `${statoColore(o)}14`, color: statoColore(o),
                    }}>{statoEtichetta(o)}</span>
                  </td>
                  <td className="num" style={{ padding: "13px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{euro(parseFloat(o.totale))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ordini-cards-mobile" style={{ display: "none" }}>
          {visibili.length === 0 ? (
            <div style={{ textAlign: "center", padding: 44, color: "var(--text-muted)", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>Nessun ordine con questi filtri</div>
          ) : visibili.map((o) => (
            <div
              key={o.id}
              onClick={() => caricaDettaglio(o.id)}
              style={{
                background: selezionato?.id === o.id ? "var(--surface-muted)" : "var(--surface)",
                border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <span className="num" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>#{o.numeroOrdine}</span>
                  <span className="num" style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{ora(o.createdAt)}</span>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
                  borderRadius: 20, fontSize: 11, fontWeight: 500, flexShrink: 0,
                  background: `${statoColore(o)}14`, color: statoColore(o),
                }}>{statoEtichetta(o)}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{nomeOrdine(o)}</div>
              {o.clienteTelefono && <div className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{o.clienteTelefono}</div>}
                    {o.tipo === "domicilio" && o.clienteIndirizzo && (
                      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.clienteIndirizzo}>
                        📍 {o.clienteIndirizzo}
                      </div>
                    )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {CANALE_LABEL[o.canale]}{isSuperAdmin && o.sede?.nome ? ` · ${o.sede.nome.replace("Don Basilico ", "")}` : ""}
                </span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{euro(parseFloat(o.totale))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PANNELLO DETTAGLIO */}
      {selezionato && (
        <div className="ordini-detail-panel" style={{
          width: 352, flexShrink: 0, position: "sticky", top: 0,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
          overflowY: "auto",
        }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Ordine</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>#{selezionato.numeroOrdine}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {nomeOrdine(selezionato)} · {ora(selezionato.createdAt)}
              </div>
            </div>
            <button onClick={() => setSelezionato(null)} style={{
              width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)",
              background: "#fff", cursor: "pointer", fontSize: 13, color: "var(--text-3)",
            }}>✕</button>
          </div>

          {selezionato.tipo === "domicilio" && (
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border-soft)", background: "var(--accent-bg-2)" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>Consegna a</div>
              {selezionato.clienteIndirizzo ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.35 }}>📍 {selezionato.clienteIndirizzo}</div>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selezionato.clienteIndirizzo)}`} target="_blank" rel="noreferrer"
                    style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "var(--accent-ink)", textDecoration: "underline" }}>Apri su Google Maps ↗</a>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--danger)" }}>Indirizzo non indicato</div>
              )}
              {selezionato.nomeCitofono && <div style={{ fontSize: 13, color: "var(--text)", marginTop: 8 }}>Citofono: <strong>{selezionato.nomeCitofono}</strong></div>}
              {selezionato.clienteTelefono && (
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 4 }}>
                  Tel: <a href={`tel:${selezionato.clienteTelefono}`} className="num" style={{ color: "var(--text)", fontWeight: 600 }}>{selezionato.clienteTelefono}</a>
                </div>
              )}
            </div>
          )}

          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)" }}>
            {(selezionato.items ?? []).map((i: any) => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <span className="num" style={{ fontSize: 13, color: "var(--text-2)" }}>{i.quantita}× </span>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>{i.nomeSnapshot}</span>
                  {i.noteItem && <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 2 }}>{i.noteItem}</div>}
                </div>
                <span className="num" style={{ fontSize: 13, color: "var(--text-2)", flexShrink: 0 }}>{euro(parseFloat(i.prezzoSnapshot) * i.quantita)}</span>
              </div>
            ))}
            {selezionato.note && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>Nota: {selezionato.note}</div>}
            {selezionato.oraConsegnaComunicata && (
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>
                {selezionato.modalitaConsegna === "alle_ore"
                  ? <>{selezionato.tipo === "domicilio" ? "Consegna" : "Ritiro"}: <strong className="num">{quando(selezionato.oraConsegnaComunicata)}</strong></>
                  : <>
                      {selezionato.modalitaConsegna === "non_prima" ? "Non prima delle " : "Appena possibile, entro le "}
                      <strong className="num">{ora(selezionato.oraConsegnaComunicata)}</strong>
                    </>}
              </div>
            )}
            {selezionato.nomeCitofono && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>Citofono: <strong>{selezionato.nomeCitofono}</strong></div>}
            {selezionato.noteDomicilio && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>Consegna: {selezionato.noteDomicilio}</div>}
            {parseFloat(selezionato.costoConsegna ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Consegna</span>
                <span className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{euro(parseFloat(selezionato.costoConsegna))}</span>
              </div>
            )}
            {parseFloat(selezionato.scontoFedelta ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 12.5, color: "var(--accent-ink)" }}>Sconto fedeltà</span>
                <span className="num" style={{ fontSize: 12.5, color: "var(--accent-ink)" }}>-{euro(parseFloat(selezionato.scontoFedelta))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>Totale</span>
              <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{euro(parseFloat(selezionato.totale))}</span>
            </div>
            {selezionato.metodoPagamento && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pagamento</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>{selezionato.metodoPagamento === "pos" ? "POS" : "Contanti"}</span>
              </div>
            )}
          </div>

          {selezionato.canale === "online" && !["annullato", "consegnato"].includes(selezionato.stato) && (() => {
            const attesa = inAttesaOnline(selezionato);
            const pesoOrdine = (selezionato.items ?? []).reduce(
              (a: number, i: any) => a + pesoRiga(i.menuItem?.categoria ?? i.sedeExtra?.categoria, i.nomeSnapshot, i.quantita), 0);
            const oltre = carico ? carico.usati + pesoOrdine > carico.capacita : false;
            return (
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)", background: attesa ? "var(--danger-bg)" : "transparent" }}>
                <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: attesa ? "var(--danger)" : "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
                  {attesa ? "Ordine online — da accettare" : "Orario confermato al cliente"}
                </div>
                {modificatoDalCliente(selezionato) && (
                  <div style={{ background: "#fff", border: "1.5px solid var(--danger)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 12.5, lineHeight: 1.45, color: "var(--danger)" }}>
                    <strong>MODIFICATO dal cliente alle {ora(selezionato.modificatoAt)}</strong> (modifica {selezionato.modificheCliente} su 2). Controlla le righe qui sotto e riaccetta.
                    Se la comanda precedente era già stata stampata, <strong>va buttata</strong>: ne esce una nuova con «ORDINE MODIFICATO».
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 8 }}>
                  Richiesto dal cliente: <strong>{prenotato(selezionato) ? quando(selezionato.oraRichiesta) : "appena possibile"}</strong>
                </div>
                <input type="datetime-local" step={600} value={orarioConferma} onChange={(e) => setOrarioConferma(e.target.value)} style={{
                  width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9,
                  fontSize: 13, background: "#fff", fontFamily: "var(--font-ui)", marginBottom: 8,
                }} />
                {selezionato.tipo === "domicilio" && (() => {
                  const t = new Date(orarioConferma).getTime();
                  if (Number.isNaN(t)) return null;
                  const vicine = ordini
                    .filter((o) => o.id !== selezionato.id && o.tipo === "domicilio" && o.sedeId === selezionato.sedeId
                      && ["nuovo", "confermato", "in_preparazione", "pronto"].includes(o.stato))
                    .map((o) => ({ o, quando: new Date(orarioRif(o) ?? o.createdAt).getTime() }))
                    .filter((x) => Math.abs(x.quando - t) <= 40 * 60000)
                    .sort((a, b) => a.quando - b.quando)
                    .slice(0, 6);
                  return (
                    <div style={{ marginBottom: 10, padding: "8px 10px", background: "#fff", border: "1px solid var(--border)", borderRadius: 9 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Altre consegne entro 40 minuti da quell'ora</div>
                      {vicine.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nessuna</div>
                      ) : vicine.map(({ o, quando: q }) => (
                        <div key={o.id} style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3, lineHeight: 1.35 }}>
                          <strong className="num">{ora(new Date(q).toISOString())}</strong> · #{o.numeroOrdine} · {o.clienteIndirizzo || "senza indirizzo"}
                          {inAttesaOnline(o) ? " (da accettare)" : ""}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {carico && (
                  <div style={{ fontSize: 12, marginBottom: 8, color: oltre ? "var(--danger)" : "var(--text-muted)", fontWeight: oltre ? 600 : 400 }}>
                    Cucina in quella fascia ({carico.finestraMin} min): {carico.usati} pizze già previste + {pesoOrdine} di questo ordine / {carico.capacita}
                    {oltre ? " — oltre la capienza" : ""}
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-2)", marginBottom: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={avvisaSms} onChange={(e) => setAvvisaSms(e.target.checked)} /> Avvisa il cliente via SMS
                </label>
                {attesa ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={inAzione} onClick={() => azioneOnline(selezionato, "accetta")} style={{
                      flex: 1, background: "var(--text)", color: "#fff", border: "none", padding: "10px 14px",
                      borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
                    }}>{inAzione ? "…" : "Accetta"}</button>
                    <button disabled={inAzione} onClick={() => azioneOnline(selezionato, "rifiuta")} style={{
                      background: "#fff", border: "1px solid var(--danger-border)", color: "var(--danger)",
                      padding: "10px 14px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
                    }}>Rifiuta</button>
                  </div>
                ) : (
                  <button disabled={inAzione} onClick={() => azioneOnline(selezionato, "sposta")} style={{
                    width: "100%", background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                    padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
                  }}>{inAzione ? "…" : "Sposta orario"}</button>
                )}
              </div>
            );
          })()}

          {selezionato.stato !== "annullato" && (
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 1.7, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Avanzamento</div>
              {STATI_FLOW.map((s) => {
                const idxAttuale = STATI_FLOW.indexOf(selezionato.stato);
                const idxStep = STATI_FLOW.indexOf(s);
                const raggiunto = idxStep <= idxAttuale;
                const log = (selezionato.statiLog ?? []).find((l: any) => l.stato === s);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: raggiunto ? "var(--accent)" : "var(--border)", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: raggiunto ? "var(--text)" : "var(--text-muted)", flex: 1 }}>{STATO_LABEL[s]}</span>
                    {log && <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{ora(log.createdAt)}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            {prossimaAzione(selezionato) && (
              <button onClick={() => avanzaStato(selezionato)} style={{
                background: "var(--text)", color: "#fff", border: "none", padding: "10px 18px",
                borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>{prossimaAzione(selezionato)!.label}</button>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => gestisciStampa(selezionato)} style={{
                flex: 1, background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>Stampa</button>
              {selezionato.clienteTelefono && (
                <a href={`tel:${selezionato.clienteTelefono}`} style={{
                  flex: 1, background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)",
                  padding: "9px 12px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)",
                  textAlign: "center", textDecoration: "none", display: "block",
                }}>Chiama cliente</a>
              )}
            </div>
            {!["consegnato", "annullato"].includes(selezionato.stato) && (
              <button onClick={() => annullaOrdine(selezionato)} style={{
                background: "transparent", border: "none", color: "var(--danger)",
                fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-ui)", padding: "4px 0",
              }}>Annulla ordine</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
