"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { PulsanteInstallaCrm, useInstallaCrm } from "./InstallaCrm";

interface Props {
  session: Session;
}

export function MobileNav({ session }: Props) {
  const pathname = usePathname();
  const user = session.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";
  const [altroAperto, setAltroAperto] = useState(false);
  const installaCrm = useInstallaCrm();

  // Come nella barra laterale del computer: ordini online da accettare e sedi con gli ordini online sospesi.
  const [daAccettare, setDaAccettare] = useState(0);
  const [sospese, setSospese] = useState(0);
  useEffect(() => {
    let attivo = true;
    const carica = () =>
      fetch("/api/ordini/da-accettare").then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!attivo || !d) return;
        setDaAccettare(d.n ?? 0);
        setSospese(Array.isArray(d.sospese) ? d.sospese.length : 0);
      }).catch(() => {});
    carica();
    const iv = setInterval(carica, 15000);
    return () => { attivo = false; clearInterval(iv); };
  }, []);

  // Si richiude da solo quando si cambia pagina.
  useEffect(() => { setAltroAperto(false); }, [pathname]);

  const navItems = [
    { href: "/dashboard",     icon: "◇", label: "Home"    },
    { href: "/ordini",        icon: "≡", label: "Ordini"  },
    { href: "/nuovo-ordine",  icon: "+", label: "Ordine"  },
    { href: "/kds",           icon: "◉", label: "Cucina"  },
    { href: "/menu",          icon: "◆", label: "Menù"    },
  ];

  // Tutto ciò che sul telefono non ha posto nella barra: la barra laterale qui è nascosta.
  const altro = [
    { href: "/online",          glyph: "☁", label: "Online" },
    { href: "/schermo-cassa",   glyph: "☏", label: "Ordini vocali" },
    { href: "/clienti",         glyph: "◍", label: "Clienti" },
    { href: "/statistiche",     glyph: "▤", label: "Report" },
    { href: "/statistiche-app", glyph: "◐", label: "App ordini" },
    { href: "/ingredienti",     glyph: "◈", label: "Ingredienti" },
    ...(isSuperAdmin ? [
      { href: "/sedi",          glyph: "⊙", label: "Sedi" },
      { href: "/codici-sconto", glyph: "%", label: "Codici sconto" },
      { href: "/utenti",        glyph: "◎", label: "Utenti" },
    ] : []),
    { href: "/profilo",         glyph: "○", label: "Profilo" },
  ];
  const altroAttivo = altro.some((a) => a.href === pathname);

  const voce = (opts: { icon: string; label: string; attiva: boolean; nuova?: boolean }) => (
    <>
      <span style={{ fontSize: opts.nuova ? 20 : 16, color: opts.nuova ? "#fff" : opts.attiva ? "var(--text)" : "var(--text-3)" }}>
        {opts.icon}
      </span>
      <span style={{ fontSize: 10, fontWeight: 500, color: opts.nuova ? "#fff" : opts.attiva ? "var(--text)" : "var(--text-3)", fontFamily: "var(--font-ui)" }}>
        {opts.label}
      </span>
    </>
  );
  const stileVoce = (attiva: boolean, nuova: boolean): React.CSSProperties => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
    flex: 1, padding: "6px 2px", borderRadius: 10, textDecoration: "none", minWidth: 0, position: "relative",
    background: nuova ? "var(--text)" : attiva ? "var(--accent-bg-2)" : "transparent",
    border: "none", cursor: "pointer", transition: "background .15s, color .15s",
  });

  return (
    <>
      {altroAperto && (
        <div
          onClick={() => setAltroAperto(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(28,29,24,0.45)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom))",
              background: "var(--surface)", borderTop: "1px solid var(--border)",
              borderRadius: "16px 16px 0 0", padding: "14px 12px 12px", maxHeight: "70vh", overflowY: "auto",
            }}
          >
            <PulsanteInstallaCrm stato={installaCrm} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {altro.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderRadius: 12,
                    border: "1px solid var(--border)", textDecoration: "none", fontSize: 13.5,
                    color: "var(--text)", fontFamily: "var(--font-ui)",
                    background: pathname === a.href ? "var(--accent-bg-2)" : "#fff",
                  }}
                >
                  <span style={{ fontSize: 16, color: "var(--text-3)", width: 18, textAlign: "center" }}>{a.glyph}</span>
                  {a.label}
                  {a.href === "/online" && daAccettare > 0 && (
                    <span style={{ marginLeft: "auto", background: "var(--danger)", color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 600, padding: "1px 8px" }}>{daAccettare}</span>
                  )}
                  {a.href === "/online" && daAccettare === 0 && sospese > 0 && (
                    <span title="Ordini online sospesi" style={{ marginLeft: "auto", background: "#fff", color: "var(--danger)", border: "1px solid var(--danger-border)", borderRadius: 20, fontSize: 10.5, fontWeight: 700, padding: "1px 7px" }}>STOP</span>
                  )}
                </Link>
              ))}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                marginTop: 10, width: "100%", padding: "13px 14px", borderRadius: 12, fontSize: 13.5,
                border: "1px solid var(--danger-border)", background: "#fff", color: "var(--danger)",
                cursor: "pointer", fontFamily: "var(--font-ui)",
              }}
            >
              Esci ({user?.name ?? "account"})
            </button>
          </div>
        </div>
      )}

      <nav className="mobile-nav" style={{ display: "none" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          const isNew = item.href === "/nuovo-ordine";
          return (
            <Link key={item.href} href={item.href} style={stileVoce(active, isNew)}>
              {voce({ icon: item.icon, label: item.label, attiva: active, nuova: isNew })}
            </Link>
          );
        })}
        <button type="button" onClick={() => setAltroAperto((v) => !v)} style={stileVoce(altroAperto || altroAttivo, false)} aria-expanded={altroAperto}>
          {voce({ icon: "⋯", label: "Altro", attiva: altroAperto || altroAttivo })}
          {/* Numero rosso = ordini online da accettare; pallino rosso = ci sono sedi con gli ordini online sospesi. */}
          {daAccettare > 0 ? (
            <span style={{ position: "absolute", top: 2, right: "18%", background: "var(--danger)", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, lineHeight: "16px", textAlign: "center", padding: "0 4px" }}>{daAccettare}</span>
          ) : sospese > 0 ? (
            <span title="Ordini online sospesi" style={{ position: "absolute", top: 4, right: "24%", width: 9, height: 9, borderRadius: "50%", background: "var(--danger)" }} />
          ) : null}
        </button>
      </nav>
    </>
  );
}
