-- Registro di chi accende o spegne gli ordini online di una sede (pagina Online del CRM).
-- Da eseguire una volta nell'editor SQL di Supabase. Sicuro da rieseguire.

create table if not exists registro_ordini_online (
  id uuid primary key default gen_random_uuid(),
  sede_id text not null,
  sede_nome text not null,
  attivi boolean not null,
  utente_id text,
  utente_nome text,
  created_at timestamptz not null default now()
);

create index if not exists registro_ordini_online_created_at_idx on registro_ordini_online (created_at);
create index if not exists registro_ordini_online_sede_id_idx on registro_ordini_online (sede_id);
