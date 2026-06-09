/**
 * NEXO — Orquestador central del sistema NFC QUIE®
 * Coordina CodeForge, TagWriter, PageBuilder, DataVault y ScanSight
 */

const fs   = require('fs');
const path = require('path');
const { generarLote }             = require('./codeforge');
const { generarReporte, registrarEscaneo } = require('./scansight');

const LOG = path.join(__dirname, '../auditoria/log.json');
const DB_LOTES = path.join(__dirname, '../base_datos/lotes.json');

function auditoria(agente, accion, detalle, resultado = 'exitoso') {
  const log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
  log.eventos.push({
    id: log.eventos.length + 1,
    timestamp: new Date().toISOString(),
    agente,
    accion,
    detalle,
    resultado
  });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
}

function iniciarLote({ modelo, color, talla, cantidad, temporada }) {
  const dbLotes = JSON.parse(fs.readFileSync(DB_LOTES, 'utf8'));

  // Generar ID de lote
  const modeloAbrev = modelo.substring(0, 4).toUpperCase();
  const año = new Date().getFullYear();
  const seq = String(dbLotes.lotes.length + 1).padStart(3, '0');
  const lote_id = `QUIE-${modeloAbrev}-${año}-${seq}`;

  console.log(`\n[NEXO] ▶ Iniciando Fase 1 — Lote: ${lote_id}`);

  // DataVault + CodeForge
  const resultado = generarLote({ lote_id, modelo, color, talla, cantidad, temporada });
  auditoria('CodeForge', 'CODIGOS_GENERADOS', `${cantidad} códigos para ${lote_id}`);

  console.log(`[NEXO] ✅ DataVault: Lote registrado → ${lote_id}`);
  console.log(`[NEXO] ✅ CodeForge: ${cantidad} códigos generados`);
  console.log(`[NEXO] 📄 CSV en: ${resultado.csv_path}`);
  console.log(`[NEXO] 🔗 Ejemplo: ${resultado.ejemplo_url}`);
  console.log(`\n[NEXO] Fase 1 completa. Listo para Fase 2 (páginas web).`);

  return resultado;
}

function estadoSistema() {
  const lotes   = JSON.parse(fs.readFileSync(DB_LOTES, 'utf8')).lotes;
  const eventos = JSON.parse(fs.readFileSync(LOG, 'utf8')).eventos;

  return {
    total_lotes: lotes.length,
    lotes_activos: lotes.filter(l => l.estado === 'activo').length,
    ultimo_evento: eventos[eventos.length - 1],
    lotes
  };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd  = args[0];

  if (cmd === 'nuevo-lote') {
    const get = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null; };
    iniciarLote({
      modelo:    get('--modelo')    || 'Tarjetero',
      color:     get('--color')     || 'Terracota/Dorado',
      talla:     get('--talla')     || 'Única',
      cantidad:  parseInt(get('--cantidad') || '50'),
      temporada: get('--temporada') || String(new Date().getFullYear())
    });
  } else if (cmd === 'estado') {
    console.log(JSON.stringify(estadoSistema(), null, 2));
  } else if (cmd === 'reporte') {
    const reporte = generarReporte({ tipo_reporte: 'completo' });
    console.log(JSON.stringify(reporte, null, 2));
  } else {
    console.log(`
NEXO — QUIE® NFC System

Comandos:
  node nexo.js nuevo-lote --modelo Tarjetero --color "Terracota/Dorado" --talla Única --cantidad 50
  node nexo.js estado
  node nexo.js reporte
    `);
  }
}

module.exports = { iniciarLote, estadoSistema, auditoria };
