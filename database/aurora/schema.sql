-- QUIE NFC Platform - Aurora PostgreSQL schema
-- Target: AWS Aurora PostgreSQL Serverless v2, PostgreSQL 15+
--
-- Note: auto-pause is configured at the Aurora cluster level, not in SQL.
-- Configure Serverless v2 scaling with MinCapacity = 0 ACU and an
-- appropriate SecondsUntilAutoPause value when creating/modifying the cluster.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar(100) NOT NULL,
  categoria varchar(50) NOT NULL,
  color varchar(50),
  descripcion text,
  imagen_url varchar(255),
  precio numeric(10,2),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT productos_categoria_check CHECK (
    categoria IN (
      'bolso',
      'billetera',
      'morral',
      'cartera',
      'cinturon',
      'maletin',
      'llavero_nfc',
      'tarjetero'
    )
  ),
  CONSTRAINT productos_nombre_not_blank CHECK (length(trim(nombre)) > 0),
  CONSTRAINT productos_precio_non_negative CHECK (precio IS NULL OR precio >= 0)
);

CREATE TABLE IF NOT EXISTS artesanos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar(100) NOT NULL,
  ciudad varchar(100),
  region varchar(100),
  especialidad varchar(100),
  historia text,
  foto_url varchar(255),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT artesanos_nombre_not_blank CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE IF NOT EXISTS lotes (
  id varchar(30) PRIMARY KEY,
  nombre varchar(100),
  fecha_produccion date,
  estado varchar(20) NOT NULL DEFAULT 'activo',
  total_tags integer,
  producto_id uuid REFERENCES productos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  artesano_id uuid REFERENCES artesanos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT lotes_id_format_check CHECK (
    id ~ '^QUIE-[A-Z0-9_]+-[0-9]{4}-[0-9]{3}$'
  ),
  CONSTRAINT lotes_estado_check CHECK (
    estado IN ('activo', 'agotado', 'suspendido')
  ),
  CONSTRAINT lotes_total_tags_non_negative CHECK (
    total_tags IS NULL OR total_tags >= 0
  )
);

CREATE TABLE IF NOT EXISTS codigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_nfc varchar(30) NOT NULL,
  lote_id varchar(30) REFERENCES lotes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  url_landing varchar(255),
  producto_id uuid REFERENCES productos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  estado varchar(20) NOT NULL DEFAULT 'disponible',
  propietario_nombre varchar(100),
  propietario_whatsapp varchar(20),
  propietario_ciudad varchar(50),
  propietario_email varchar(100),
  registrado_en timestamp,
  escaneado_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT codigos_codigo_nfc_format_check CHECK (
    codigo_nfc ~ '^QUIE-[A-Z0-9]{6}-[0-9]{2}$'
  ),
  CONSTRAINT codigos_estado_check CHECK (
    estado IN ('disponible', 'asignado', 'activo', 'revocado')
  ),
  CONSTRAINT codigos_escaneado_count_non_negative CHECK (escaneado_count >= 0),
  CONSTRAINT codigos_propietario_email_check CHECK (
    propietario_email IS NULL
    OR propietario_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_codigos_codigo_nfc
  ON codigos (codigo_nfc);

CREATE INDEX IF NOT EXISTS idx_codigos_lote_id
  ON codigos (lote_id);

CREATE INDEX IF NOT EXISTS idx_lotes_producto_id
  ON lotes (producto_id);

CREATE INDEX IF NOT EXISTS idx_lotes_estado
  ON lotes (estado);

COMMIT;
