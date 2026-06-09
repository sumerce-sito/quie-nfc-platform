/**
 * CodeForge â€” Generador de cÃ³digos NFC Ãºnicos para QUIEÂ®
 * Formato: QUIE-[6ALNUM]-[2CHECKSUM]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const CHARSET  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O,0,I,1 para evitar confusiÃ³n visual
const DEFAULT_BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const DB_CODIGOS = path.join(__dirname, '../base_datos/codigos.json');
const DB_LOTES   = path.join(__dirname, '../base_datos/lotes.json');
const IS_VERCEL = !!process.env.VERCEL;
const CSV_DIR    = IS_VERCEL ? path.join(os.tmpdir(), 'quie-codigos-csv') : path.join(__dirname, '../codigos_csv');
const LOTES_GENERADOS = new Map();

function leerJsonSeguro(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return structuredClone(fallback);
  }
}

function escribirJsonSeguro(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (_) {
    // En Vercel esto es best-effort hasta conectar Aurora/DynamoDB.
  }
}

function calcularChecksum(codigo6) {
  let suma = 0;
  for (const c of codigo6) suma += c.charCodeAt(0);
  return String(suma % 100).padStart(2, '0');
}

function generarCodigo6() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes).map(b => CHARSET[b % CHARSET.length]).join('');
}

function generarCodigoUnico(existentes) {
  let codigo, completo;
  let intentos = 0;
  do {
    codigo = generarCodigo6();
    const checksum = calcularChecksum(codigo);
    completo = `QUIE-${codigo}-${checksum}`;
    intentos++;
    if (intentos > 10000) throw new Error('No se pudo generar cÃ³digo Ãºnico despuÃ©s de 10000 intentos');
  } while (existentes.has(completo));
  return completo;
}

function generarLote({ lote_id, modelo, color, talla, cantidad, temporada, base_url }) {
  const db = leerJsonSeguro(DB_CODIGOS, { codigos: [] });
  const dbLotes = leerJsonSeguro(DB_LOTES, { lotes: [] });

  const existentes = new Set(db.codigos.map(c => c.codigo_nfc));
  const fecha_produccion = new Date().toISOString().split('T')[0];
  const nuevos = [];
  const csvLineas = ['codigo_nfc,lote_id,modelo,color,talla,url_landing,estado,fecha_produccion'];

  for (let i = 0; i < cantidad; i++) {
    const codigo_nfc = generarCodigoUnico(existentes);
    existentes.add(codigo_nfc);
    const urlBase = (base_url || DEFAULT_BASE_URL).replace(/\/$/, '');
    const url_landing = `${urlBase}/v/${codigo_nfc}`;
    const registro = {
      id: db.codigos.length + nuevos.length + 1,
      codigo_nfc,
      lote_id,
      url_landing,
      modelo,
      color,
      talla,
      estado: 'generado',
      fecha_produccion,
      fecha_activacion: null
    };
    nuevos.push(registro);
    csvLineas.push(`${codigo_nfc},${lote_id},${modelo},${color},${talla},${url_landing},generado,${fecha_produccion}`);
  }

  // Guardar en BD
  db.codigos.push(...nuevos);
  escribirJsonSeguro(DB_CODIGOS, db);

  // Registrar lote si no existe
  const loteExiste = dbLotes.lotes.find(l => l.id === lote_id);
  if (!loteExiste) {
    dbLotes.lotes.push({
      id: lote_id,
      modelo,
      color,
      talla,
      temporada,
      fecha_creacion: fecha_produccion,
      total_tags: cantidad,
      estado: 'codigos_generados'
    });
    escribirJsonSeguro(DB_LOTES, dbLotes);
  }

  // Guardar CSV
  fs.mkdirSync(CSV_DIR, { recursive: true });
  const csvPath = path.join(CSV_DIR, `${lote_id}.csv`);
  fs.writeFileSync(csvPath, csvLineas.join('\n'));
  LOTES_GENERADOS.set(lote_id, nuevos);

  return {
    estado: 'exitoso',
    codigos_generados: cantidad,
    lote_id,
    csv_path: csvPath,
    ejemplo_codigo: nuevos[0].codigo_nfc,
    ejemplo_url: nuevos[0].url_landing
  };
}

function obtenerCodigosLote(loteId) {
  return LOTES_GENERADOS.get(loteId) || [];
}

// Ejecutar desde lÃ­nea de comandos
// node codeforge.js --lote QUIE-TAR-2026-001 --modelo Tarjetero --color "Terracota/Dorado" --talla Ãšnica --cantidad 50 --temporada "Junio 2026"
if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const resultado = generarLote({
    lote_id:   get('--lote')     || 'QUIE-TEST-2026-001',
    modelo:    get('--modelo')   || 'Tarjetero',
    color:     get('--color')    || 'Terracota/Dorado',
    talla:     get('--talla')    || 'Ãšnica',
    cantidad:  parseInt(get('--cantidad') || '10'),
    temporada: get('--temporada') || '2026'
  });
  console.log(JSON.stringify(resultado, null, 2));
}

module.exports = { generarLote, obtenerCodigosLote };

