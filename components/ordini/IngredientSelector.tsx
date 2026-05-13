"use client";

import { useState } from "react";

interface Ingrediente {
  id: string;
  nome: string;
  prezzoAggiunta: number;
  isAllergene: boolean;
  disabilitatoInSede?: boolean;
}

interface Props {
  ingredientiPizza: Ingrediente[];   // ingredienti base della pizza
  tuttiIngredienti: Ingrediente[];   // tutti gli ingredienti disponibili
  onCambiamento: (rimossi: string[], aggiunti: { id: string; nome: string; prezzo: number }[]) => void;
}

export function IngredientSelector({ ingredientiPizza, tuttiIngredienti, onCambiamento }: Props) {
  const [rimossi, setRimossi] = useState<Set<string>>(new Set());
  const [aggiunti, setAggiunti] = useState<Map<string, { id: string; nome: string; prezzo: number }>>(new Map());
  const [showExtra, setShowExtra] = useState(false);

  const toggleRimuovi = (id: string) => {
    const nuovi = new Set(rimossi);
    if (nuovi.has(id)) nuovi.delete(id);
    else nuovi.add(id);
    setRimossi(nuovi);
    onCambiamento(Array.from(nuovi), Array.from(aggiunti.values()));
  };

  const toggleAggiungi = (ing: Ingrediente) => {
    const nuovi = new Map(aggiunti);
    if (nuovi.has(ing.id)) {
      nuovi.delete(ing.id);
    } else {
      nuovi.set(ing.id, { id: ing.id, nome: ing.nome, prezzo: parseFloat(ing.prezzoAggiunta.toString()) });
    }
    setAggiunti(nuovi);
    onCambiamento(Array.from(rimossi), Array.from(nuovi.values()));
  };

  const baseIds = new Set(ingredientiPizza.map(i => i.id));
  const extraDisponibili = tuttiIngredienti.filter(
    i => !baseIds.has(i.id) && !i.disabilitatoInSede && parseFloat(i.prezzoAggiunta?.toString() ?? "0") >= 0
  );

  const prezzoExtra = Array.from(aggiunti.values()).reduce((acc, i) => acc + i.prezzo, 0);

  return (
    <div style={{ marginTop: 8 }}>
      {/* INGREDIENTI BASE — rimuovibili */}
      {ingredientiPizza.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Ingredienti inclusi (tocca per rimuovere)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ingredientiPizza.map(ing => {
              const rimosso = rimossi.has(ing.id);
              const esaurito = ing.disabilitatoInSede;
              return (
                <button
                  key={ing.id}
                  onClick={() => !esaurito && toggleRimuovi(ing.id)}
                  disabled={esaurito}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontFamily: "var(--font-sans)",
                    cursor: esaurito ? "not-allowed" : "pointer",
                    border: "1px solid",
                    transition: "all 0.15s",
                    background: rimosso
                      ? "rgba(200,64,64,0.15)"
                      : esaurito
                      ? "rgba(138,122,101,0.1)"
                      : "rgba(74,158,107,0.15)",
                    borderColor: rimosso ? "#c84040" : esaurito ? "var(--border)" : "#4a9e6b",
                    color: rimosso ? "#c84040" : esaurito ? "var(--text-dim)" : "#4a9e6b",
                    textDecoration: rimosso ? "line-through" : "none",
                  }}
                >
                  {rimosso ? "✗ " : esaurito ? "— " : "✓ "}{ing.nome}
                  {esaurito && <span style={{ fontSize: 9, marginLeft: 4 }}>esaurito</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* EXTRA — aggiungibili */}
      <div>
        <button
          onClick={() => setShowExtra(!showExtra)}
          style={{
            background: "transparent", border: "1px dashed var(--border)",
            color: "var(--text-dim)", padding: "5px 12px", borderRadius: 8,
            fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>+</span>
          Aggiungi ingredienti extra
          {aggiunti.size > 0 && (
            <span style={{ background: "var(--terracotta)", color: "white", padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
              {aggiunti.size}
            </span>
          )}
        </button>

        {showExtra && (
          <div style={{ marginTop: 8, padding: 12, background: "var(--surface-high)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {extraDisponibili.map(ing => {
                const aggiunto = aggiunti.has(ing.id);
                const prezzo = parseFloat(ing.prezzoAggiunta?.toString() ?? "0");
                return (
                  <button
                    key={ing.id}
                    onClick={() => toggleAggiungi(ing)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontFamily: "var(--font-sans)",
                      cursor: "pointer",
                      border: "1px solid",
                      transition: "all 0.15s",
                      background: aggiunto ? "rgba(200,90,46,0.15)" : "var(--surface)",
                      borderColor: aggiunto ? "var(--terracotta)" : "var(--border)",
                      color: aggiunto ? "var(--terracotta)" : "var(--text-dim)",
                    }}
                  >
                    {aggiunto ? "✓ " : "+ "}{ing.nome}
                    {prezzo > 0 && (
                      <span style={{ marginLeft: 4, fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.8 }}>
                        +€{prezzo.toFixed(2)}
                      </span>
                    )}
                    {ing.isAllergene && <span style={{ marginLeft: 3, fontSize: 10 }}>⚠️</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RIEPILOGO EXTRA */}
      {(rimossi.size > 0 || aggiunti.size > 0) && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 8, fontSize: 12 }}>
          {rimossi.size > 0 && (
            <div style={{ color: "#c84040", marginBottom: 2 }}>
              ✗ Senza: {ingredientiPizza.filter(i => rimossi.has(i.id)).map(i => i.nome).join(", ")}
            </div>
          )}
          {aggiunti.size > 0 && (
            <div style={{ color: "var(--terracotta)" }}>
              + Aggiunti: {Array.from(aggiunti.values()).map(i => i.nome).join(", ")}
            </div>
          )}
          {prezzoExtra > 0 && (
            <div style={{ color: "#d4a853", fontFamily: "var(--font-mono)", marginTop: 4, fontWeight: 600 }}>
              Extra: +€{prezzoExtra.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
