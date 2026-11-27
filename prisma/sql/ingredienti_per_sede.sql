-- Ingredienti per sede: un ingrediente con sede_id è visibile solo in quella pizzeria; senza sede_id è di tutte.
-- Da eseguire una volta nell'editor SQL di Supabase PRIMA di pubblicare il codice. Sicuro da rieseguire.
-- Nessun ingrediente esistente cambia: restano tutti comuni (sede_id vuoto).

alter table ingredienti add column if not exists sede_id uuid references sedi(id) on delete cascade;
create index if not exists ingredienti_sede_id_idx on ingredienti (sede_id);

-- Il nome era unico in assoluto: ora è unico tra i comuni e, a parte, dentro ogni pizzeria
-- (due pizzerie possono avere ciascuna il proprio «Tartufo»).
alter table ingredienti drop constraint if exists ingredienti_nome_key;
drop index if exists ingredienti_nome_key;
create unique index if not exists ingredienti_nome_comune_key on ingredienti (nome) where sede_id is null;
create unique index if not exists ingredienti_nome_sede_key on ingredienti (sede_id, lower(nome)) where sede_id is not null;
