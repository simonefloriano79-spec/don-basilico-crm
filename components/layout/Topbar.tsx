"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Session } from "next-auth";

const PAGES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":     { title: "Panoramica",    subtitle: "servizio serale" },
  "/ordini":        { title: "Ordini",        subtitle: "flusso live di tutte le sedi" },
  "/nuovo-ordine":  { title: "Nuovo ordine",  subtitle: "cassa e telefono" },
  "/kds":           { title: "Cucina",        subtitle: "coda di preparazione" },
  "/schermo-cassa": { title: "Ordini vocali", subtitle: "cassa telefonica assistita" },
  "/clienti":       { title: "Clienti",       subtitle: "anagrafiche · fidelity attiva" },
  "/statistiche":   { title: "Report",        subtitle: "andamento rete" },
  "/menu":          { title: "Menù",          subtitle: "listino e disponibilità" },
  "/ingredienti":   { title: "Ingredienti",   subtitle: "magazzino e scorte" },
  "/sedi":          { title: "Sedi",          subtitle: "punti vendita" },
  "/utenti":        { title: "Utenti",        subtitle: "accessi e ruoli" },
  "/profilo":       { title: "Profilo",       subtitle: "account e password" },
};

const OGGI = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long" });

interface Sede { id: string; nome: string; }

export function Topbar({ session }: { session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";

  const [sedi, setSedi] = useState<Sede[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/sedi")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSedi(Array.isArray(data) ? data : []))
      .catch(() => setSedi([]));
  }, [isSuperAdmin]);

  const page = PAGES[pathname] ?? { title: "Don Basilico", subtitle: "" };
  const subtitle = pathname === "/dashboard" ? `${OGGI} · ${page.subtitle}` : page.subtitle;
  const sedeAttiva = searchParams.get("sede") ?? "";

  function cambiaSede(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("sede", value);
    else params.delete("sede");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <header
      style={{
        height: 64, background: "var(--surface)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 26px", gap: 16, flexShrink: 0,
      }}
    >
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 500,
        color: "var(--text)", letterSpacing: "-.2px", whiteSpace: "nowrap",
      }}>
        {page.title}
      </h1>
      {subtitle && (
        <span style={{
          fontSize: 12, color: "var(--text-muted)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {subtitle}
        </span>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
            animation: "db-pulse 2.4s infinite",
          }} />
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Live · aggiornato ora</span>
        </div>

        {isSuperAdmin && (
          <select
            value={sedeAttiva}
            onChange={(e) => cambiaSede(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)",
              fontSize: 12.5, background: "#fff", color: "var(--text-2)", fontFamily: "var(--font-ui)",
            }}
          >
            <option value="">Tutte le sedi</option>
            {sedi.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        )}

        {!isSuperAdmin && user.sedeNome && (
          <span style={{
            background: "var(--surface-muted)", border: "1px solid var(--border)",
            color: "var(--text-3)", padding: "6px 12px", borderRadius: 8, fontSize: 12,
          }}>
            {user.sedeNome}
          </span>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            background: "#fff", border: "1px solid var(--border)",
            color: "var(--text-2)", padding: "7px 14px", borderRadius: 8, fontSize: 12.5,
            cursor: "pointer", fontFamily: "var(--font-ui)",
          }}
        >
          Esci
        </button>
      </div>
    </header>
  );
}
