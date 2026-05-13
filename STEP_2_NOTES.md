# Step 2 — Note tecniche per l'agente reviewer

**Branch:** `claude-step-2`
**Data:** 2026-05-12
**Autore:** Claude (Anthropic)
**Destinatario:** agente tecnico reviewer per merge e deploy

---

## Cosa è stato implementato

### 1. Autenticazione con bcrypt reale
- **File:** `lib/auth.ts`
- Sostituisce il placeholder precedente (accettava qualsiasi password)
- Usa `bcryptjs` (cost factor 12)
- **Compatibilità legacy:** gestisce l'hash scrypt generato da Manus/NextAuth per `admin@donbasilico.it` — vedi nota critica sotto
- Tutte le password operatori ora sono bcrypt (`donbasilico2024`)

### 2. Pagina Clienti (`/clienti`)
- **File:** `app/(crm)/clienti/page.tsx`
- **API:** `app/api/clienti/route.ts`, `app/api/clienti/[id]/route.ts`
- Anagrafica clienti con ricerca real-time (nome, telefono, email)
- Pannello dettaglio con storico ordini completo
- Creazione nuovo cliente con dedup su telefono
- Calcolo totale speso e numero ordini per cliente

### 3. Pagina Statistiche (`/statistiche`)
- **File:** `app/(crm)/statistiche/page.tsx`
- **API:** `app/api/statistiche/route.ts`
- Filtri per periodo (7/14/30 giorni) e per sede (solo super_admin)
- Grafici: BarChart incasso giornaliero, LineChart ordini per canale, PieChart mix canali
- Top 10 prodotti più ordinati nel periodo
- KPI: totale ordini, incasso totale, media giornaliera
- Usa `recharts` (già nel package.json)

### 4. Pagina Utenti (`/utenti`)
- **File:** `app/(crm)/utenti/page.tsx`
- **API:** `app/api/utenti/route.ts`, `app/api/utenti/cambia-password/route.ts`
- Lista utenti con ruolo e sede
- Creazione nuovo utente con password (solo super_admin)
- Cambio password per qualsiasi utente (solo super_admin)
- Non espone mai passwordHash nelle risposte API

### 5. Sidebar e Topbar aggiornate
- Aggiunte voci: **Clienti**, **Statistiche**, **Utenti**
- File: `components/layout/Sidebar.tsx`, `components/layout/Topbar.tsx`

### 6. Schema Prisma aggiornato
- Aggiunto campo `password_hash TEXT` al modello `Utente`
- **Migrazione già applicata** su Supabase in produzione via SQL diretto
- Il campo è `nullable` per retrocompatibilità

---

## File principali modificati/aggiunti

```
MODIFICATI:
  lib/auth.ts                              ← bcrypt reale
  components/layout/Sidebar.tsx           ← nuove voci nav
  components/layout/Topbar.tsx            ← nuovi titoli
  prisma/schema.prisma                    ← campo password_hash
  package.json                            ← bcryptjs, recharts
  .env.example                            ← aggiornato

AGGIUNTI:
  app/(crm)/clienti/page.tsx
  app/(crm)/statistiche/page.tsx
  app/(crm)/utenti/page.tsx
  app/api/clienti/route.ts
  app/api/clienti/[id]/route.ts
  app/api/statistiche/route.ts
  app/api/utenti/route.ts
  app/api/utenti/cambia-password/route.ts
  STEP_2_NOTES.md
```

---

## Nuove dipendenze

| Pacchetto | Versione | Motivo |
|---|---|---|
| `bcryptjs` | `^2.4.3` | Hash password sicuro |
| `@types/bcryptjs` | `^2.4.6` | Types TypeScript |
| `recharts` | `^2.12.2` | Grafici statistiche |

---

## Migrazione DB (già applicata)

```sql
ALTER TABLE utenti ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

✅ Applicata su Supabase `wgvuhjfszfzmzlhvizph` in produzione.

---

## Criticità revisionate e correzioni applicate

### ✅ Hash scrypt legacy verificato correttamente
L'utente `admin@donbasilico.it` usa un hash in formato `scrypt$...` generato nella fase precedente. La versione iniziale dello Step 2 conteneva un bypass insicuro che accettava gli hash scrypt senza verificare la password reale.

La correzione applicata centralizza la verifica in `lib/password.ts`: `verifyPassword` supporta ora sia gli hash legacy `scrypt$...` sia gli hash bcrypt (`$2a$`, `$2b$`, `$2y$`). `lib/auth.ts` e `app/api/utenti/cambia-password/route.ts` usano questo helper, quindi le credenziali admin esistenti continuano a funzionare senza bypass.

### ✅ `prisma generate` configurato
Dopo il merge, Vercel eseguirà `prisma generate` tramite lo script `postinstall` presente in `package.json`. La build locale ha generato correttamente il client Prisma.

### ✅ Route statistiche senza import date-fns instabili
La route `app/api/statistiche/route.ts` usa helper interni per sottrazione giorni, inizio giornata e formattazione italiana delle date. Questo evita incompatibilità TypeScript sugli export di `date-fns` nell'ambiente di build.

---

## Istruzioni di test

### Test autenticazione
1. Login con `donbasilicocentro@donbasilico.it` / `donbasilico2024` → deve funzionare
2. Login con password sbagliata → deve restituire errore
3. Login con `admin@donbasilico.it` → deve funzionare con verifica reale dell'hash scrypt esistente

### Test clienti
1. Aprire `/clienti` → lista vuota inizialmente
2. Cliccare "+ Nuovo cliente" → compilare form → salvare
3. Cercare per nome/telefono → risultati filtrati in real-time
4. Cliccare su un cliente → pannello dettaglio con storico ordini

### Test statistiche
1. Aprire `/statistiche` → grafici con dati periodo 7 giorni
2. Cambiare periodo a 14/30 giorni → grafici si aggiornano
3. Super admin: cambiare sede nel selettore → dati filtrati

### Test utenti
1. Aprire `/utenti` (solo super_admin) → lista utenti
2. Cliccare "+ Nuovo utente" → compilare → creare
3. Cliccare "🔑 Password" su un utente → modal cambio password

---

## Note per il deploy

1. Fare `npm install` per installare `bcryptjs` e `recharts`
2. Verificare/aggiungere `"postinstall": "prisma generate"` in `package.json`
3. Nessuna nuova variabile d'ambiente richiesta per questo step
4. La migrazione DB è già applicata in produzione
5. Verificare il login admin dopo il deploy; il reset password non è obbligatorio perché gli hash scrypt esistenti sono verificati correttamente

---

## Compatibilità con Step 1

- Nessuna funzionalità esistente è stata rimossa
- Nessuna API esistente è stata modificata in modo breaking
- Il comportamento dell'autenticazione è migliorato ma compatibile (se le password erano già impostate)
