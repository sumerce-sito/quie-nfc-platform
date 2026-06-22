-- QUIE NFC Platform - add modelo/color to lotes
-- Fixes "undefined · undefined" in admin "Mis lotes" list: the API was only
-- storing a combined `nombre` field, but the UI reads `modelo` and `color`.

BEGIN;

ALTER TABLE lotes ADD COLUMN IF NOT EXISTS modelo varchar(80);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS color varchar(50);

COMMIT;
