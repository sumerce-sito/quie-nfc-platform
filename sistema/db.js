'use strict';

const { Pool }   = require('pg');
const { Signer } = require('@aws-sdk/rds-signer');

const REGION  = process.env.AWS_REGION || 'us-east-2';
const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;

// IAM tokens son válidos 15 min; regeneramos después de 14
const TOKEN_TTL_MS = 14 * 60 * 1000;
let _pool = null;
let _poolCreatedAt = 0;

async function getPool() {
  const now = Date.now();
  if (_pool && (now - _poolCreatedAt) < TOKEN_TTL_MS) return _pool;

  if (_pool) {
    try { await _pool.end(); } catch (_) {}
    _pool = null;
  }

  const token = await new Signer({
    hostname: DB_HOST,
    port:     DB_PORT,
    username: DB_USER,
    region:   REGION,
  }).getAuthToken();

  _pool = new Pool({
    host:     DB_HOST,
    port:     DB_PORT,
    database: DB_NAME,
    user:     DB_USER,
    password: token,
    ssl:      { rejectUnauthorized: false },
    max:      3,
    idleTimeoutMillis:       30000,
    connectionTimeoutMillis: 5000,
  });

  _poolCreatedAt = now;
  return _pool;
}

async function buscarCodigo(codigoNfc) {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT c.codigo_nfc, c.lote_id, c.estado, c.escaneado_count,
            c.propietario_nombre, c.propietario_email,
            c.propietario_whatsapp, c.propietario_ciudad, c.registrado_en,
            p.nombre AS modelo, p.color, p.imagen_url AS foto_producto,
            p.categoria, p.descripcion,
            l.fecha_produccion,
            a.nombre AS artesano_nombre, a.ciudad AS artesano_ciudad,
            a.historia AS artesano_historia, a.foto_url AS artesano_foto
     FROM codigos c
     LEFT JOIN productos p ON p.id = c.producto_id
     LEFT JOIN lotes l ON l.id = c.lote_id
     LEFT JOIN artesanos a ON a.id = l.artesano_id
     WHERE c.codigo_nfc = $1
     LIMIT 1`,
    [codigoNfc]
  );
  return rows[0] || null;
}

async function incrementarEscaneo(codigoNfc) {
  const pool = await getPool();
  const antes = await pool.query(
    'SELECT escaneado_count FROM codigos WHERE codigo_nfc = $1',
    [codigoNfc]
  );
  const count = antes.rows[0]?.escaneado_count ?? 0;
  await pool.query(
    'UPDATE codigos SET escaneado_count = escaneado_count + 1 WHERE codigo_nfc = $1',
    [codigoNfc]
  );
  return { es_primer_escaneo: count === 0, total: count + 1 };
}

async function registrarPropietario(codigoNfc, { nombre, whatsapp, ciudad, email }) {
  const pool = await getPool();
  await pool.query(
    `UPDATE codigos SET
       propietario_nombre    = $2,
       propietario_whatsapp  = $3,
       propietario_ciudad    = $4,
       propietario_email     = $5,
       registrado_en         = now(),
       estado                = 'asignado'
     WHERE codigo_nfc = $1 AND propietario_nombre IS NULL`,
    [codigoNfc, nombre, whatsapp, ciudad || null, email || null]
  );
}

async function obtenerProductos() {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT * FROM productos WHERE activo = true ORDER BY created_at DESC'
  );
  return rows;
}

async function getLotes() {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT l.id, l.nombre, l.fecha_produccion, l.estado, l.total_tags, l.created_at,
            COUNT(c.id) AS codigos_count
     FROM lotes l
     LEFT JOIN codigos c ON c.lote_id = l.id
     GROUP BY l.id
     ORDER BY l.created_at DESC`
  );
  return rows;
}

async function crearLoteConCodigos(lote, codigos) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO lotes (id, nombre, fecha_produccion, estado, total_tags)
     VALUES ($1, $2, $3, 'activo', $4)
     ON CONFLICT (id) DO NOTHING`,
    [lote.id, lote.nombre, lote.fecha_produccion, lote.total_tags]
  );
  for (const c of codigos) {
    await pool.query(
      `INSERT INTO codigos (codigo_nfc, lote_id, url_landing, estado)
       VALUES ($1, $2, $3, 'disponible')
       ON CONFLICT (codigo_nfc) DO NOTHING`,
      [c.codigo_nfc, c.lote_id, c.url_landing]
    );
  }
}

module.exports = { buscarCodigo, incrementarEscaneo, registrarPropietario, obtenerProductos, crearLoteConCodigos, getLotes };
