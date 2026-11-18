-- Contatori anonimi dell'app ordini (pagina «Scarica l'app» vista, tocchi sui pulsanti, installazioni, aperture dall'app).
-- Nessun dato personale: niente nome, telefono, indirizzo IP o cookie. Solo tipo di evento, tipo di telefono e provenienza.
-- Da eseguire una volta nell'editor SQL di Supabase. Sicuro da rieseguire.

create table if not exists eventi_app (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  piattaforma text not null default 'altro',
  sorgente text,
  created_at timestamptz not null default now()
);

create index if not exists eventi_app_created_at_idx on eventi_app (created_at);
create index if not exists eventi_app_tipo_idx on eventi_app (tipo);
