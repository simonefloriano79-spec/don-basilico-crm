-- Notifiche push dell'app nativa (Android/iOS, Firebase): un token per ogni telefono collegato a un cliente.
-- Da eseguire una volta nell'editor SQL di Supabase. Sicuro da rieseguire.

create table if not exists push_token_nativi (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clienti(id) on delete cascade,
  token text not null unique,
  piattaforma text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_token_nativi_cliente_id_idx on push_token_nativi (cliente_id);
