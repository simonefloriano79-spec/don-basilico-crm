import Image from "next/image";
import Link from "next/link";
import styles from "./presentazione.module.css";

const moduli = [
  {
    titolo: "Ordini e cucina",
    descrizione: "Gestione operativa degli ordini con stati chiari, canali di vendita e vista cucina dedicata.",
  },
  {
    titolo: "Clienti e sedi",
    descrizione: "Anagrafica clienti, controllo delle sedi e organizzazione centralizzata del lavoro quotidiano.",
  },
  {
    titolo: "Menu e ingredienti",
    descrizione: "Catalogo prodotti, ingredienti e struttura del menu pensati per un flusso rapido e ordinato.",
  },
  {
    titolo: "Statistiche",
    descrizione: "Indicatori sintetici per monitorare ordini, incassi, canali e andamento delle sedi.",
  },
];

const metriche = [
  { valore: "CRM", etichetta: "Sistema ordini" },
  { valore: "Multi-sede", etichetta: "Gestione centralizzata" },
  { valore: "Live", etichetta: "Flusso cucina" },
];

export default function PresentazionePage() {
  return (
    <main className={styles.pageShell}>
      <section className={styles.hero}>
        <div className={styles.heroCard}>
          <div className={styles.logoPlate}>
            <Image
              src="/brand/don-basilico-logo-header.png"
              alt="Don Basilico Naturalmente Pizza"
              width={520}
              height={231}
              priority
              className={styles.logo}
            />
          </div>
          <p className={styles.eyebrow}>Preview pubblica del sistema</p>
          <h1>Il CRM operativo per Don Basilico</h1>
          <p className={styles.heroText}>
            Una pagina condivisibile per mostrare il progetto a collaboratori, soci e interlocutori esterni senza esporre l’area riservata del CRM.
          </p>
          <div className={styles.actions}>
            <Link href="/login" className={styles.primaryAction}>
              Accedi all’area riservata
            </Link>
            <a href="#moduli" className={styles.secondaryAction}>
              Vedi cosa include
            </a>
          </div>
        </div>

        <div className={styles.previewPanel} aria-label="Anteprima interfaccia CRM">
          <div className={styles.previewTopbar}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.previewContent}>
            <div className={styles.sidebarMock}>
              <div className={styles.sidebarLogo}>Don Basilico</div>
              <div />
              <div />
              <div />
              <div />
            </div>
            <div className={styles.dashboardMock}>
              <div className={styles.dashboardHeader}>
                <div>
                  <span>Dashboard</span>
                  <strong>Ordini di oggi</strong>
                </div>
                <b>€ 1.248,50</b>
              </div>
              <div className={styles.cardsGrid}>
                {metriche.map((metrica) => (
                  <article key={metrica.etichetta}>
                    <strong>{metrica.valore}</strong>
                    <span>{metrica.etichetta}</span>
                  </article>
                ))}
              </div>
              <div className={styles.ordersMock}>
                <div><span>#1042</span><b>In preparazione</b><em>€ 32,00</em></div>
                <div><span>#1043</span><b>Pronto</b><em>€ 18,50</em></div>
                <div><span>#1044</span><b>Consegnato</b><em>€ 46,00</em></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="moduli" className={styles.modulesSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Moduli principali</p>
          <h2>Una vista chiara del progetto, senza condividere credenziali</h2>
          <p>
            Il link pubblico presenta il valore del CRM, mentre le funzioni operative restano protette dalla schermata di login.
          </p>
        </div>
        <div className={styles.modulesGrid}>
          {moduli.map((modulo) => (
            <article key={modulo.titolo} className={styles.moduleCard}>
              <h3>{modulo.titolo}</h3>
              <p>{modulo.descrizione}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.securityStrip}>
        <div>
          <p className={styles.eyebrow}>Condivisione sicura</p>
          <h2>Puoi mostrare la pagina a chi vuoi. Il CRM resta protetto.</h2>
        </div>
        <p>
          Questa presentazione è pubblica e non richiede password. L’accesso a ordini, clienti, utenti e statistiche continua invece a passare dalla login riservata.
        </p>
      </section>
    </main>
  );
}
