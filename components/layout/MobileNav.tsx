"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Session } from "next-auth";

interface Props {
  session: Session;
}

export function MobileNav({ session }: Props) {
  const pathname = usePathname();
  const user = session.user as any;
  const isSuperAdmin = user?.ruolo === "super_admin";

  const navItems = [
    { href: "/dashboard",     icon: "◈", label: "Home"    },
    { href: "/ordini",        icon: "≡", label: "Ordini"  },
    { href: "/nuovo-ordine",  icon: "＋", label: "Ordine"  },
    { href: "/kds",           icon: "⊞", label: "Cucina"  },
    { href: "/menu",          icon: "♦", label: "Menù"    },
  ];

  return (
    <nav className="mobile-nav" style={{ display: "none" }}>
      {navItems.map((item) => {
        const active = pathname === item.href;
        const isNew = item.href === "/nuovo-ordine";
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              flex: 1,
              padding: "6px 4px",
              borderRadius: 10,
              textDecoration: "none",
              background: isNew
                ? "var(--terracotta)"
                : active
                ? "rgba(200,90,46,0.15)"
                : "transparent",
              border: isNew ? "none" : "none",
              transition: "all 0.15s",
            }}
          >
            <span style={{
              fontSize: isNew ? 22 : 18,
              color: isNew ? "white" : active ? "var(--terracotta)" : "var(--text-dim)",
            }}>
              {item.icon}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: isNew ? "white" : active ? "var(--terracotta)" : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
            }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
