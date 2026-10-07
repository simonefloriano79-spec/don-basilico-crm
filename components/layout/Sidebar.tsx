"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Session } from "next-auth";
import styles from "./Sidebar.module.css";
import { ORDINA_BETA } from "@/lib/beta";
import { AutoStampa } from "./AutoStampa";
import { suonaNuovoOrdine } from "@/lib/suono-ordine";

// `pannello`: versione ridotta per il pannello ordini online (solo la voce Online); il suono lo gestisce il pannello.
interface Props { session: Session; pannello?: boolean; }

export function Sidebar({ session, pannello = false }: Props) {
  const pathname = usePathname();
  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";

  // Ordini online in attesa di accettazione: contatore sulla voce "Online" + suono se ne arriva uno nuovo.
  const [daAccettare, setDaAccettare] = useState(0);
  const [sospese, setSospese] = useState(0);
  const precedente = useRef<number | null>(null);
  useEffect(() => {
    let attivo = true;
    const carica = () =>
      fetch("/api/ordini/da-accettare").then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!attivo || !d) return;
        if (!pannello && precedente.current !== null && d.n > precedente.current) suonaNuovoOrdine();
        precedente.current = d.n;
        setDaAccettare(d.n);
        setSospese(Array.isArray(d.sospese) ? d.sospese.length : 0);
      }).catch(() => {});
    carica();
    const iv = setInterval(carica, 15000);
    return () => { attivo = false; clearInterval(iv); };
  }, []);

  const sezioniPannello = [
    { label: "Operatività", items: [{ href: "/pannello", glyph: "☁", label: "Online" }] },
  ];
  const sections = pannello ? sezioniPannello : [
    {
      label: "Operatività",
      items: [
        { href: "/dashboard",     glyph: "◇", label: "Panoramica"   },
        { href: "/online",        glyph: "☁", label: "Online"       },
        { href: "/ordini",        glyph: "≡", label: "Ordini"       },
        { href: "/nuovo-ordine",  glyph: "+", label: "Nuovo ordine" },
        { href: "/kds",           glyph: "◉", label: "Cucina"       },
        { href: "/schermo-cassa", glyph: "☏", label: "Ordini vocali" },
      ],
    },
    {
      label: "Direzione",
      items: [
        { href: "/clienti",     glyph: "◍", label: "Clienti" },
        { href: "/statistiche", glyph: "▤", label: "Report"  },
      ],
    },
    {
      label: "Configurazione",
      items: [
        { href: "/menu",        glyph: "◆", label: "Menù"        },
        { href: "/ingredienti", glyph: "◈", label: "Ingredienti" },
        ...(isSuperAdmin ? [
          { href: "/sedi",   glyph: "⊙", label: "Sedi"   },
          { href: "/utenti", glyph: "◎", label: "Utenti" },
        ] : []),
      ],
    },
  ];

  const initials = (user.name ?? "??")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/brand/don-basilico-logo.svg" alt="Don Basilico" className={styles.logoImg} />
        <div className={styles.logoSub}>Sistema ordini</div>
      </div>

      <div className={styles.nav}>
        {sections.map((section) => (
          <div key={section.label}>
            <div className={styles.sectionLabel}>{section.label}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${pathname === item.href ? styles.active : ""}`}
              >
                <span className={styles.icon}>{item.glyph}</span>
                {item.label}
                {(item.href === "/online" || item.href === "/pannello") && ORDINA_BETA && sospese === 0 && daAccettare === 0 && (
                  <span style={{ marginLeft: "auto", background: "var(--accent-bg-2)", border: "1px solid var(--accent-border)", color: "var(--text-2)", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, padding: "1px 7px" }}>
                    BETA
                  </span>
                )}
                {(item.href === "/online" || item.href === "/pannello") && sospese > 0 && (
                  <span title="Ordini online sospesi" style={{ marginLeft: "auto", background: "#fff", color: "var(--danger)", border: "1px solid var(--danger-border)", borderRadius: 20, fontSize: 10.5, fontWeight: 700, padding: "1px 7px" }}>
                    STOP
                  </span>
                )}
                {(item.href === "/online" || item.href === "/pannello") && daAccettare > 0 && (
                  <span style={{ marginLeft: "auto", background: "var(--danger)", color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 600, padding: "1px 8px" }}>
                    {daAccettare}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <AutoStampa sedeId={user.sedeId} isSuperAdmin={isSuperAdmin} />

      <div className={styles.footer}>
        <Link href={pannello ? "/pannello" : "/profilo"} className={styles.userPill}>
          <div className={styles.avatar}>{initials}</div>
          <div>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>
              {isSuperAdmin ? "super admin" : user.sedeNome ?? "operatore"}
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}
