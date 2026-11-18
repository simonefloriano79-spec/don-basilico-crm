"use client";

import { useEffect } from "react";
import { inAppNativa } from "@/lib/app-nativa";
import { segnala } from "@/lib/eventi-app";

// Conta (in modo anonimo) quando l'app viene aperta dall'icona sul telefono: sia quella installata dal browser sia quella degli store.
export default function EventiApertura() {
  useEffect(() => {
    if (inAppNativa()) { segnala("apertura_nativa", { unaVolta: true }); return; }
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true) segnala("apertura_app", { unaVolta: true });
  }, []);
  return null;
}
