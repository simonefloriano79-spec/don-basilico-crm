# Casistiche dell'assistente vocale

Qui si raccolgono le abitudini reali dei clienti al telefono. Ogni casistica ha due parti: una **regola nel motore** (se è «frase → pizza») e/o una **riga nel prompt** dell'agente su ElevenLabs (se è un comportamento).

## 1. Frasi che indicano una pizza precisa (nel motore)

File: `lib/ordini-vocali/casistiche.ts` → `CASISTICHE_PRODOTTI`.
Il motore prende **subito** quella pizza, senza elencare alternative e senza chiedere quale intende. L'ordine delle parole non conta e «una», «pizza», «e», «mi fai», «vorrei», «due»… vengono ignorati: «mi fai una funghi e prosciutto» = «prosciutto e funghi».

| Il cliente dice | Noi intendiamo |
|---|---|
| prosciutto e funghi | Cotto e Funghi |

Per aggiungerne una basta mandare: **frase/i che dicono i clienti** → **nome esatto della pizza nel menù**.

## 2. Comportamenti (nel prompt)

Sezione «Casistiche della pizzeria» del prompt dell'agente. Esempi di cose da segnalare:
- quando il cliente dice X, l'assistente deve chiedere Y (o NON chiedere Y);
- nomi di bevande, fritti o dolci detti in modo diverso dal menù;
- abbreviazioni, nomi dialettali, errori frequenti di pronuncia;
- cosa fare con richieste particolari (metà e metà, pizza senza mozzarella, ecc.).

Dopo ogni ordine di prova si leggono la trascrizione e i log dei tool per trovare i punti in cui l'assistente sbaglia: da lì nascono le nuove casistiche.
