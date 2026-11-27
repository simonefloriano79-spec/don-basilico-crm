-- Vendite al banco (tranci) della sede Università: separate dagli ordini, così non toccano numeri comanda, lista ordini e cucina.
-- Da eseguire una volta nell'editor SQL di Supabase. Sicuro da rieseguire.

create table if not exists vendite_banco (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null,
  margherita int not null default 0,
  farcito int not null default 0,
  speciale int not null default 0,
  totale numeric(10,2) not null,
  utente_nome text,
  annullata boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists vendite_banco_sede_idx on vendite_banco (sede_id, created_at);

-- Si legge e si scrive solo dal CRM (server): chiusa all'accesso pubblico di Supabase.
alter table vendite_banco enable row level security;
