"use client";

// Campo orario: col tastierino acceso si scrivono le cifre (2130 → 21:30); altrimenti è il normale campo ora.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTastierino } from "./TastierinoCrm";

const mascherata = (testo: string) => {
  const pulito = testo.replace(/[.,]/g, ":").replace(/[^\d:]/g, "").slice(0, 5);
  return /^\d{4}$/.test(pulito) ? `${pulito.slice(0, 2)}:${pulito.slice(2)}` : pulito;
};

// "930" o "9:30" → "09:30"; stringa vuota se l'orario non è completo o non esiste.
const completa = (testo: string) => {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(testo);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
};

export default function CampoOra({ value, onChange, style }: { value: string; onChange: (ora: string) => void; style?: CSSProperties }) {
  const { attivo } = useTastierino();
  const [testo, setTesto] = useState(value);
  const mandato = useRef(value);
  // Il valore cambiato da fuori (es. si apre un altro ordine) sostituisce quello scritto.
  useEffect(() => {
    if (value !== mandato.current) { mandato.current = value; setTesto(value); }
  }, [value]);

  const manda = (ora: string) => { mandato.current = ora; onChange(ora); };

  if (!attivo) {
    return <input type="time" style={style} value={value} onChange={(e) => { setTesto(e.target.value); manda(e.target.value); }} />;
  }
  return (
    <input type="text" data-tast="o" placeholder="es. 2130" style={style} value={testo}
      onChange={(e) => { const nuovo = mascherata(e.target.value); setTesto(nuovo); manda(completa(nuovo)); }}
      onBlur={() => { const ora = completa(testo); if (ora) setTesto(ora); }} />
  );
}
