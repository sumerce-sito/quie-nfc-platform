'use strict';
const { Pool } = require('pg');

let _pool;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

async function buscarCodigo(codigoNfc) {
  const { rows } = await getPool().query(
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
  const antes = await getPool().query(
    'SELECT escaneado_count FROM codigos WHERE codigo_nfc = $1',
    [codigoNfc]
  );
  const count = antes.rows[0]?.escaneado_count ?? 0;
  await getPool().query(
    'UPDATE codigos SET escaneado_count = escaneado_count + 1 WHERE codigo_nfc = $1',
    [codigoNfc]
  );
  return { es_primer_escaneo: count === 0, total: count + 1 };
}

async function registrarPropietario(codigoNfc, { nombre, whatsapp, ciudad, email }) {
  await getPool().query(
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
  const { rows } = await getPool().query(
    'SELECT * FROM productos WHERE activo = true ORDER BY created_at DESC'
  );
  return rows;
}

module.exports = { buscarCodigo, incrementarEscaneo, registrarPropietario, obtenerProductos };
