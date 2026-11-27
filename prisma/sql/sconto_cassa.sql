-- Sconto netto in euro fatto in cassa (es. a un amico), già sottratto dal totale dell'ordine.
ALTER TABLE ordini ADD COLUMN IF NOT EXISTS sconto_cassa numeric(10,2) NOT NULL DEFAULT 0;
