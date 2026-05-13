"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Session } from "next-auth";

const TITLES: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/ordini":       "Gestione Ordini",
  "/nuovo-ordine": "Nuovo Ordine",
  "/kds":          "Schermo Cucina",
  "/menu":         "Gestione Menù",
  "/ingredienti":  "Gestione Ingredienti",
  "/profilo":      "Il mio profilo",
  "/clienti":      "Clienti",
  "/statistiche":  "Statistiche",
  "/sedi":         "Sedi",
  "/utenti":       "Utenti",
};

export function Topbar({ session }: { session: Session }) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Don Basilico";
  const user = session.user as any;

  return (
    <header style={{
      height: 56, background: "var(--surface)", borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0,
    }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700, color: "var(--cream)" }}>
        {title}
      </h1>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {user.ruolo !== "super_admin" && user.sedeNome && (
          <span style={{
            background: "var(--surface-high)", border: "1px solid var(--border)",
            color: "var(--text-dim)", padding: "4px 12px", borderRadius: 8, fontSize: 12,
          }}>
            📍 {user.sedeNome}
          </span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--text-dim)", padding: "5px 12px", borderRadius: 8, fontSize: 12,
            cursor: "pointer", fontFamily: "var(--font-sans)",
          }}
        >
          Esci
        </button>
      </div>
    </header>
  );
}
