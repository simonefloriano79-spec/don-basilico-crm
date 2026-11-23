-- Incasso Just Eat inserito a mano per sede e per serata (pagina Conti del CRM).
-- Da eseguire una volta nell'editor SQL di Supabase. Sicuro da rieseguire.

create table if not exists conti_je (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null,
  giorno date not null,
  gia_pagato numeric(10,2) not null default 0,
  contanti numeric(10,2) not null default 0,
  utente_id text,
  utente_nome text,
  updated_at timestamptz not null default now(),
  unique (sede_id, giorno)
);
