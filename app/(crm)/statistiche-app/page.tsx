import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIPI_EVENTO, ETICHETTE_EVENTO } from "@/lib/eventi-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "App ordini — numeri" };

// Numeri dell'app ordini: quante persone vedono «Scarica l'app», toccano i pulsanti, installano, aprono l'app e si registrano.
// I contatori sono anonimi (tabella eventi_app) e partono dal giorno in cui è stata creata la tabella.

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 500, padding: "8px 10px", borderBottom: "1px solid var(--border)" };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "9px 10px", fontSize: 13, borderBottom: "1px solid var(--border)", color: "var(--text)" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

interface RigaTipo { tipo: string; oggi: number; sett: number; mese: number; totale: number }
interface RigaPiattaforma { tipo: string; piattaforma: string; n: number }
interface RigaSorgente { sorgente: string; n: number }
interface RigaGiorno { giorno: string; tipo: string; n: number }

const NOME_PIATTAFORMA: Record<string, string> = { android: "Android", ios: "iPhone", computer: "Computer", altro: "Altro" };

async function safe<T>(f: () => Promise<T>): Promise<T | null> {
  try { return await f(); } catch { return null; }
}

function dataIt(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default async function StatisticheAppPage() {
  // Pagina riservata alla direzione: gli account delle sedi vengono rimandati alla Panoramica.
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.ruolo !== "super_admin") redirect("/dashboard");

  const oggiRoma = "(now() at time zone 'Europe/Rome')::date";

  const [perTipo, perPiattaforma, perSorgente, perGiorno, primo, registratiOggi, registrati7, registratiTot, pushWeb, pushNativi] = await Promise.all([
    safe(() => prisma.$queryRawUnsafe<RigaTipo[]>(`
      select tipo,
        count(*) filter (where (created_at at time zone 'Europe/Rome')::date = ${oggiRoma})::int as oggi,
        count(*) filter (where created_at >= now() - interval '7 days')::int as sett,
        count(*) filter (where created_at >= now() - interval '30 days')::int as mese,
        count(*)::int as totale
      from eventi_app group by tipo`)),
    safe(() => prisma.$queryRawUnsafe<RigaPiattaforma[]>(`
      select tipo, piattaforma, count(*)::int as n from eventi_app
      where created_at >= now() - interval '30 days' group by tipo, piattaforma`)),
    safe(() => prisma.$queryRawUnsafe<RigaSorgente[]>(`
      select coalesce(sorgente, 'diretto') as sorgente, count(*)::int as n from eventi_app
      where tipo = 'pagina_app' and created_at >= now() - interval '30 days'
      group by 1 order by n desc limit 8`)),
    safe(() => prisma.$queryRawUnsafe<RigaGiorno[]>(`
      select to_char((created_at at time zone 'Europe/Rome')::date, 'YYYY-MM-DD') as giorno, tipo, count(*)::int as n from eventi_app
      where created_at >= now() - interval '14 days' group by 1, 2`)),
    safe(() => prisma.$queryRawUnsafe<{ d: string | null }[]>(`select to_char(min(created_at at time zone 'Europe/Rome'), 'DD/MM/YYYY') as d from eventi_app`)),
    safe(() => prisma.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int as n from clienti where telefono_verificato_at is not null and (telefono_verificato_at at time zone 'Europe/Rome')::date = ${oggiRoma}`)),
    safe(() => prisma.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int as n from clienti where telefono_verificato_at >= now() - interval '7 days'`)),
    safe(() => prisma.cliente.count({ where: { telefonoVerificatoAt: { not: null } } })),
    safe(() => prisma.pushIscrizione.count()),
    safe(() => prisma.$queryRawUnsafe<{ piattaforma: string; n: number }[]>(`select piattaforma, count(*)::int as n from push_token_nativi group by 1`)),
  ]);

  const tabellaMancante = perTipo === null;
  const tipoMap = new Map((perTipo ?? []).map((r) => [r.tipo, r]));

  // Ultimi 14 giorni (dal più recente), con i numeri che contano.
  const giorni: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() - i * 86400000);
    giorni.push(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(d)); // YYYY-MM-DD
  }
  const cella = (g: string, tipi: string[]) => (perGiorno ?? []).filter((r) => r.giorno === g && tipi.includes(r.tipo)).reduce((s, r) => s + r.n, 0);

  const piattaformeTipo = (tipo: string) => (perPiattaforma ?? []).filter((r) => r.tipo === tipo);
  const nativi = pushNativi ?? [];

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>App ordini — i numeri</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Contatori anonimi (nessun dato personale){primo?.[0]?.d ? <> — attivi dal <strong>{primo[0].d}</strong></> : null}. Le visite al sito per giorno, dispositivo e provenienza si vedono su Vercel → progetto → Analytics.
      </p>

      {tabellaMancante && (
        <div style={{ ...card, borderColor: "var(--danger)", marginBottom: 18, fontSize: 13, lineHeight: 1.5 }}>
          <strong>I contatori non sono ancora attivi.</strong> Va creata una volta la tabella nel database: apri l'editor SQL di Supabase ed esegui il contenuto del file <code>prisma/sql/eventi_app.sql</code>. Poi ricarica questa pagina.
        </div>
      )}

      {/* Persone registrate nell'app (telefono verificato): arrivano dai dati veri dei clienti, non dai contatori. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        <div style={card}><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.4 }}>Registrati oggi</div><div style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>{registratiOggi?.[0]?.n ?? "—"}</div></div>
        <div style={card}><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.4 }}>Registrati ultimi 7 giorni</div><div style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>{registrati7?.[0]?.n ?? "—"}</div></div>
        <div style={card}><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.4 }}>Registrati in tutto</div><div style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>{registratiTot ?? "—"}</div><div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>clienti con telefono verificato (comprese le prove)</div></div>
        <div style={card}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.4 }}>Notifiche attive</div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>{(pushWeb ?? 0) + nativi.reduce((s, r) => s + r.n, 0)}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
            telefoni: {pushWeb ?? 0} dal browser{nativi.map((r) => `, ${r.n} app ${NOME_PIATTAFORMA[r.piattaforma] ?? r.piattaforma}`).join("")}
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 18, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Cosa</th><th style={thNum}>Oggi</th><th style={thNum}>7 giorni</th><th style={thNum}>30 giorni</th><th style={thNum}>Totale</th></tr></thead>
          <tbody>
            {TIPI_EVENTO.map((t) => {
              const r = tipoMap.get(t);
              return (
                <tr key={t}>
                  <td style={td}>{ETICHETTE_EVENTO[t]}</td>
                  <td style={tdNum}>{tabellaMancante ? "—" : r?.oggi ?? 0}</td>
                  <td style={tdNum}>{tabellaMancante ? "—" : r?.sett ?? 0}</td>
                  <td style={tdNum}>{tabellaMancante ? "—" : r?.mese ?? 0}</td>
                  <td style={tdNum}>{tabellaMancante ? "—" : r?.totale ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!tabellaMancante && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Che telefono usano (ultimi 30 giorni)</div>
            {(["pagina_app", "tocco_play", "tocco_installa"] as const).map((t) => (
              <div key={t} style={{ fontSize: 12.5, marginBottom: 6, color: "var(--text-2)" }}>
                <span style={{ color: "var(--text-muted)" }}>{ETICHETTE_EVENTO[t]}: </span>
                {piattaformeTipo(t).length ? piattaformeTipo(t).sort((a, b) => b.n - a.n).map((r) => `${NOME_PIATTAFORMA[r.piattaforma] ?? r.piattaforma} ${r.n}`).join(" · ") : "—"}
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Da dove arrivano alla pagina «Scarica l'app» (30 giorni)</div>
            {(perSorgente ?? []).length ? (perSorgente ?? []).map((r) => (
              <div key={r.sorgente} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: "var(--text-2)" }}>
                <span>{r.sorgente}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{r.n}</span>
              </div>
            )) : <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Ancora nessun dato.</div>}
          </div>
        </div>
      )}

      {!tabellaMancante && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px 6px", fontSize: 12, fontWeight: 600 }}>Giorno per giorno (ultimi 14 giorni)</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Giorno</th><th style={thNum}>Pagina app aperta</th><th style={thNum}>Tocchi Scarica/Installa</th><th style={thNum}>Installazioni browser</th><th style={thNum}>Aperture app</th></tr></thead>
            <tbody>
              {giorni.map((g) => (
                <tr key={g}>
                  <td style={td}>{dataIt(g)}</td>
                  <td style={tdNum}>{cella(g, ["pagina_app"])}</td>
                  <td style={tdNum}>{cella(g, ["tocco_play", "tocco_installa"])}</td>
                  <td style={tdNum}>{cella(g, ["installata"])}</td>
                  <td style={tdNum}>{cella(g, ["apertura_app", "apertura_nativa"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 14 }}>
        Android: i download esatti dell'app da Google Play si vedono nella Play Console. Qui i «tocchi su Scarica da Google Play» dicono quante persone ci hanno provato partendo dal nostro sito.
      </p>
    </div>
  );
}
