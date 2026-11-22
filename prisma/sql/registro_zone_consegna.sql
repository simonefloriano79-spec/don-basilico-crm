-- Registro di chi modifica la zona di consegna di una sede (pagina Sedi → Zona di consegna del CRM).
-- Da eseguire una volta nell'editor SQL di Supabase. Sicuro da rieseguire.

create table if not exists registro_zone_consegna (
  id uuid primary key default gen_random_uuid(),
  sede_id text not null,
  sede_nome text not null,
  n_aree integer not null,
  area_mq integer,
  forzata boolean not null default false,
  utente_id text,
  utente_nome text,
  created_at timestamptz not null default now()
);

create index if not exists registro_zone_consegna_created_at_idx on registro_zone_consegna (created_at);
create index if not exists registro_zone_consegna_sede_id_idx on registro_zone_consegna (sede_id);
