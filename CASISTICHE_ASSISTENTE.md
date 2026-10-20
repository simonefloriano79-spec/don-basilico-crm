# Casistiche dell'assistente vocale

Qui si raccolgono le abitudini reali dei clienti al telefono. Ogni casistica ha due parti: una **regola nel motore** (se è «frase → pizza») e/o una **riga nel prompt** dell'agente su ElevenLabs (se è un comportamento).

## 1. Frasi dei clienti che indicano una pizza (nel motore)

File: `lib/ordini-vocali/casistiche.ts` → `CASISTICHE_PRODOTTI`.
L'ordine delle parole non conta e «una», «pizza», «e», «mi fai», «vorrei», «due»… vengono ignorati: «mi fai una funghi e prosciutto» = «prosciutto e funghi». Il motore cerca direttamente le pizze indicate, senza elencare altro. Due tipi:

- **Pizza precisa**: la frase indica una sola pizza (eventualmente con ingredienti da aggiungere) → l'assistente la prende subito.
- **Una domanda sola**: la frase è ambigua in un punto → l'assistente fa quella domanda e, in base alla risposta, usa la pizza corrispondente.

| Il cliente dice | Cosa succede |
|---|---|
| prosciutto e funghi | domanda: «Prosciutto crudo o prosciutto cotto?» → cotto = **Cotto e Funghi**; crudo = **Crudo** + funghi aggiunti |
| prosciutto crudo e funghi / crudo e funghi | **Crudo** + funghi aggiunti, senza domande |

Per aggiungerne una basta mandare: **frase/i che dicono i clienti** → **cosa deve succedere** (pizza esatta, ingredienti da aggiungere, eventuale domanda e risposte).

## 2. Comportamenti (nel prompt)

Sezione «Casistiche della pizzeria» del prompt dell'agente. Esempi di cose da segnalare:
- quando il cliente dice X, l'assistente deve chiedere Y (o NON chiedere Y);
- nomi di bevande, fritti o dolci detti in modo diverso dal menù;
- abbreviazioni, nomi dialettali, errori frequenti di pronuncia;
- cosa fare con richieste particolari (metà e metà, pizza senza mozzarella, ecc.).

Dopo ogni ordine di prova si leggono la trascrizione e i log dei tool per trovare i punti in cui l'assistente sbaglia: da lì nascono le nuove casistiche.
