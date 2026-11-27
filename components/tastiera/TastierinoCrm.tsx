"use client";

// Tastierino del CRM: sugli schermi grandi sostituisce la tastiera di Windows in OGNI campo dove si scrivono testo o
// numeri (cassa, menù, ingredienti, clienti, conti, accesso…). Sul telefono resta la tastiera del telefono.
// Per un campo particolare si può forzare il tipo con data-tast="t" | "n" | "o".
import { useEffect, useState } from "react";
import Tastiera, { type CampoTesto, type ModoTastiera } from "./Tastiera";

const CHIAVE = "cassa_tastierino";
const EVENTO = "tastierino-cambiato";
const TIPI = ["", "text", "search", "email", "password", "tel", "url", "number"];
let sceltaSenzaMemoria: boolean | null = null; // se il browser non lascia salvare la scelta

// Acceso di default sugli schermi touch larghi; la scelta fatta col tasto in alto resta su quel computer.
function acceso(): boolean {
  if (window.innerWidth <= 900) return false;
  let salvato: string | null = null;
  try { salvato = localStorage.getItem(CHIAVE); } catch { /* storage non disponibile */ }
  if (salvato) return salvato === "1";
  return sceltaSenzaMemoria ?? navigator.maxTouchPoints > 0;
}

export function useTastierino() {
  const [attivo, setAttivo] = useState(false);
  const [schermoLargo, setSchermoLargo] = useState(false);
  useEffect(() => {
    const aggiorna = () => { setSchermoLargo(window.innerWidth > 900); setAttivo(acceso()); };
    aggiorna();
    window.addEventListener(EVENTO, aggiorna);
    return () => window.removeEventListener(EVENTO, aggiorna);
  }, []);
  const cambia = () => {
    const nuovo = !acceso();
    sceltaSenzaMemoria = nuovo;
    try { localStorage.setItem(CHIAVE, nuovo ? "1" : "0"); } catch { /* storage non disponibile */ }
    window.dispatchEvent(new Event(EVENTO));
  };
  return { attivo, schermoLargo, cambia };
}

export function PulsanteTastierino() {
  const { attivo, schermoLargo, cambia } = useTastierino();
  if (!schermoLargo) return null;
  return (
    <button type="button" onClick={cambia} style={{
      padding: "7px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)", flexShrink: 0,
      border: "1px solid var(--border)", background: attivo ? "var(--text)" : "#fff", color: attivo ? "#fff" : "var(--text-3)",
    }}>⌨ Tastierino {attivo ? "acceso" : "spento"}</button>
  );
}

function adatto(el: unknown): el is CampoTesto {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  return el instanceof HTMLInputElement && TIPI.includes((el.getAttribute("type") ?? "").toLowerCase()) && !el.readOnly && !el.disabled;
}

function modoDi(el: CampoTesto): ModoTastiera {
  const forzato = el.getAttribute("data-tast");
  if (forzato === "t" || forzato === "n" || forzato === "o") return forzato;
  const tipo = el.getAttribute("type") ?? "";
  const originale = el.getAttribute("data-tast-im") ?? el.getAttribute("inputmode") ?? "";
  return tipo === "tel" || tipo === "number" || ["numeric", "decimal", "tel"].includes(originale) ? "n" : "t";
}

export default function TastierinoCrm() {
  const { attivo } = useTastierino();
  const [campo, setCampo] = useState<CampoTesto | null>(null);
  const [box, setBox] = useState({ sinistra: 12, larghezza: 600 });
  const aperto = attivo && !!campo;

  useEffect(() => {
    if (!attivo) { setCampo(null); return; }
    // inputmode="none" su tutti i campi: così la tastiera di Windows / del tablet non si apre.
    const prepara = () => {
      document.querySelectorAll("input, textarea").forEach((el) => {
        if (!adatto(el) || el.getAttribute("inputmode") === "none") return;
        el.setAttribute("data-tast-im", el.getAttribute("inputmode") ?? "");
        el.setAttribute("inputmode", "none");
      });
    };
    const controlla = () => {
      const a = document.activeElement;
      setCampo(adatto(a) ? a : null);
    };
    const fuoco = (e: FocusEvent) => { if (adatto(e.target)) setCampo(e.target); };
    // Un attimo di attesa: passando da un campo all'altro il tastierino resta aperto. E finché il dito (o il mouse)
    // è giù non si chiude: la finestra si muoverebbe sotto e il tocco finirebbe nel posto sbagliato.
    let premuto = false;
    const giu = () => { premuto = true; };
    const su = () => { premuto = false; };
    const lasciato = () => {
      if (premuto) document.addEventListener("pointerup", () => { setTimeout(controlla, 80); }, { once: true });
      else setTimeout(controlla, 80);
    };
    const osserva = new MutationObserver(() => {
      prepara();
      setCampo((c) => (c && !c.isConnected ? null : c)); // finestra chiusa con il campo ancora attivo
    });
    prepara();
    controlla();
    osserva.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", fuoco);
    document.addEventListener("focusout", lasciato);
    document.addEventListener("pointerdown", giu, true);
    document.addEventListener("pointerup", su, true);
    document.addEventListener("pointercancel", su, true);
    return () => {
      osserva.disconnect();
      document.removeEventListener("focusin", fuoco);
      document.removeEventListener("focusout", lasciato);
      document.removeEventListener("pointerdown", giu, true);
      document.removeEventListener("pointerup", su, true);
      document.removeEventListener("pointercancel", su, true);
      document.querySelectorAll("[data-tast-im]").forEach((el) => {
        const prima = el.getAttribute("data-tast-im");
        if (prima) el.setAttribute("inputmode", prima); else el.removeAttribute("inputmode");
        el.removeAttribute("data-tast-im");
      });
    };
  }, [attivo]);

  // Con il tastierino aperto le finestre salgono sopra di lui e la pagina si può scorrere fino in fondo (globals.css).
  useEffect(() => {
    if (!aperto) return;
    document.documentElement.classList.add("tastierino-aperto");
    return () => document.documentElement.classList.remove("tastierino-aperto");
  }, [aperto]);

  useEffect(() => {
    if (!campo) return;
    const numerico = modoDi(campo) !== "t";
    // In cassa, per i campi del carrello, il tastierino sta sopra il menù a sinistra: così non copre mai il carrello.
    const area = campo.closest("[data-tast-carrello]") ? document.querySelector("[data-tast-area]")?.getBoundingClientRect() : null;
    if (area) {
      setBox({ sinistra: area.left, larghezza: Math.min(area.width, numerico ? 340 : 820) });
      return;
    }
    const larghezza = Math.min(window.innerWidth - 24, numerico ? 340 : 860);
    setBox({ sinistra: (window.innerWidth - larghezza) / 2, larghezza });
    // Si porta in vista il campo: nelle finestre sempre (si sono appena accorciate; un campo «Cerca» va in cima, così
    // sotto si vedono i risultati), nelle pagine solo se finirebbe sotto il tastierino.
    const giro = setTimeout(() => {
      if (campo.closest(".con-tastierino")) campo.scrollIntoView({ block: /cerca/i.test(campo.getAttribute("placeholder") ?? "") ? "start" : "nearest" });
      else if (campo.getBoundingClientRect().bottom > window.innerHeight - (numerico ? 290 : 350)) campo.scrollIntoView({ block: "center" });
    }, 60);
    return () => clearTimeout(giro);
  }, [campo]);

  if (!attivo || !campo) return null;
  return (
    <Tastiera key={`${campo.getAttribute("placeholder")}|${campo.getAttribute("type")}`} campo={campo} modo={modoDi(campo)}
      sinistra={box.sinistra} larghezza={box.larghezza} soloMaiuscole={!!campo.closest(".cassa-maiuscolo")}
      onChiudi={() => setCampo(null)} />
  );
}
