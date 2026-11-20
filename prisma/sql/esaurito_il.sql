-- «Esaurito» che torna disponibile da solo il giorno dopo: segna quando un prodotto è stato messo «Esaurito» a mano.
-- Da eseguire una volta nell'editor SQL di Supabase PRIMA di pubblicare il codice. Sicuro da rieseguire.
-- Nessun dato esistente cambia: i prodotti già non disponibili (es. La Sfiziosa) restano com'è, senza reset automatico.

alter table sede_menu_override add column if not exists esaurito_il timestamptz;
