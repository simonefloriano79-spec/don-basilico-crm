-- Numero di pizze Just Eat della serata, inserito a mano nella pagina Conti (insieme agli importi).
-- Da eseguire una volta nell'editor SQL di Supabase (dopo conti_je.sql). Sicuro da rieseguire.

alter table conti_je add column if not exists pizze integer not null default 0;
