# 🍕 Don Basilico CRM

Sistema di gestione ordini omnicanale per la catena Don Basilico (Pitta srl).

## Stack
- **Frontend**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma (Supabase)
- **Auth**: NextAuth.js
- **Deploy**: Vercel
- **Stampa**: Browser print (fase 1) → PrintNode (fase 2)

## Funzionalità
- ✅ 3 canali ordini: Online, Walk-in, Telefono
- ✅ 6 sedi con menù base condiviso + override per sede
- ✅ Schermo cucina (KDS) in tempo reale
- ✅ Stampa termica ordini (browser print)
- ✅ Dashboard con stats live
- ✅ Ruoli: Super Admin / Sede Manager / Operatore
- ✅ Gestione menù globale (admin) + disabilitazione prodotti/ingredienti (sede)

## Setup Rapido

### 1. Installa dipendenze
\`\`\`bash
npm install
\`\`\`

### 2. Configura variabili d'ambiente
Copia \`.env.example\` in \`.env.local\` e compila i valori.

**Supabase URL**: `db.wgvuhjfszfzmzlhvizph.supabase.co`

### 3. Genera Prisma client
\`\`\`bash
npm run db:generate
\`\`\`

### 4. Deploy su Vercel
Collega questo repo a Vercel e aggiungi le env vars nel pannello Vercel.

## Variabili Vercel da impostare
| Variabile | Valore |
|-----------|--------|
| `DATABASE_URL` | Connection string Supabase (con pgbouncer) |
| `DIRECT_URL` | Direct connection string Supabase |
| `NEXTAUTH_URL` | https://don-basilico-crm.vercel.app |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |

## Stampanti
Fase 1 (attuale): stampa via browser window.print() — funziona con qualsiasi stampante collegata al PC/tablet.

Fase 2 (roadmap): PrintNode API per stampa automatica senza click.

## Struttura progetto
\`\`\`
app/
├── (crm)/           # Route protette (layout con sidebar)
│   ├── dashboard/
│   ├── ordini/
│   ├── nuovo-ordine/
│   ├── kds/         # Schermo cucina
│   ├── menu/
│   └── sedi/
├── api/             # API Routes
│   ├── ordini/
│   ├── menu/
│   ├── sedi/
│   └── stats/
└── login/
\`\`\`
