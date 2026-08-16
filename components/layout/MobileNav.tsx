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
    { href: "/dashboard",     icon: "◇", label: "Home"    },
    { href: "/ordini",        icon: "≡", label: "Ordini"  },
    { href: "/nuovo-ordine",  icon: "+", label: "Ordine"  },
    { href: "/kds",           icon: "◉", label: "Cucina"  },
    { href: "/menu",          icon: "◆", label: "Menù"    },
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
                ? "var(--text)"
                : active
                ? "var(--accent-bg-2)"
                : "transparent",
              border: "none",
              transition: "background .15s, color .15s",
            }}
          >
            <span style={{
              fontSize: isNew ? 20 : 16,
              color: isNew ? "#fff" : active ? "var(--text)" : "var(--text-3)",
            }}>
              {item.icon}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: isNew ? "#fff" : active ? "var(--text)" : "var(--text-3)",
              fontFamily: "var(--font-ui)",
            }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
