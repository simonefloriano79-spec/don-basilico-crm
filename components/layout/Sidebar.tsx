"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Session } from "next-auth";
import styles from "./Sidebar.module.css";

interface Props { session: Session; }

export function Sidebar({ session }: Props) {
  const pathname = usePathname();
  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";

  const sections = [
    {
      label: "Operatività",
      items: [
        { href: "/dashboard",     glyph: "◇", label: "Panoramica"   },
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
