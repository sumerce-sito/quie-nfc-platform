-- QUIE NFC Platform - [DEMO] seed data
-- Target: AWS Aurora PostgreSQL Serverless v2, PostgreSQL 15+

BEGIN;

INSERT INTO productos (
  id,
  nombre,
  categoria,
  color,
  descripcion,
  imagen_url,
  precio,
  activo
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '[DEMO] Tarjetero Origen',
    'tarjetero',
    'Negro profundo',
    '[DEMO] Tarjetero artesanal QUIE con autenticidad NFC y acabado sobrio para uso diario.',
    'https://quie-nfc-platform.vercel.app/assets/quie/productos/tarjetero.png',
    89000.00,
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '[DEMO] Billetera Raiz',
    'billetera',
    'Cafe miel',
    '[DEMO] Billetera en cuero trabajada a mano, con memoria de oficio y trazabilidad digital.',
    'https://quie-nfc-platform.vercel.app/assets/quie/productos/billetera.png',
    149000.00,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '[DEMO] Bolso Tierra',
    'bolso',
    'Terracota',
    '[DEMO] Bolso de autor con sello NFC QUIE para contar su origen, su artesano y su historia.',
    'https://quie-nfc-platform.vercel.app/assets/quie/productos/bolso.png',
    289000.00,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  categoria = EXCLUDED.categoria,
  color = EXCLUDED.color,
  descripcion = EXCLUDED.descripcion,
  imagen_url = EXCLUDED.imagen_url,
  precio = EXCLUDED.precio,
  activo = EXCLUDED.activo;

INSERT INTO artesanos (
  id,
  nombre,
  ciudad,
  region,
  especialidad,
  historia,
  foto_url,
  activo
)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '[DEMO] Maestro Artesano de Bogota',
  'Bogota',
  'Cundinamarca',
  'Marroquineria artesanal',
  '[DEMO] Entre el pulso de Bogota y el silencio del taller, el maestro transforma cuero, hilo y paciencia en piezas que guardan memoria. Cada puntada nace del oficio heredado y cada marca del material conserva la dignidad de lo hecho a mano.',
  'https://quie-nfc-platform.vercel.app/assets/quie/brand/quie.png',
  true
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  ciudad = EXCLUDED.ciudad,
  region = EXCLUDED.region,
  especialidad = EXCLUDED.especialidad,
  historia = EXCLUDED.historia,
  foto_url = EXCLUDED.foto_url,
  activo = EXCLUDED.activo;

INSERT INTO lotes (
  id,
  nombre,
  fecha_produccion,
  estado,
  total_tags,
  producto_id,
  artesano_id
)
VALUES
  (
    'QUIE-TARJETERO-2026-001',
    '[DEMO] Lote inicial tarjeteros',
    '2026-06-10',
    'activo',
    1,
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    'QUIE-BILLETERA-2026-001',
    '[DEMO] Lote inicial billeteras',
    '2026-06-10',
    'activo',
    1,
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    'QUIE-BOLSO-2026-001',
    '[DEMO] Lote inicial bolsos',
    '2026-06-10',
    'activo',
    1,
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  fecha_produccion = EXCLUDED.fecha_produccion,
  estado = EXCLUDED.estado,
  total_tags = EXCLUDED.total_tags,
  producto_id = EXCLUDED.producto_id,
  artesano_id = EXCLUDED.artesano_id;

INSERT INTO codigos (
  codigo_nfc,
  lote_id,
  url_landing,
  producto_id,
  estado,
  propietario_nombre,
  propietario_whatsapp,
  propietario_ciudad,
  propietario_email,
  registrado_en,
  escaneado_count
)
VALUES
  (
    'QUIE-A7B3X9-42',
    'QUIE-TARJETERO-2026-001',
    'https://quie-nfc-platform.vercel.app/v/QUIE-A7B3X9-42',
    '11111111-1111-4111-8111-111111111111',
    'activo',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    0
  ),
  (
    'QUIE-ZD3PR5-24',
    'QUIE-BILLETERA-2026-001',
    'https://quie-nfc-platform.vercel.app/v/QUIE-ZD3PR5-24',
    '22222222-2222-4222-8222-222222222222',
    'activo',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    0
  ),
  (
    'QUIE-K9M2T1-87',
    'QUIE-BOLSO-2026-001',
    'https://quie-nfc-platform.vercel.app/v/QUIE-K9M2T1-87',
    '33333333-3333-4333-8333-333333333333',
    'activo',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    0
  )
ON CONFLICT (codigo_nfc) DO UPDATE SET
  lote_id = EXCLUDED.lote_id,
  url_landing = EXCLUDED.url_landing,
  producto_id = EXCLUDED.producto_id,
  estado = EXCLUDED.estado,
  escaneado_count = EXCLUDED.escaneado_count;

COMMIT;
