"use client";

import { useEffect, useState } from "react";

interface Sede { id: string; nome: string; slug: string; }
interface Prodotto { id: string; nome: string; categoria: string; descrizione: string | null; immagineUrl: string | null; prezzo: number; }
interface Impasto { id: string; nome: string; descrizione: string | null; supplemento: number; }

// Sezioni nell'ordine del menù e come si chiamano. «Crea la tua pizza» è un prodotto speciale e va in evidenza.
const SEZIONI: { cat: string; titolo: string; nota?: string }[] = [
  { cat: "menu_speciale", titolo: "Speciali" },
  { cat: "pizze_rosse", titolo: "Pizze rosse", nota: "Con passata Mutti e fior di latte La Majelletta." },
  { cat: "pizze_bianche", titolo: "Pizze bianche", nota: "Con fior di latte La Majelletta." },
  { cat: "calzoni", titolo: "Calzoni" },
  { cat: "focacce", titolo: "Focacce" },
  { cat: "fritti", titolo: "Fritteria", nota: "Arancini, supplì e crocchette sempre freschi e artigianali." },
  { cat: "dolci", titolo: "Dolci" },
  { cat: "bevande", titolo: "Bevande" },
];

// Prezzo come si legge nel menù: «8» oppure «8,50», senza simbolo €.
const prezzoMenu = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));
const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

const btn: React.CSSProperties = {
  display: "block", textAlign: "center", textDecoration: "none", background: "var(--text)", color: "#fff", border: "none",
  padding: 16, borderRadius: 14, fontSize: 15, fontWeight: 500, fontFamily: "var(--font-ui)", cursor: "pointer",
};

export default function ConsultaMenu() {
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [sedeId, setSedeId] = useState("");
  const [prodotti, setProdotti] = useState<Prodotto[] | null>(null);
  const [impasti, setImpasti] = useState<Impasto[]>([]);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    fetch("/api/sedi").then((r) => r.json()).then((d) => {
      const lista: Sede[] = (Array.isArray(d) ? d : []).map((s: any) => ({ id: s.id, nome: s.nome, slug: s.slug }));
      setSedi(lista);
      // preselezione: la pizzeria scelta l'ultima volta, altrimenti Viale Bovio (centro)
      let salvata = "";
      try { salvata = localStorage.getItem("db_menu_sede") ?? ""; } catch {}
      setSedeId(lista.find((s) => s.id === salvata)?.id ?? lista.find((s) => s.slug === "centro")?.id ?? lista[0]?.id ?? "");
    }).catch(() => setErrore("Non riesco a caricare il menù, riprova tra poco."));
  }, []);

  useEffect(() => {
    if (!sedeId) return;
    try { localStorage.setItem("db_menu_sede", sedeId); } catch {}
    setProdotti(null);
    Promise.all([
      fetch(`/api/menu?sedeId=${sedeId}`).then((r) => r.json()),
      fetch(`/api/impasti?sedeId=${sedeId}`).then((r) => r.json()),
    ]).then(([m, i]) => {
      setProdotti(
        (m.items ?? [])
          .filter((x: any) => x.isAttivo && x.disponibileInSede !== false)
          .map((x: any) => ({
            id: x.id, nome: x.nome, categoria: x.categoria, descrizione: x.descrizione, immagineUrl: x.immagineUrl,
            prezzo: parseFloat(x.prezzoEffettivo ?? x.prezzoBase),
          }))
      );
      setImpasti(i.impasti ?? []);
    }).catch(() => setErrore("Non riesco a caricare il menù, riprova tra poco."));
  }, [sedeId]);

  const crea = prodotti?.find((p) => p.nome.trim().toLowerCase() === "crea la tua pizza");
  const elenco = (prodotti ?? []).filter((p) => p !== crea);
  const sezioni = SEZIONI.map((s) => ({
    ...s,
    voci: elenco.filter((p) => p.categoria === s.cat).sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" })),
  })).filter((s) => s.voci.length > 0);
  const conImpasti = impasti.length > 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 90 }}>
      <a href="/ordina"><img src="/brand/don-basilico-logo.png" alt="Don Basilico — Naturalmente Pizza" style={{ display: "block", width: 150, height: "auto", margin: "6px auto 14px" }} /></a>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--text)", textAlign: "center", margin: "0 0 6px" }}>Il nostro menù</h1>
      <p style={{ fontSize: 14, color: "var(--text-2)", textAlign: "center", lineHeight: 1.55, margin: "0 auto 16px", maxWidth: 460 }}>
        Impasto con lievitazione di almeno 48 ore, leggero e digeribile. Farine selezionate e miscelate appositamente per noi.
        La stessa passata Mutti e lo stesso fior di latte La Majelletta su tutte le nostre pizze.
      </p>

      <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} aria-label="Pizzeria"
        style={{ width: "100%", background: "#fff", border: "1px solid var(--border)", color: "var(--text)", padding: "14px 16px", borderRadius: 14, fontSize: 16, fontFamily: "var(--font-ui)", marginBottom: 12 }}>
        {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome.replace("Don Basilico ", "")}</option>)}
      </select>

      {errore && <div style={{ fontSize: 13, color: "var(--danger)", textAlign: "center", marginBottom: 10 }}>{errore}</div>}
      {prodotti === null && !errore && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 30 }}>Carico il menù…</div>}

      {prodotti !== null && (
        <>
          {/* indice delle sezioni, sempre a portata di dito */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg)", padding: "8px 0", margin: "0 -4px 10px", display: "flex", gap: 6, overflowX: "auto" }}>
            {sezioni.map((s) => (
              <a key={s.cat} href={`#sez-${s.cat}`} style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 20, fontSize: 13, textDecoration: "none", border: "1.5px solid #8a897f", background: "#fff", color: "var(--text)", fontFamily: "var(--font-ui)" }}>{s.titolo}</a>
            ))}
            {conImpasti && <a href="#sez-impasti" style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 20, fontSize: 13, textDecoration: "none", border: "1.5px solid #8a897f", background: "#fff", color: "var(--text)", fontFamily: "var(--font-ui)" }}>Impasti</a>}
          </div>

          {crea && (
            <div style={{ background: "var(--accent-bg-2)", border: "1.5px solid var(--accent-border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)" }}>Crea la tua pizza</div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, lineHeight: 1.45 }}>{crea.descrizione}</div>
              </div>
              <span className="num" style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>da {prezzoMenu(crea.prezzo)}</span>
            </div>
          )}

          {sezioni.map((s) => (
            <section key={s.cat} id={`sez-${s.cat}`} style={{ scrollMarginTop: 64, marginBottom: 22 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)", margin: "0 0 2px", borderBottom: "2px solid var(--accent)", paddingBottom: 4 }}>{s.titolo}</h2>
              {s.nota && <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 8px" }}>{s.nota}</div>}
              <div style={{ marginTop: s.nota ? 0 : 8 }}>
                {s.voci.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                    {p.immagineUrl && <img src={p.immagineUrl} alt={p.nome} loading="lazy" decoding="async" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: "var(--border)" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{p.nome}</div>
                      {p.descrizione && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, lineHeight: 1.45 }}>{p.descrizione}</div>}
                    </div>
                    <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{prezzoMenu(p.prezzo)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {conImpasti && (
            <section id="sez-impasti" style={{ scrollMarginTop: 64, marginBottom: 22 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)", margin: "0 0 2px", borderBottom: "2px solid var(--accent)", paddingBottom: 4 }}>Impasti</h2>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 8px" }}>Su pizze rosse, bianche e speciali. Il classico è incluso; gli impasti speciali costano {euro(impasti[0].supplemento)} in più a pizza.</div>
              <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>Classico <span style={{ fontSize: 13, color: "var(--text-muted)" }}>· incluso</span></div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, lineHeight: 1.45 }}>Impasto con lievitazione di almeno 48 ore, leggero e digeribile.</div>
              </div>
              {impasti.map((i) => (
                <div key={i.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{i.nome} <span style={{ fontSize: 13, color: "var(--text-muted)" }}>· +{euro(i.supplemento)}</span></div>
                  {i.descrizione && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, lineHeight: 1.45 }}>{i.descrizione}</div>}
                </div>
              ))}
            </section>
          )}

          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div>* Prodotto surgelato.</div>
            <div>Per allergie o intolleranze chiedi al personale prima di ordinare.</div>
          </div>
        </>
      )}

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "10px 16px 14px", background: "linear-gradient(to top, var(--bg) 70%, transparent)" }}>
        <a href="/ordina" style={{ ...btn, maxWidth: 608, margin: "0 auto" }}>Ordina online</a>
      </div>
    </div>
  );
}
