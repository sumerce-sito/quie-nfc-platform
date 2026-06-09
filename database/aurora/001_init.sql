-- QUIE NFC Platform - Aurora PostgreSQL initial schema
-- Target: PostgreSQL 15+ on Amazon Aurora

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lote_status') THEN
    CREATE TYPE lote_status AS ENUM ('draft', 'active', 'paused', 'closed', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'codigo_status') THEN
    CREATE TYPE codigo_status AS ENUM ('generated', 'written', 'active', 'claimed', 'suspicious', 'disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producto_categoria') THEN
    CREATE TYPE producto_categoria AS ENUM ('bolso', 'billetera', 'morral', 'cartera', 'cinturon', 'maletin_ejecutivo');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria producto_categoria NOT NULL,
  color text,
  descripcion text,
  imagen_url text,
  sku text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productos_nombre_not_blank CHECK (length(trim(nombre)) > 0),
  CONSTRAINT productos_imagen_url_http CHECK (
    imagen_url IS NULL OR imagen_url ~* '^https?://'
  )
);

CREATE TABLE IF NOT EXISTS lotes (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  fecha date NOT NULL DEFAULT current_date,
  estado lote_status NOT NULL DEFAULT 'draft',
  total_tags integer NOT NULL DEFAULT 0,
  categoria producto_categoria NOT NULL,
  secuencia integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lotes_id_format CHECK (id ~ '^QUIE-[A-Z0-9]{3,10}-[0-9]{4}-[0-9]{3}$'),
  CONSTRAINT lotes_nombre_not_blank CHECK (length(trim(nombre)) > 0),
  CONSTRAINT lotes_total_tags_non_negative CHECK (total_tags >= 0),
  CONSTRAINT lotes_secuencia_positive CHECK (secuencia > 0)
);

CREATE TABLE IF NOT EXISTS codigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_nfc text NOT NULL UNIQUE,
  lote_id text NOT NULL REFERENCES lotes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  producto_id uuid REFERENCES productos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  url_landing text NOT NULL,
  producto text,
  estado codigo_status NOT NULL DEFAULT 'generated',
  checksum smallint NOT NULL,
  written_at timestamptz,
  activated_at timestamptz,
  claimed_at timestamptz,
  disabled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codigos_codigo_nfc_format CHECK (codigo_nfc ~ '^QUIE-[A-Z0-9]{6}-[0-9]{2}$'),
  CONSTRAINT codigos_url_landing_http CHECK (url_landing ~* '^https?://'),
  CONSTRAINT codigos_checksum_range CHECK (checksum BETWEEN 0 AND 99)
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_id uuid REFERENCES codigos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  nombre text NOT NULL,
  whatsapp text,
  ciudad text,
  email text,
  foto_url text,
  consent_marketing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_nombre_not_blank CHECK (length(trim(nombre)) > 0),
  CONSTRAINT clientes_email_basic CHECK (
    email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT clientes_foto_url_http CHECK (
    foto_url IS NULL OR foto_url ~* '^https?://'
  )
);

CREATE TABLE IF NOT EXISTS auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_accion_not_blank CHECK (length(trim(accion)) > 0),
  CONSTRAINT auditoria_entidad_not_blank CHECK (length(trim(entidad)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_lotes_estado_fecha ON lotes(estado, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_codigos_lote_estado ON codigos(lote_id, estado);
CREATE INDEX IF NOT EXISTS idx_codigos_producto_id ON codigos(producto_id);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_id ON clientes(codigo_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad_created_at ON auditoria(entidad, created_at DESC);

DROP TRIGGER IF EXISTS trg_productos_updated_at ON productos;
CREATE TRIGGER trg_productos_updated_at
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lotes_updated_at ON lotes;
CREATE TRIGGER trg_lotes_updated_at
BEFORE UPDATE ON lotes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_codigos_updated_at ON codigos;
CREATE TRIGGER trg_codigos_updated_at
BEFORE UPDATE ON codigos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE VIEW v_codigos_detalle AS
SELECT
  c.id,
  c.codigo_nfc,
  c.url_landing,
  c.estado,
  c.created_at,
  c.written_at,
  c.activated_at,
  c.claimed_at,
  l.id AS lote_id,
  l.nombre AS lote_nombre,
  l.fecha AS lote_fecha,
  l.estado AS lote_estado,
  p.nombre AS producto_nombre,
  p.categoria AS producto_categoria,
  p.color AS producto_color,
  p.imagen_url AS producto_imagen_url
FROM codigos c
JOIN lotes l ON l.id = c.lote_id
LEFT JOIN productos p ON p.id = c.producto_id;

COMMIT;
