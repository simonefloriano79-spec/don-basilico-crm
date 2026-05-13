"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Session } from "next-auth";
import styles from "./Sidebar.module.css";

interface Props {
  session: Session;
}

export function Sidebar({ session }: Props) {
  const pathname = usePathname();
  const user = session.user as any;
  const isSuperAdmin = user.ruolo === "super_admin";

  const navItems = [
    { href: "/dashboard", icon: "◈", label: "Dashboard" },
    { href: "/ordini", icon: "≡", label: "Ordini" },
    { href: "/nuovo-ordine", icon: "+", label: "Nuovo Ordine" },
    { href: "/kds", icon: "⊞", label: "Cucina (KDS)" },
    { href: "/menu", icon: "♦", label: "Menù" },
    ...(isSuperAdmin ? [{ href: "/sedi", icon: "⊙", label: "Sedi" }] : []),
    ...(isSuperAdmin ? [{ href: "/utenti", icon: "●", label: "Utenti" }] : []),
  ];

  const initials = (user.name ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <img
            className={styles.logoImage}
            src="/brand/don-basilico-logo-header.png"
            alt="Don Basilico - Naturalmente Pizza"
          />
        </div>
        <div className={styles.logoSub}>Sistema ordini</div>
      </div>

      <div className={styles.nav}>
        <div className={styles.sectionLabel}>Navigazione</div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${pathname === item.href ? styles.active : ""}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.userPill}>
          <div className={styles.avatar}>{initials}</div>
          <div>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>
              {isSuperAdmin ? "Super Admin" : user.sedeNome ?? "Operatore"}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
