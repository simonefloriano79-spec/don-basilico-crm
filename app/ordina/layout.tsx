import { ORDINA_BETA } from "@/lib/beta";

export default function OrdinaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header style={{
        padding: "18px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <img src="/brand/don-basilico-logo.svg" alt="Don Basilico" style={{ width: 120 }} />
        {ORDINA_BETA && (
          <span style={{ marginLeft: "auto", background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", color: "var(--text)", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "3px 10px" }}>
            BETA · versione di prova
          </span>
        )}
      </header>
      <main style={{ flex: 1, maxWidth: 640, width: "100%", margin: "0 auto", padding: "20px 16px 60px" }}>
        {children}
      </main>
    </div>
  );
}
