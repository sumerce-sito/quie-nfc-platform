-- QUIE NFC Platform - [DEMO] seed data
-- Use only in local/dev databases or hackathon demo environments.

BEGIN;

INSERT INTO productos (id, nombre, categoria, color, descripcion, imagen_url, sku, metadata)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '[DEMO] Bolso Tierra',
    'bolso',
    'Terracota',
    '[DEMO] Bolso premium inspirado en texturas artesanales colombianas.',
    'https://example.com/demo/bolso-tierra.jpg',
    'DEMO-BOL-TIERRA',
    '{"demo": true}'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '[DEMO] Maletin Selva',
    'maletin_ejecutivo',
    'Verde selva',
    '[DEMO] Maletin ejecutivo con autenticidad NFC QUIE.',
    'https://example.com/demo/maletin-selva.jpg',
    'DEMO-MAL-SELVA',
    '{"demo": true}'::jsonb
  )
ON CONFLICT (sku) DO NOTHING;

INSERT INTO lotes (id, nombre, fecha, estado, total_tags, categoria, secuencia, notes)
VALUES
  (
    'QUIE-BOL-2025-001',
    '[DEMO] Primer lote bolsos',
    '2025-06-01',
    'draft',
    2,
    'bolso',
    1,
    '[DEMO] Lote de prueba para validacion hackathon.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO codigos (
  codigo_nfc,
  lote_id,
  producto_id,
  url_landing,
  producto,
  estado,
  checksum,
  metadata
)
VALUES
  (
    'QUIE-A7B3X9-42',
    'QUIE-BOL-2025-001',
    '11111111-1111-4111-8111-111111111111',
    'http://localhost:3000/v/QUIE-A7B3X9-42',
    '[DEMO] Bolso Tierra',
    'generated',
    42,
    '{"demo": true}'::jsonb
  ),
  (
    'QUIE-K4M8P2-17',
    'QUIE-BOL-2025-001',
    '11111111-1111-4111-8111-111111111111',
    'http://localhost:3000/v/QUIE-K4M8P2-17',
    '[DEMO] Bolso Tierra',
    'generated',
    17,
    '{"demo": true}'::jsonb
  )
ON CONFLICT (codigo_nfc) DO NOTHING;

INSERT INTO auditoria (actor, accion, entidad, entidad_id, payload)
VALUES (
  'datavault',
  'seed_demo_loaded',
  'database',
  'aurora',
  '{"demo": true, "source": "database/aurora/002_seed_demo.sql"}'::jsonb
);

COMMIT;
