'use strict';
require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const cookieParser   = require('cookie-parser');
const rateLimit      = require('express-rate-limit');
const multer         = require('multer');
const QRCode         = require('qrcode');
const { body, param, validationResult } = require('express-validator');
const path           = require('path');
const fs             = require('fs');
const os             = require('os');

const { generarLote, obtenerCodigosLote }   = require('./codeforge');
const { generarReporte, registrarEscaneo, detectarAlertas } = require('./scansight');
const { auditoria }                         = require('./nexo');
const db = process.env.DB_HOST ? require('./db') : null;
const dynamo = process.env.DYNAMODB_TABLE_ESCANEOS ? require('./dynamodb') : null;
const {
  verificarCredenciales, generarToken, requireAuth,
  cookieOpts, estaBloquada, registrarFallo, limpiarIntentos,
  tiempoRestanteBloqueo, logSeguridad
} = require('./auth');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;
const WEB  = path.join(__dirname, '../web');
const DB   = (n) => path.join(__dirname, `../base_datos/${n}.json`);
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';
const UPLOADS = IS_VERCEL ? path.join(os.tmpdir(), 'quie-uploads') : path.join(__dirname, '../uploads');
const CLIENTE_FOTOS = path.join(UPLOADS, 'clientes');
const PRODUCTO_FOTOS = path.join(UPLOADS, 'productos');
const DEMO_NFC_CODE = 'QUIE-A7B3X9-42';
const DEMO_NFC_RECORD = {
  codigo_nfc: DEMO_NFC_CODE,
  modelo: 'Tarjetero Origen',
  color: 'Verde profundo',
  talla: 'Unica',
  lote_id: 'QUIE-TAR-2025-001',
  fecha_produccion: '2025-11-18',
  estado: 'activo',
  foto_producto: '/assets/quie/productos/tarjetero.png'
};
const DEMO_CSV_CODES = [
  DEMO_NFC_RECORD,
  {
    codigo_nfc: 'QUIE-B8K2M5-47',
    modelo: 'Billetera Tierra',
    color: 'Cuero oscuro',
    talla: 'Unica',
    lote_id: DEMO_NFC_RECORD.lote_id,
    fecha_produccion: DEMO_NFC_RECORD.fecha_produccion,
    estado: 'generado'
  },
  {
    codigo_nfc: 'QUIE-C9P4T7-51',
    modelo: 'Correa Selva',
    color: 'Verde profundo',
    talla: 'Unica',
    lote_id: DEMO_NFC_RECORD.lote_id,
    fecha_produccion: DEMO_NFC_RECORD.fecha_produccion,
    estado: 'generado'
  }
];
const ALLOW_DEMO_VALID_CODES = process.env.ALLOW_DEMO_VALID_CODES !== 'false';
const cspDirectives = {
  defaultSrc:     ["'self'"],
  scriptSrc:      ["'self'", "'unsafe-inline'"],
  scriptSrcAttr:  ["'unsafe-inline'"],             // permite onclick/onsubmit en admin
  styleSrc:       ["'self'", "'unsafe-inline'"],
  imgSrc:         ["'self'", 'data:'],
  connectSrc:     ["'self'"],
  fontSrc:        ["'self'"],
  objectSrc:      ["'none'"],
  frameAncestors: ["'none'"]                       // anti-clickjacking
};

if (FORCE_HTTPS) {
  cspDirectives.upgradeInsecureRequests = [];
}

const DB_DEFAULTS = {
  productos: { productos: [] },
  codigos:   { codigos: [] },
  escaneos:  { escaneos: [] },
  clientes:  { clientes: [] },
  lotes:     { lotes: [] }
};

const DB_CACHE = {};

function leerDB(n) {
  if (IS_VERCEL && DB_CACHE[n]) return DB_CACHE[n];
  try {
    const data = JSON.parse(fs.readFileSync(DB(n), 'utf8'));
    if (IS_VERCEL) DB_CACHE[n] = data;
    return data;
  } catch (_) {
    const def = structuredClone(DB_DEFAULTS[n] || {});
    if (IS_VERCEL) DB_CACHE[n] = def;
    return def;
  }
}

function guardarDB(n, d) {
  if (IS_VERCEL) { DB_CACHE[n] = d; return; }
  fs.writeFileSync(DB(n), JSON.stringify(d, null, 2));
}
fs.mkdirSync(CLIENTE_FOTOS, { recursive: true });
fs.mkdirSync(PRODUCTO_FOTOS, { recursive: true });

const uploadFotoCliente = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CLIENTE_FOTOS),
    filename: (req, file, cb) => {
      const codigo = String(req.body?.codigo_nfc || 'sin-codigo').replace(/[^A-Z0-9-]/gi, '').toUpperCase();
      const ext = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp'
      }[file.mimetype] || path.extname(file.originalname).toLowerCase();
      cb(null, `${codigo}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Formato de foto no permitido. Usa JPG, PNG o WebP.'));
    }
    cb(null, true);
  }
}).single('foto_pieza');

const uploadFotoProducto = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRODUCTO_FOTOS),
    filename: (req, file, cb) => {
      const nombre = String(req.body?.nombre || req.params?.id || 'producto')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'producto';
      const ext = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp'
      }[file.mimetype] || path.extname(file.originalname).toLowerCase();
      cb(null, `${nombre}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Formato de foto no permitido. Usa JPG, PNG o WebP.'));
    }
    cb(null, true);
  }
}).single('foto_producto');

// ─────────────────────────────────────────────────────────────────────────────
//  SEGURIDAD — CABECERAS HTTP
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: cspDirectives
  },
  hsts:                FORCE_HTTPS ? { maxAge: 31536000, includeSubDomains: true } : false,
  noSniff:             true,
  xssFilter:           true,
  referrerPolicy:      { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false
}));

// CORS solo para el propio dominio
app.use(cors({
  origin:      process.env.NODE_ENV === 'production' ? `https://${process.env.DOMAIN}` : `http://localhost:${process.env.PORT || 3000}`,
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10kb' }));       // limite de payload
app.use(cookieParser(process.env.COOKIE_SECRET || 'quie-hackathon-demo-cookie-secret-change-after-demo'));

// Eliminar cabecera X-Powered-By
app.disable('x-powered-by');

// ─────────────────────────────────────────────────────────────────────────────
//  RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

// General: 100 req/minuto por IP
const limiterGeneral = rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Demasiadas solicitudes. Intenta en un minuto.' }
});

// Login: 10 intentos cada 15 minutos por IP
const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' }
});

// Escaneos NFC públicos: 30 req/min por IP (evita bots)
const limiterEscaneo = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  message:  { error: 'Demasiadas solicitudes.' }
});

// Registro de clientes: 5 registros cada 10 min por IP (anti-spam)
const limiterRegistro = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      5,
  message:  { error: 'Demasiados registros. Intenta más tarde.' }
});

app.use(limiterGeneral);
app.use(express.static(WEB, {
  setHeaders(res) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
  }
}));
app.use('/uploads', express.static(UPLOADS, {
  setHeaders(res) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=86400');
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: validación de inputs
// ─────────────────────────────────────────────────────────────────────────────
function validar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: errors.array() });
  }
  return null;
}

function ip(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || process.env.BASE_URL || 'localhost:3000';
  return String(host).startsWith('http') ? String(host).replace(/\/$/, '') : `${proto}://${host}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function construirCsvCodigos(codigos, req) {
  const origen = baseUrl(req);
  const columnas = ['codigo_nfc','lote_id','modelo','color','talla','url_landing','estado','fecha_produccion'];
  const filas = codigos.map(c => {
    const url = c.url_landing || `${origen}/v/${c.codigo_nfc}`;
    return [
      c.codigo_nfc,
      c.lote_id,
      c.modelo,
      c.color,
      c.talla || 'Unica',
      url,
      c.estado || 'generado',
      c.fecha_produccion || DEMO_NFC_RECORD.fecha_produccion
    ].map(csvCell).join(',');
  });
  return [columnas.join(','), ...filas].join('\n');
}


function demoRecordForCode(codigo) {
  return {
    ...DEMO_NFC_RECORD,
    codigo_nfc: codigo,
    modelo: 'Pieza QUIE NFC',
    color: 'Coleccion demo',
    lote_id: 'QUIE-DEMO-2026-001',
    estado: 'demo'
  };
}
// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PÚBLICAS (sin auth)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(WEB, 'index.html')));
app.get('/guia-nfc', (req, res) => res.sendFile(path.join(WEB, 'guia-nfc.html')));
app.get('/catalogo', (req, res) => res.sendFile(path.join(WEB, 'catalogo.html')));
app.get('/login', (req, res) => res.sendFile(path.join(WEB, 'login.html')));
app.get('/origen', (req, res) => res.sendFile(path.join(WEB, 'origen.html')));

app.get('/api/qr', async (req, res) => {
  const data = String(req.query.data || '').trim();
  if (!data || data.length > 500) return res.status(400).send('QR invalido');

  try {
    const svg = await QRCode.toString(data, {
      type: 'svg',
      margin: 1,
      width: 180,
      errorCorrectionLevel: 'M',
      color: { dark: '#2D402E', light: '#F2F2F2' }
    });
    res.type('image/svg+xml').send(svg);
  } catch (_) {
    res.status(500).send('No se pudo generar el QR');
  }
});

// Registro de propietario de pieza — público, llamado desde autenticidad.html
app.get('/api/catalogo', async (req, res) => {
  if (db) {
    try {
      const productos = await db.obtenerProductos();
      return res.json({ productos });
    } catch (_) {}
  }
  const local = leerDB('productos');
  res.json({ productos: local.productos.filter(p => p.estado === 'activo') });
});

app.post('/api/registro-cliente', limiterRegistro, (req, res, next) => {
  uploadFotoCliente(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ error: err.message || 'No se pudo subir la foto' });
  });
}, [
  body('codigo_nfc').trim().matches(/^QUIE-[A-Z0-9]{6}-[0-9]{2}$/).withMessage('Código inválido'),
  body('nombre').trim().notEmpty().isLength({ min: 2, max: 80 }).withMessage('Nombre requerido'),
  body('whatsapp').trim().notEmpty().matches(/^[\d\s\+\-\(\)]{7,20}$/).withMessage('WhatsApp inválido'),
  body('ciudad').optional({ checkFalsy: true }).trim().isLength({ max: 60 }).withMessage('Ciudad demasiado larga'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Email inválido').normalizeEmail()
], (req, res) => {
  const borrarFotoSubida = () => {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  };

  if (validar(req, res)) {
    borrarFotoSubida();
    return;
  }

  const { codigo_nfc, nombre, whatsapp, ciudad, email } = req.body;

  // Verificar que el código existe
  const dbCodigos = leerDB('codigos');
  const codigo = dbCodigos.codigos.find(c => c.codigo_nfc === codigo_nfc.toUpperCase());
  if (!codigo) {
    borrarFotoSubida();
    return res.status(404).json({ error: 'Código no encontrado' });
  }

  // Verificar que no esté ya registrado
  const db = leerDB('clientes');
  if (db.clientes.some(c => c.codigo_nfc === codigo_nfc.toUpperCase())) {
    borrarFotoSubida();
    return res.status(409).json({ error: 'Esta pieza ya tiene un propietario registrado', ya_registrado: true });
  }

  const nuevo = {
    id:             db.clientes.length + 1,
    codigo_nfc:     codigo_nfc.toUpperCase(),
    lote_id:        codigo.lote_id,
    modelo:         codigo.modelo,
    color:          codigo.color,
    nombre:         nombre,
    whatsapp:       whatsapp.replace(/\D/g, '').slice(-10), // solo dígitos, últimos 10
    ciudad:         ciudad || '',
    email:          email  || '',
    foto_pieza:     req.file ? `/uploads/clientes/${req.file.filename}` : '',
    fecha_registro: new Date().toISOString(),
    ip_registro:    ip(req),
    fuente:         'nfc_first_scan'
  };

  db.clientes.push(nuevo);
  guardarDB('clientes', db);
  auditoria('DataVault', 'CLIENTE_REGISTRADO', `${nombre} — ${codigo_nfc}`, ip(req));

  res.json({ ok: true, mensaje: '¡Registro exitoso! Bienvenido a QUIE®' });
});

// Preview de autenticidad (solo en desarrollo)
app.get('/v/demo', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.redirect('/');
  let html = fs.readFileSync(path.join(WEB, 'autenticidad.html'), 'utf8');
  const tipo = req.query.tipo || 'autentico'; // autentico | rescan | sospechoso
  html = html
    .replace(/\{\{CODIGO_NFC\}\}/g,           'QUIE-A7B3X9-42')
    .replace(/\{\{MODELO\}\}/g,               'Tarjetero')
    .replace(/\{\{COLOR\}\}/g,                'Negro / Dorado')
    .replace(/\{\{TALLA\}\}/g,                'Única')
    .replace(/\{\{LOTE_ID\}\}/g,              'QUIE-TAR-2025-001')
    .replace(/\{\{FECHA_PRODUCCION\}\}/g,     '2026-06-05')
    .replace(/\{\{FECHA_PRIMER_ESCANEO\}\}/g, '5 de junio de 2026')
    .replace(/\{\{CIUDAD_PRIMER_ESCANEO\}\}/g,'Bogota')
    .replace(/\{\{ES_PRIMER_ESCANEO\}\}/g,    tipo === 'autentico' ? 'true' : 'false')
    .replace(/\{\{TOTAL_ESCANEOS\}\}/g,       tipo === 'sospechoso' ? '87' : tipo === 'rescan' ? '4' : '1')
    .replace(/\{\{YA_REGISTRADO\}\}/g,        tipo === 'rescan' ? 'true' : 'false')
    .replace(/\{\{NOMBRE_PROPIETARIO\}\}/g,   tipo === 'rescan' ? 'Carlos Rodríguez' : '')
    .replace(/\{\{FOTO_PRODUCTO\}\}/g,        '/assets/quie/productos/tarjetero.png');
  res.send(html);
});

// Landing de autenticidad NFC — pública pero con rate limiting
app.get('/v/:codigo', limiterEscaneo, [
  param('codigo')
    .trim()
    .matches(/^QUIE-[A-Z0-9]{6}-[0-9]{2}$/)
    .withMessage('Formato de código inválido')
], async (req, res) => {
  if (validar(req, res)) return;

  const codigo = req.params.codigo.toUpperCase();

  // Buscar en Aurora si está disponible
  let registroAurora = null;
  if (db) {
    try { registroAurora = await db.buscarCodigo(codigo); } catch (_) {}
  }

  const registroLocal = leerDB('codigos').codigos.find(c => c.codigo_nfc === codigo);
  const esDemoPrincipal = codigo === DEMO_NFC_CODE;
  const esDemoFallback  = ALLOW_DEMO_VALID_CODES && !registroAurora && !registroLocal;
  const esDemo = !registroAurora && (esDemoPrincipal || esDemoFallback);

  const registro = registroAurora
    ? {
        codigo_nfc:       registroAurora.codigo_nfc,
        modelo:           registroAurora.modelo || 'Pieza QUIE',
        color:            registroAurora.color  || '',
        talla:            'Única',
        lote_id:          registroAurora.lote_id,
        fecha_produccion: registroAurora.fecha_produccion
          ? new Date(registroAurora.fecha_produccion).toISOString().split('T')[0]
          : '',
        estado:           registroAurora.estado,
        foto_producto:    registroAurora.foto_producto || '',
        propietario_nombre: registroAurora.propietario_nombre || null,
      }
    : registroLocal
      || (esDemoPrincipal ? DEMO_NFC_RECORD : null)
      || (esDemoFallback  ? demoRecordForCode(codigo) : null);

  if (!registro) return res.sendFile(path.join(WEB, 'no-encontrado.html'));

  const userAgent  = req.headers['user-agent'] || '';
  const dispositivo = /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Android/.test(userAgent) ? 'Android' : 'Otro';

  let escaneo, primerEscaneo, yaRegistrado, clienteReg;

  let totalEscaneos = 1;

  if (esDemo) {
    escaneo = {
      codigo_id: codigo, timestamp: new Date().toISOString(),
      ip: ip(req), pais: req.headers['cf-ipcountry'] || 'Colombia',
      ciudad: req.headers['cf-ipcity'] || 'Bogota',
      dispositivo, es_primer_escaneo: true, mensaje: 'DEMO_HACKATHON'
    };
    primerEscaneo = { timestamp: '2025-11-20T15:30:00.000Z', ciudad: 'Bogota' };
    yaRegistrado = false;
    clienteReg = null;
    totalEscaneos = 2;
  } else if (registroAurora && db) {
    let scanInfo = { es_primer_escaneo: false, total: registroAurora.escaneado_count };
    try { scanInfo = await db.incrementarEscaneo(codigo); } catch (_) {}
    escaneo = {
      codigo_id: codigo, timestamp: new Date().toISOString(),
      ip: ip(req), pais: req.headers['cf-ipcountry'] || 'Colombia',
      ciudad: req.headers['cf-ipcity'] || 'Desconocida',
      dispositivo, es_primer_escaneo: scanInfo.es_primer_escaneo,
      mensaje: scanInfo.es_primer_escaneo ? 'PRIMER_ESCANEO' : 'RE_ESCANEO'
    };
    primerEscaneo = scanInfo.es_primer_escaneo
      ? escaneo
      : { timestamp: registroAurora.registrado_en || escaneo.timestamp, ciudad: escaneo.ciudad };
    yaRegistrado = !!registroAurora.propietario_nombre;
    clienteReg = yaRegistrado ? { nombre: registroAurora.propietario_nombre } : null;
    totalEscaneos = scanInfo.total;
    auditoria('ScanSight', 'ESCANEO_REGISTRADO', `${codigo} — ${escaneo.mensaje}`, ip(req));
  } else {
    escaneo = registrarEscaneo({
      codigo_id: codigo, ip: ip(req),
      pais: req.headers['cf-ipcountry'] || 'Colombia',
      ciudad: req.headers['cf-ipcity'] || 'Desconocida', dispositivo
    });
    auditoria('ScanSight', 'ESCANEO_REGISTRADO', `${codigo} — ${escaneo.mensaje}`, ip(req));
    const dbEsc = leerDB('escaneos');
    const historial = dbEsc.escaneos.filter(e => e.codigo_id === codigo);
    primerEscaneo = historial.find(e => e.es_primer_escaneo);
    const dbClientes = leerDB('clientes');
    clienteReg  = dbClientes.clientes.find(c => c.codigo_nfc === codigo);
    yaRegistrado = !!clienteReg;
    totalEscaneos = historial.length;
  }

  if (dynamo && escaneo) {
    dynamo.registrarEscaneoDynamo({
      codigo_id: escaneo.codigo_id,
      ip:        escaneo.ip,
      ciudad:    escaneo.ciudad,
      dispositivo: escaneo.dispositivo,
      pais:      escaneo.pais
    }).catch(() => {});
  }

  const productos = leerDB('productos').productos || [];
  const normalizar = (v) => String(v || '').toLowerCase().replace(/\s+/g, '').replace(/\//g, '');
  const productoCatalogo = productos.find(p =>
    p.estado !== 'inactivo' &&
    normalizar(p.modelo) === normalizar(registro.modelo) &&
    normalizar(p.color) === normalizar(registro.color)
  ) || productos.find(p =>
    p.estado !== 'inactivo' &&
    normalizar(p.modelo) === normalizar(registro.modelo)
  );
  const fotoProducto = registro.foto_producto || productoCatalogo?.foto_producto || '';

  let html = fs.readFileSync(path.join(WEB, 'autenticidad.html'), 'utf8');
  html = html
    .replace(/\{\{CODIGO_NFC\}\}/g,           registro.codigo_nfc)
    .replace(/\{\{MODELO\}\}/g,               registro.modelo)
    .replace(/\{\{COLOR\}\}/g,                registro.color)
    .replace(/\{\{TALLA\}\}/g,                registro.talla)
    .replace(/\{\{LOTE_ID\}\}/g,              registro.lote_id)
    .replace(/\{\{FECHA_PRODUCCION\}\}/g,     registro.fecha_produccion)
    .replace(/\{\{FECHA_PRIMER_ESCANEO\}\}/g,
      primerEscaneo
        ? new Date(primerEscaneo.timestamp).toLocaleDateString('es-CO', { dateStyle: 'long' })
        : 'Hoy')
    .replace(/\{\{CIUDAD_PRIMER_ESCANEO\}\}/g,
      primerEscaneo ? primerEscaneo.ciudad : escaneo.ciudad)
    .replace(/\{\{ES_PRIMER_ESCANEO\}\}/g,    String(escaneo.es_primer_escaneo))
    .replace(/\{\{TOTAL_ESCANEOS\}\}/g,       String(totalEscaneos))
    .replace(/\{\{YA_REGISTRADO\}\}/g,        String(yaRegistrado))
    .replace(/\{\{NOMBRE_PROPIETARIO\}\}/g,   clienteReg ? clienteReg.nombre : '')
    .replace(/\{\{FOTO_PRODUCTO\}\}/g,        fotoProducto);

  res.send(html);
});

// ─────────────────────────────────────────────────────────────────────────────
//  AUTH — Login / Logout / Verify
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', limiterLogin, [
  body('username').trim().notEmpty().isLength({ max: 50 }),
  body('password').notEmpty().isLength({ max: 128 })
], (req, res) => {
  if (validar(req, res)) return;

  const clientIp = ip(req);

  if (estaBloquada(clientIp)) {
    const mins = tiempoRestanteBloqueo(clientIp);
    logSeguridad('LOGIN_BLOQUEO', `IP bloqueada — ${mins} min restantes`, clientIp);
    return res.status(429).json({
      error: `IP bloqueada por demasiados intentos fallidos. Espera ${mins} minuto(s).`
    });
  }

  const { username, password } = req.body;

  if (!verificarCredenciales(username, password)) {
    const intentos = registrarFallo(clientIp);
    const restantes = Math.max(0, 5 - intentos);
    logSeguridad('LOGIN_FALLO', `Usuario: ${username} — intento ${intentos}`, clientIp);
    return res.status(401).json({
      error: restantes > 0
        ? `Credenciales incorrectas. ${restantes} intento(s) restantes.`
        : 'IP bloqueada por 15 minutos.'
    });
  }

  limpiarIntentos(clientIp);
  const token = generarToken(username);
  logSeguridad('LOGIN_EXITOSO', `Admin autenticado: ${username}`, clientIp);

  res.cookie('chl_session', token, cookieOpts());
  res.json({ ok: true, mensaje: 'Autenticado correctamente' });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  logSeguridad('LOGOUT', `Admin: ${req.admin.sub}`, ip(req));
  res.clearCookie('chl_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({ ok: true, usuario: req.admin.sub, expira: new Date(req.admin.exp * 1000).toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PANEL ADMIN — protegido
// ─────────────────────────────────────────────────────────────────────────────

app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(WEB, 'admin.html')));
app.get('/escribir', requireAuth, (req, res) => res.sendFile(path.join(WEB, 'escribir.html')));

// ─────────────────────────────────────────────────────────────────────────────
//  API REST — todas protegidas con requireAuth
// ─────────────────────────────────────────────────────────────────────────────

const api = express.Router();
api.use(requireAuth);

// Info del sistema (IP local para conexión Android)
api.get('/sistema/info', (req, res) => {
  const nets = os.networkInterfaces();
  let lanIP = 'localhost';
  for (const n of Object.values(nets)) {
    for (const net of n) {
      if (net.family === 'IPv4' && !net.internal) { lanIP = net.address; break; }
    }
    if (lanIP !== 'localhost') break;
  }
  const publicBaseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    lan_ip:   lanIP,
    port:     PORT,
    base_url: publicBaseUrl,
    entorno:  process.env.NODE_ENV || 'development',
    url_escribir: `${publicBaseUrl.replace(/\/$/, '')}/escribir`
  });
});

// Estado general
api.get('/estado', (req, res) => {
  const lotes    = leerDB('lotes').lotes;
  const codigos  = leerDB('codigos').codigos;
  const escaneos = leerDB('escaneos').escaneos;
  const alertas  = detectarAlertas(escaneos, codigos);
  res.json({
    lotes_total:    lotes.length,
    lotes_activos:  lotes.filter(l => l.estado === 'activo').length,
    codigos_total:  codigos.length,
    escaneos_total: escaneos.length,
    alertas_activas: alertas.length,
    ultimo_escaneo: escaneos[escaneos.length - 1] || null
  });
});

// Lotes
api.get('/lotes', (req, res) => res.json(leerDB('lotes').lotes));

api.post('/lotes', [
  body('modelo').trim().notEmpty().isLength({ max: 80 }).matches(/^[\p{L}\p{N}\s\/\-\.\(\)]+$/u),
  body('color').trim().notEmpty().isLength({ max: 50 }),
  body('talla').trim().isLength({ max: 30 }),
  body('cantidad').isInt({ min: 1, max: 500 }),
  body('temporada').trim().isLength({ max: 50 })
], (req, res) => {
  if (validar(req, res)) return;
  try {
    const { modelo, color, talla, cantidad, temporada } = req.body;
    const resultado = generarLote({
      lote_id:   generarLoteId(modelo),
      modelo, color,
      talla:     talla || 'Única',
      cantidad:  parseInt(cantidad),
      temporada: temporada || String(new Date().getFullYear()),
      base_url:  baseUrl(req)
    });
    auditoria('NEXO', 'LOTE_CREADO', `${resultado.lote_id} — ${cantidad} uds`, ip(req));
    res.json(resultado);
  } catch (e) {
    console.error('[LOTE_ERROR]', e.message);
    res.status(500).json({ error: 'Error interno al crear lote', detalle: e.message });
  }
});

api.get('/lotes/:id', [
  param('id').matches(/^QUIE-[A-Z0-9]+-\d{4}-\d{3}$/)
], (req, res) => {
  if (validar(req, res)) return;
  const lote = leerDB('lotes').lotes.find(l => l.id === req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  const codigos = leerDB('codigos').codigos.filter(c => c.lote_id === req.params.id);
  res.json({ ...lote, codigos });
});

api.patch('/lotes/:id/estado', [
  param('id').matches(/^QUIE-[A-Z0-9]+-\d{4}-\d{3}$/),
  body('estado').isIn(['codigos_generados','tags_programados','paginas_creadas','activo','inactivo'])
], (req, res) => {
  if (validar(req, res)) return;
  const db = leerDB('lotes');
  const lote = db.lotes.find(l => l.id === req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  lote.estado = req.body.estado;
  lote.fecha_cambio_estado = new Date().toISOString();
  guardarDB('lotes', db);
  auditoria('DataVault', 'ESTADO_LOTE', `${req.params.id} → ${req.body.estado}`, ip(req));
  res.json(lote);
});

// Códigos
api.delete('/lotes/:id', [
  param('id').matches(/^QUIE-[A-Z0-9]+-\d{4}-\d{3}$/)
], (req, res) => {
  if (validar(req, res)) return;

  const loteId = req.params.id;
  const dbLotes = leerDB('lotes');
  const lote = dbLotes.lotes.find(l => l.id === loteId);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

  const dbCodigos = leerDB('codigos');
  const codigosDelLote = dbCodigos.codigos.filter(c => c.lote_id === loteId);
  const codigosSet = new Set(codigosDelLote.map(c => c.codigo_nfc));

  dbLotes.lotes = dbLotes.lotes.filter(l => l.id !== loteId);
  dbCodigos.codigos = dbCodigos.codigos.filter(c => c.lote_id !== loteId);
  guardarDB('lotes', dbLotes);
  guardarDB('codigos', dbCodigos);

  const dbEscaneos = leerDB('escaneos');
  const escaneosAntes = dbEscaneos.escaneos.length;
  dbEscaneos.escaneos = dbEscaneos.escaneos.filter(e => !codigosSet.has(e.codigo_id));
  guardarDB('escaneos', dbEscaneos);

  const dbClientes = leerDB('clientes');
  const clientesAntes = dbClientes.clientes.length;
  dbClientes.clientes = dbClientes.clientes.filter(c => c.lote_id !== loteId && !codigosSet.has(c.codigo_nfc));
  guardarDB('clientes', dbClientes);

  const csvPath = path.join(__dirname, `../codigos_csv/${loteId}.csv`);
  if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

  auditoria('DataVault', 'LOTE_ELIMINADO', `${loteId} - ${codigosDelLote.length} codigos`, ip(req));
  res.json({
    ok: true,
    lote_id: loteId,
    codigos_eliminados: codigosDelLote.length,
    escaneos_eliminados: escaneosAntes - dbEscaneos.escaneos.length,
    clientes_eliminados: clientesAntes - dbClientes.clientes.length
  });
});

api.get('/codigos', (req, res) => {
  let codigos = leerDB('codigos').codigos;
  if (req.query.lote) {
    const lote = req.query.lote.replace(/[^A-Z0-9\-]/gi, '');
    codigos = codigos.filter(c => c.lote_id === lote);
  }
  res.json(codigos);
});

api.get('/codigos/:codigo', [
  param('codigo').matches(/^QUIE-[A-Z0-9]{6}-[0-9]{2}$/)
], (req, res) => {
  if (validar(req, res)) return;
  const codigo = leerDB('codigos').codigos.find(c => c.codigo_nfc === req.params.codigo.toUpperCase());
  if (!codigo) return res.status(404).json({ error: 'Código no encontrado' });
  const escaneos = leerDB('escaneos').escaneos.filter(e => e.codigo_id === codigo.codigo_nfc);
  res.json({ ...codigo, total_escaneos: escaneos.length });
});

// Escaneos
api.get('/escaneos', (req, res) => {
  const escaneos = leerDB('escaneos').escaneos;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(escaneos.slice(-limit).reverse());
});

// Catalogo
api.get('/productos', (req, res) => {
  res.json(leerDB('productos').productos);
});

api.post('/productos', (req, res, next) => {
  uploadFotoProducto(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ error: err.message || 'No se pudo subir la foto del producto' });
  });
}, [
  body('nombre').trim().notEmpty().isLength({ min: 2, max: 80 }),
  body('modelo').trim().notEmpty().isLength({ max: 80 }),
  body('color').trim().notEmpty().isLength({ max: 50 }),
  body('descripcion_corta').trim().notEmpty().isLength({ max: 160 }),
  body('descripcion').trim().notEmpty().isLength({ max: 800 }),
  body('estado').optional().isIn(['activo', 'inactivo'])
], (req, res) => {
  const borrarFotoSubida = () => {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  };
  if (validar(req, res)) {
    borrarFotoSubida();
    return;
  }
  const db = leerDB('productos');
  const baseId = (req.body.id || req.body.nombre)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let id = baseId || `producto-${Date.now()}`;
  let n = 2;
  while (db.productos.some(p => p.id === id)) id = `${baseId}-${n++}`;

  const producto = {
    id,
    nombre: req.body.nombre,
    modelo: req.body.modelo,
    color: req.body.color,
    talla: req.body.talla || 'Unica',
    descripcion_corta: req.body.descripcion_corta,
    descripcion: req.body.descripcion,
    materiales: req.body.materiales || '',
    ideal_para: req.body.ideal_para || '',
    personalizacion: req.body.personalizacion || '',
    foto_producto: req.file ? `/uploads/productos/${req.file.filename}` : '',
    nfc: req.body.nfc !== false && req.body.nfc !== 'false',
    precio_desde: req.body.precio_desde || '',
    estado: req.body.estado || 'activo',
    destacado: req.body.destacado === true || req.body.destacado === 'true'
  };
  db.productos.push(producto);
  guardarDB('productos', db);
  auditoria('DataVault', 'PRODUCTO_CREADO', producto.id, ip(req));
  res.json(producto);
});

api.patch('/productos/:id', (req, res, next) => {
  uploadFotoProducto(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ error: err.message || 'No se pudo subir la foto del producto' });
  });
}, [
  param('id').matches(/^[a-z0-9-]{2,80}$/),
  body('nombre').optional().trim().isLength({ min: 2, max: 80 }),
  body('modelo').optional().trim().isLength({ max: 80 }),
  body('color').optional().trim().isLength({ max: 50 }),
  body('descripcion_corta').optional().trim().isLength({ max: 160 }),
  body('descripcion').optional().trim().isLength({ max: 800 }),
  body('estado').optional().isIn(['activo', 'inactivo'])
], (req, res) => {
  const borrarFotoSubida = () => {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  };
  if (validar(req, res)) {
    borrarFotoSubida();
    return;
  }
  const db = leerDB('productos');
  const producto = db.productos.find(p => p.id === req.params.id);
  if (!producto) {
    borrarFotoSubida();
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  const campos = ['nombre','modelo','color','talla','descripcion_corta','descripcion','materiales','ideal_para','personalizacion','precio_desde','estado','destacado','nfc'];
  for (const campo of campos) {
    if (Object.prototype.hasOwnProperty.call(req.body, campo)) producto[campo] = req.body[campo];
  }
  if (req.file) {
    if (producto.foto_producto) {
      const anterior = path.join(__dirname, '..', producto.foto_producto.replace(/^\//, ''));
      if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
    }
    producto.foto_producto = `/uploads/productos/${req.file.filename}`;
  }
  guardarDB('productos', db);
  auditoria('DataVault', 'PRODUCTO_EDITADO', producto.id, ip(req));
  res.json(producto);
});

api.delete('/productos/:id', [
  param('id').matches(/^[a-z0-9-]{2,80}$/)
], (req, res) => {
  if (validar(req, res)) return;
  const db = leerDB('productos');
  const antes = db.productos.length;
  const producto = db.productos.find(p => p.id === req.params.id);
  db.productos = db.productos.filter(p => p.id !== req.params.id);
  if (db.productos.length === antes) return res.status(404).json({ error: 'Producto no encontrado' });
  if (producto?.foto_producto) {
    const fotoPath = path.join(__dirname, '..', producto.foto_producto.replace(/^\//, ''));
    if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
  }
  guardarDB('productos', db);
  auditoria('DataVault', 'PRODUCTO_ELIMINADO', req.params.id, ip(req));
  res.json({ ok: true });
});

// Reportes
const tiposReporte = ['escaneos_diarios','productos_populares','tasa_autenticidad','campania','completo'];
api.get('/reportes/:tipo', [
  param('tipo').isIn(tiposReporte)
], (req, res) => {
  if (validar(req, res)) return;
  const reporte = generarReporte({
    tipo_reporte: req.params.tipo,
    rango_fechas: {
      desde: req.query.desde || undefined,
      hasta: req.query.hasta || undefined
    },
    filtro_lote: req.query.lote || undefined
  });
  res.json(reporte);
});

// CRM — Clientes registrados
api.get('/clientes', (req, res) => {
  const db = leerDB('clientes');
  let lista = [...db.clientes].reverse();
  if (req.query.lote) lista = lista.filter(c => c.lote_id === req.query.lote);
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    lista = lista.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.whatsapp.includes(q) ||
      c.ciudad.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }
  res.json({ total: db.clientes.length, clientes: lista.slice(0, 200) });
});

// Alertas
api.get('/alertas', (req, res) => {
  const escaneos = leerDB('escaneos').escaneos;
  const codigos  = leerDB('codigos').codigos;
  res.json(detectarAlertas(escaneos, codigos));
});

// Descarga CSV
api.get('/csv/:lote', [
  param('lote').matches(/^QUIE-[A-Z0-9]+-\d{4}-\d{3}$/)
], (req, res) => {
  if (validar(req, res)) return;
  const loteId = req.params.lote;
  const csvPath = path.join(__dirname, `../codigos_csv/${loteId}.csv`);
  if (fs.existsSync(csvPath)) return res.download(csvPath);

  const codigosMemoria = obtenerCodigosLote(loteId);
  const codigosDb = leerDB('codigos').codigos.filter(c => c.lote_id === loteId);
  const codigos = codigosDb.length
    ? codigosDb
    : codigosMemoria.length ? codigosMemoria
    : loteId === DEMO_NFC_RECORD.lote_id ? DEMO_CSV_CODES : [];

  if (!codigos.length) return res.status(404).json({ error: 'CSV no encontrado' });

  const csv = construirCsvCodigos(codigos, req);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${loteId}.csv"`);
  res.send('\uFEFF' + csv);
});

app.use('/api', api);

// ─────────────────────────────────────────────────────────────────────────────
//  MANEJO DE ERRORES — nunca exponer stack traces
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generarLoteId(modelo) {
  const db    = leerDB('lotes');
  const abrev = modelo.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
  const anio  = new Date().getFullYear();
  const seq   = String(db.lotes.length + 1).padStart(3, '0');
  return `QUIE-${abrev}-${anio}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ARRANQUE
// ─────────────────────────────────────────────────────────────────────────────

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`QUIE NFC System listo en http://localhost:${PORT}`);
  });
}

module.exports = app;
