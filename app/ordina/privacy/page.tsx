import { TITOLARE } from "@/lib/privacy";

// Informativa privacy dell'app ordini (art. 13 GDPR). BOZZA: va verificata dal titolare/consulente prima del lancio.
export const metadata = { title: "Informativa privacy — Don Basilico" };

const h2: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text)", margin: "22px 0 6px" };
const p: React.CSSProperties = { fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 8px" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 40 }}>
      <img src="/brand/don-basilico-logo.png" alt="Don Basilico" style={{ display: "block", width: 118, height: "auto", margin: "4px auto 16px" }} />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", textAlign: "center" }}>Informativa privacy</h1>
      <p style={{ ...p, textAlign: "center", color: "var(--text-muted)" }}>Ordini online e tessera fedeltà Don Basilico</p>

      <h2 style={h2}>Chi tratta i tuoi dati</h2>
      <p style={p}>
        Titolare del trattamento: <strong>{TITOLARE.ragioneSociale}</strong>
        {TITOLARE.indirizzo ? `, ${TITOLARE.indirizzo}` : ""}
        {TITOLARE.partitaIva ? `, P.IVA ${TITOLARE.partitaIva}` : ""}.
        {TITOLARE.emailPrivacy ? ` Per le richieste sulla privacy: ${TITOLARE.emailPrivacy}.` : " Per le richieste sulla privacy puoi rivolgerti a una qualsiasi pizzeria Don Basilico."}
      </p>

      <h2 style={h2}>Quali dati e perché</h2>
      <p style={p}><strong>Per gestire il tuo ordine</strong> (necessario): nome, numero di telefono, indirizzo di consegna e citofono (per i domicili), contenuto e importo dell'ordine, orario richiesto. Servono per preparare e consegnare l'ordine, contattarti in caso di problemi e inviarti il codice di accesso e l'SMS di conferma.</p>
      <p style={p}><strong>Per la tessera fedeltà</strong>: telefono, nome, storico degli ordini e degli importi, per assegnare timbri e sconti (ogni 5 ordini, sconto del 10% sulla spesa del ciclo). La tessera si attiva con la registrazione.</p>
      <p style={p}><strong>Per comunicazioni promozionali</strong> (facoltativo): solo se dai il consenso con l'apposita casella, per inviarti offerte e novità. Puoi non darlo e ordinare comunque.</p>

      <h2 style={h2}>A chi li comunichiamo</h2>
      <p style={p}>Al personale della pizzeria che prepara e consegna l'ordine e ai fornitori tecnici che ci permettono di offrire il servizio (hosting, database, invio SMS e verifica del numero di telefono, mappe per le zone di consegna), che trattano i dati solo per nostro conto. Non vendiamo i tuoi dati.</p>

      <h2 style={h2}>Per quanto tempo</h2>
      <p style={p}>Per il tempo necessario alle finalità indicate; i dati degli ordini che servono alla contabilità sono conservati per i termini previsti dalla legge. I dati della tessera restano finché la tessera è attiva; puoi chiederne la cancellazione in qualsiasi momento.</p>

      <h2 style={h2}>I tuoi diritti</h2>
      <p style={p}>Puoi chiedere accesso, rettifica, cancellazione, limitazione e portabilità dei tuoi dati, opporti al trattamento e revocare in qualsiasi momento il consenso al marketing, senza effetti sui trattamenti già fatti. Puoi presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>
    </div>
  );
}
