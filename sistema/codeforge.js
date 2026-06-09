/**
 * CodeForge — Generador de códigos NFC únicos para QUIE®
 * Formato: QUIE-[6ALNUM]-[2CHECKSUM]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHARSET  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O,0,I,1 para evitar confusión visual
const BASE_URL = (process.env.BASE_URL || 'https://QUIE®.com').replace(/\/$/, '') + '/v/';
const DB_CODIGOS = path.join(__dirname, '../base_datos/codigos.json');
const DB_LOTES   = path.join(__dirname, '../base_datos/lotes.json');
const CSV_DIR    = path.join(__dirname, '../codigos_csv');

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
    if (intentos > 10000) throw new Error('No se pudo generar código único después de 10000 intentos');
  } while (existentes.has(completo));
  return completo;
}

function generarLote({ lote_id, modelo, color, talla, cantidad, temporada }) {
  const db = JSON.parse(fs.readFileSync(DB_CODIGOS, 'utf8'));
  const dbLotes = JSON.parse(fs.readFileSync(DB_LOTES, 'utf8'));

  const existentes = new Set(db.codigos.map(c => c.codigo_nfc));
  const fecha_produccion = new Date().toISOString().split('T')[0];
  const nuevos = [];
  const csvLineas = ['codigo_nfc,lote_id,modelo,color,talla,url_landing,estado,fecha_produccion'];

  for (let i = 0; i < cantidad; i++) {
    const codigo_nfc = generarCodigoUnico(existentes);
    existentes.add(codigo_nfc);
    const url_landing = `${BASE_URL}${codigo_nfc}`;
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
  fs.writeFileSync(DB_CODIGOS, JSON.stringify(db, null, 2));

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
    fs.writeFileSync(DB_LOTES, JSON.stringify(dbLotes, null, 2));
  }

  // Guardar CSV
  fs.mkdirSync(CSV_DIR, { recursive: true });
  const csvPath = path.join(CSV_DIR, `${lote_id}.csv`);
  fs.writeFileSync(csvPath, csvLineas.join('\n'));

  return {
    estado: 'exitoso',
    codigos_generados: cantidad,
    lote_id,
    csv_path: csvPath,
    ejemplo_codigo: nuevos[0].codigo_nfc,
    ejemplo_url: nuevos[0].url_landing
  };
}

// Ejecutar desde línea de comandos
// node codeforge.js --lote QUIE-TAR-2026-001 --modelo Tarjetero --color "Terracota/Dorado" --talla Única --cantidad 50 --temporada "Junio 2026"
if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const resultado = generarLote({
    lote_id:   get('--lote')     || 'QUIE-TEST-2026-001',
    modelo:    get('--modelo')   || 'Tarjetero',
    color:     get('--color')    || 'Terracota/Dorado',
    talla:     get('--talla')    || 'Única',
    cantidad:  parseInt(get('--cantidad') || '10'),
    temporada: get('--temporada') || '2026'
  });
  console.log(JSON.stringify(resultado, null, 2));
}

module.exports = { generarLote };
