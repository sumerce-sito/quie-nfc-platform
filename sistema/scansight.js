/**
 * ScanSight — Analista de escaneos NFC para QUIE®
 * Genera reportes y detecta alertas de autenticidad
 */

const fs   = require('fs');
const path = require('path');

const DB_ESCANEOS = path.join(__dirname, '../base_datos/escaneos.json');
const DB_CODIGOS  = path.join(__dirname, '../base_datos/codigos.json');
const DB_LOTES    = path.join(__dirname, '../base_datos/lotes.json');
const DIR_REPORTES = path.join(__dirname, '../reportes');

function cargarDB() {
  return {
    escaneos: JSON.parse(fs.readFileSync(DB_ESCANEOS, 'utf8')).escaneos,
    codigos:  JSON.parse(fs.readFileSync(DB_CODIGOS,  'utf8')).codigos,
    lotes:    JSON.parse(fs.readFileSync(DB_LOTES,    'utf8')).lotes
  };
}

function filtrarPorFechas(escaneos, desde, hasta) {
  return escaneos.filter(e => {
    const t = new Date(e.timestamp);
    if (desde && t < new Date(desde)) return false;
    if (hasta && t > new Date(hasta)) return false;
    return true;
  });
}

function detectarAlertas(escaneos, codigos) {
  const alertas = [];
  const porCodigo = {};

  for (const e of escaneos) {
    if (!porCodigo[e.codigo_id]) porCodigo[e.codigo_id] = [];
    porCodigo[e.codigo_id].push(e);
  }

  for (const [codigo_id, lista] of Object.entries(porCodigo)) {
    // Alerta 1: +50 escaneos en 1 hora
    lista.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 0; i < lista.length; i++) {
      const ventana = lista.filter(e =>
        new Date(e.timestamp) - new Date(lista[i].timestamp) <= 3600000
      );
      if (ventana.length >= 50) {
        alertas.push({
          tipo: 'ALTA_FRECUENCIA',
          severidad: 'ALTA',
          codigo_id,
          detalle: `${ventana.length} escaneos en menos de 1 hora — posible falsificación`,
          timestamp: new Date().toISOString()
        });
        break;
      }
    }

    // Alerta 2: 2 países en menos de 1 hora
    const paises = lista.map(e => ({ pais: e.pais, ts: new Date(e.timestamp) }));
    for (let i = 0; i < paises.length; i++) {
      for (let j = i + 1; j < paises.length; j++) {
        if (paises[i].pais !== paises[j].pais) {
          const diff = Math.abs(paises[j].ts - paises[i].ts);
          if (diff < 3600000) {
            alertas.push({
              tipo: 'ALERTA_GEOGRAFICA',
              severidad: 'ALTA',
              codigo_id,
              detalle: `Código escaneado desde ${paises[i].pais} y ${paises[j].pais} en menos de 1 hora`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
  }

  // Alerta 3: lotes sin escaneos en 30 días
  const hace30 = new Date(Date.now() - 30 * 24 * 3600000);
  const codigosActivos = codigos.filter(c => c.estado === 'activo');
  const codigosConEscaneo = new Set(escaneos.map(e => e.codigo_id));
  for (const c of codigosActivos) {
    if (!codigosConEscaneo.has(c.codigo_nfc)) {
      alertas.push({
        tipo: 'BAJA_CIRCULACION',
        severidad: 'BAJA',
        codigo_id: c.codigo_nfc,
        detalle: `Sin escaneos — lote ${c.lote_id} posiblemente sin distribuir`,
        timestamp: new Date().toISOString()
      });
    }
  }

  return alertas;
}

function generarReporte({ tipo_reporte, rango_fechas = {}, filtro_lote }) {
  const { escaneos: todosEscaneos, codigos, lotes } = cargarDB();
  const escaneos = filtrarPorFechas(todosEscaneos, rango_fechas.desde, rango_fechas.hasta)
    .filter(e => !filtro_lote || e.lote_id === filtro_lote);

  const primer_escaneo = escaneos.filter(e => e.es_primer_escaneo);
  const re_escaneos    = escaneos.filter(e => !e.es_primer_escaneo);

  // Conteo por modelo
  const porModelo = {};
  for (const e of escaneos) {
    const codigo = codigos.find(c => c.codigo_nfc === e.codigo_id);
    if (codigo) {
      porModelo[codigo.modelo] = (porModelo[codigo.modelo] || 0) + 1;
    }
  }

  // Conteo por ciudad
  const porCiudad = {};
  for (const e of escaneos) {
    if (e.ciudad) porCiudad[e.ciudad] = (porCiudad[e.ciudad] || 0) + 1;
  }

  // Dispositivos
  const ios     = escaneos.filter(e => e.dispositivo === 'iOS').length;
  const android = escaneos.filter(e => e.dispositivo === 'Android').length;

  const alertas = detectarAlertas(escaneos, codigos);

  const metricas = {
    total_escaneos:      escaneos.length,
    primeros_escaneos:   primer_escaneo.length,
    re_escaneos:         re_escaneos.length,
    tasa_autenticidad:   escaneos.length > 0
      ? `${((primer_escaneo.length / escaneos.length) * 100).toFixed(1)}%`
      : 'N/A',
    top_modelos:         Object.entries(porModelo).sort((a,b)=>b[1]-a[1]).slice(0,5),
    top_ciudades:        Object.entries(porCiudad).sort((a,b)=>b[1]-a[1]).slice(0,5),
    dispositivos:        { iOS: ios, Android: android }
  };

  const reporte = {
    estado: 'exitoso',
    tipo_reporte,
    periodo_analizado: {
      desde: rango_fechas.desde || 'inicio',
      hasta: rango_fechas.hasta || 'ahora'
    },
    generado_en: new Date().toISOString(),
    metricas,
    alertas,
    recomendaciones: generarRecomendaciones(metricas, alertas)
  };

  // Guardar reporte en disco
  const filename = `reporte_${tipo_reporte}_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(path.join(DIR_REPORTES, filename), JSON.stringify(reporte, null, 2));

  return reporte;
}

function generarRecomendaciones(metricas, alertas) {
  const recomendaciones = [];
  if (alertas.some(a => a.tipo === 'ALTA_FRECUENCIA')) {
    recomendaciones.push('🚨 Investigar códigos con alta frecuencia de escaneo — posible red de falsificación');
  }
  if (alertas.some(a => a.tipo === 'BAJA_CIRCULACION')) {
    recomendaciones.push('📦 Revisar distribución — hay lotes con baja o nula circulación');
  }
  if (metricas.top_modelos.length > 0) {
    const top = metricas.top_modelos[0];
    recomendaciones.push(`🏆 Modelo más popular: ${top[0]} (${top[1]} escaneos) — considerar restock`);
  }
  if (metricas.total_escaneos === 0) {
    recomendaciones.push('ℹ️ Sin escaneos en el período. Verificar que los tags estén activos y en circulación.');
  }
  return recomendaciones;
}

// Registrar un nuevo escaneo
function registrarEscaneo({ codigo_id, ip, pais, ciudad, dispositivo }) {
  const db = JSON.parse(fs.readFileSync(DB_ESCANEOS, 'utf8'));
  const dbCodigos = JSON.parse(fs.readFileSync(DB_CODIGOS, 'utf8'));

  const escaneosPrevios = db.escaneos.filter(e => e.codigo_id === codigo_id);
  const es_primer_escaneo = escaneosPrevios.length === 0;

  const escaneo = {
    id: db.escaneos.length + 1,
    codigo_id,
    timestamp: new Date().toISOString(),
    ip: ip || 'desconocida',
    pais: pais || 'Desconocido',
    ciudad: ciudad || 'Desconocida',
    dispositivo: dispositivo || 'Desconocido',
    es_primer_escaneo
  };

  db.escaneos.push(escaneo);
  fs.writeFileSync(DB_ESCANEOS, JSON.stringify(db, null, 2));

  return { ...escaneo, mensaje: es_primer_escaneo ? 'PRIMER_ESCANEO' : 'RE_ESCANEO' };
}

if (require.main === module) {
  const reporte = generarReporte({ tipo_reporte: 'completo' });
  console.log(JSON.stringify(reporte, null, 2));
}

module.exports = { generarReporte, registrarEscaneo, detectarAlertas };
