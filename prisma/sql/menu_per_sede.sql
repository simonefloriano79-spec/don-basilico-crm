-- Menù personalizzabile per sede: un prodotto con sede_id è visibile solo in quella pizzeria; senza sede_id è di tutte.
-- Da eseguire una volta nell'editor SQL di Supabase PRIMA di pubblicare il codice. Sicuro da rieseguire.
-- Nessun prodotto esistente cambia: restano tutti comuni (sede_id vuoto).

alter table menu_items add column if not exists sede_id uuid references sedi(id) on delete cascade;
create index if not exists menu_items_sede_id_idx on menu_items (sede_id);
