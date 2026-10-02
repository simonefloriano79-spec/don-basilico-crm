"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Session } from "next-auth";
import styles from "./Sidebar.module.css";

interface Props { session: Session; }

// Doppio "din" breve; se il browser blocca l'audio (nessun click ancora sulla pagina) non succede nulla.
function suonaNuovoOrdine() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = t ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

export function Sidebar({ session }: Props) {
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
        if (precedente.current !== null && d.n > precedente.current) suonaNuovoOrdine();
        precedente.current = d.n;
        setDaAccettare(d.n);
        setSospese(Array.isArray(d.sospese) ? d.sospese.length : 0);
      }).catch(() => {});
    carica();
    const iv = setInterval(carica, 15000);
    return () => { attivo = false; clearInterval(iv); };
  }, []);

  const sections = [
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
                {item.href === "/online" && sospese > 0 && (
                  <span title="Ordini online sospesi" style={{ marginLeft: "auto", background: "#fff", color: "var(--danger)", border: "1px solid var(--danger-border)", borderRadius: 20, fontSize: 10.5, fontWeight: 700, padding: "1px 7px" }}>
                    STOP
                  </span>
                )}
                {item.href === "/online" && daAccettare > 0 && (
                  <span style={{ marginLeft: "auto", background: "var(--danger)", color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 600, padding: "1px 8px" }}>
                    {daAccettare}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <Link href="/profilo" className={styles.userPill}>
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
