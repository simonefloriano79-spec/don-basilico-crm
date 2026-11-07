import { TITOLARE } from "@/lib/privacy";

// Pagina pubblica per chiedere la cancellazione dell'account e dei dati (richiesta da Google Play per le app con registrazione).
export const metadata = { title: "Elimina il tuo account — Don Basilico" };

const h2: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)", margin: "22px 0 6px" };
const p: React.CSSProperties = { fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 8px" };
const li: React.CSSProperties = { fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 4 };

export default function EliminaAccountPage() {
  const email = TITOLARE.emailPrivacy;
  const oggetto = encodeURIComponent("Eliminazione account Don Basilico");
  const corpo = encodeURIComponent("Chiedo l'eliminazione del mio account e dei miei dati.\n\nNumero di telefono dell'account: \nNome: ");
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 40 }}>
      <img src="/brand/don-basilico-logo.png" alt="Don Basilico" style={{ display: "block", width: 118, height: "auto", margin: "4px auto 16px" }} />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>Elimina il tuo account</h1>
      <p style={{ ...p, textAlign: "center", color: "var(--text-muted)" }}>App «Don Basilico – Ordina pizza» e sito ordina.donbasilico.it</p>

      <h2 style={h2}>Come chiedere l'eliminazione</h2>
      <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>
        <li style={li}>Scrivici da un indirizzo email qualsiasi a <a href={`mailto:${email}?subject=${oggetto}&body=${corpo}`} style={{ color: "var(--accent-ink)", textDecoration: "underline" }}>{email}</a> con oggetto «Eliminazione account Don Basilico».</li>
        <li style={li}>Indica il <strong>numero di telefono</strong> con cui ti sei registrato e il tuo nome.</li>
        <li style={li}>Per sicurezza ti chiediamo di confermare che il numero è tuo, con un SMS o una chiamata a quel numero.</li>
        <li style={li}>Eliminiamo l'account entro 30 giorni dalla conferma e ti scriviamo quando è fatto.</li>
      </ol>
      <p style={p}>In alternativa puoi chiederlo in una qualsiasi pizzeria Don Basilico mostrando il numero con cui ti sei registrato.</p>

      <h2 style={h2}>Quali dati vengono eliminati</h2>
      <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
        <li style={li}>Nome, numero di telefono e indirizzi di consegna salvati</li>
        <li style={li}>Tessera fedeltà, timbri e sconti accumulati</li>
        <li style={li}>Consensi privacy e marketing</li>
        <li style={li}>Iscrizioni alle notifiche sul telefono e nel browser</li>
      </ul>

      <h2 style={h2}>Quali dati possiamo conservare</h2>
      <p style={p}>Solo i dati degli ordini che la legge fiscale e contabile ci obbliga a conservare (importi, date, documenti), per il tempo previsto dalla legge. Non li usiamo per altri scopi.</p>

      <h2 style={h2}>Altri diritti</h2>
      <p style={p}>Per accedere ai tuoi dati, correggerli o fare reclamo vedi l'<a href="/ordina/privacy" style={{ color: "var(--accent-ink)", textDecoration: "underline" }}>informativa privacy</a>. Titolare del trattamento: {TITOLARE.ragioneSociale}, {TITOLARE.indirizzo}.</p>

      <h2 style={h2}>English summary</h2>
      <p style={p}>To delete your Don Basilico account and personal data, email {email} with the subject «Eliminazione account Don Basilico» and the phone number you registered with. We confirm ownership of the number, delete your profile, addresses, loyalty card, consents and notification tokens within 30 days, and keep only the order records that tax law requires us to retain.</p>
    </div>
  );
}
