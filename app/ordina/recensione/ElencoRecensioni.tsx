// Elenco delle pizzerie per lasciare una recensione su Google (componente senza stato: lo usa la pagina e si prova da solo).
const TESTO = "#1B1E17";
const BORDO = "#E4E5DD";

const stella = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#7ECE25" stroke="#7ECE25" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
  </svg>
);

export interface SedeRecensione { id: string; nome: string; indirizzo: string; url: string }

export default function ElencoRecensioni({ sedi }: { sedi: SedeRecensione[] }) {
  return (
    <div style={{ maxWidth: 430, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-ui)", color: TESTO, padding: "14px 4px 24px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <div style={{ display: "flex", gap: 4 }} aria-hidden="true">{stella}{stella}{stella}{stella}{stella}</div>
        <h1 style={{ margin: 0, fontFamily: "'Playfair Display', var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1.12 }}>
          Com'è andata?
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "#555950", maxWidth: 340 }}>
          Scegli la pizzeria dove hai mangiato e raccontacelo su Google: bastano 30 secondi e ci aiuti un sacco.
        </p>
      </div>

      {sedi.length === 0 ? (
        <p style={{ textAlign: "center", fontSize: 14, color: "#5F6457" }}>Non riusciamo a caricare le pizzerie in questo momento. Riprova tra poco.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {sedi.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{
                minHeight: 64, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", textDecoration: "none",
                background: "#FFFFFF", border: `1px solid ${BORDO}`, borderRadius: 18, color: TESTO,
              }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 17, fontWeight: 600 }}>{s.nome}</span>
                  <span style={{ fontSize: 13.5, color: "#5F6457" }}>{s.indirizzo}</span>
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", opacity: 0.6 }}><path d="M9 6l6 6-6 6" /></svg>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p style={{ margin: 0, textAlign: "center", fontSize: 13, lineHeight: 1.5, color: "#5F6457" }}>
        Si apre Google: tocca «Scrivi una recensione», scegli le stelle e dicci cosa ti è piaciuto.
      </p>
      <a href="/ordina" style={{ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", color: "#3E4237", fontSize: 15, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}>
        Hai fame? Ordina online
      </a>
    </div>
  );
}
