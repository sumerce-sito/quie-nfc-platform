'use strict';
require('dotenv').config();

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');

const JWT_SECRET  = process.env.JWT_SECRET || 'quie-hackathon-demo-jwt-secret-change-after-demo';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '2h';
const LOG_PATH    = path.join(__dirname, '../auditoria/log.json');
const DEMO_ADMIN_USERNAME = 'nexo_admin';
const DEMO_ADMIN_HASH = '$2b$12$itz4lomSc99.5faievywmOeshdUMAvhCJ301KwPq3PFVp8kpEEKEy';

// ── Registro inmutable de eventos de seguridad ───────────────────────────────
function logSeguridad(evento, detalle, ip = 'desconocida') {
  try {
    const log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    log.eventos.push({
      id:        log.eventos.length + 1,
      timestamp: new Date().toISOString(),
      agente:    'AUTH',
      accion:    evento,
      detalle,
      ip,
      resultado: evento.includes('FALLO') || evento.includes('BLOQUEO') ? 'fallido' : 'exitoso'
    });
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  } catch (_) {}
}

// ── Protección contra fuerza bruta (en memoria) ──────────────────────────────
const intentosFallidos = new Map(); // ip → { count, bloqueadoHasta }
const MAX_INTENTOS    = 5;
const BLOQUEO_MS      = 15 * 60 * 1000; // 15 minutos

function estaBloquada(ip) {
  const r = intentosFallidos.get(ip);
  if (!r) return false;
  if (r.bloqueadoHasta && Date.now() < r.bloqueadoHasta) return true;
  if (r.bloqueadoHasta && Date.now() >= r.bloqueadoHasta) {
    intentosFallidos.delete(ip);
    return false;
  }
  return false;
}

function registrarFallo(ip) {
  const r = intentosFallidos.get(ip) || { count: 0 };
  r.count++;
  if (r.count >= MAX_INTENTOS) {
    r.bloqueadoHasta = Date.now() + BLOQUEO_MS;
  }
  intentosFallidos.set(ip, r);
  return r.count;
}

function limpiarIntentos(ip) {
  intentosFallidos.delete(ip);
}

function tiempoRestanteBloqueo(ip) {
  const r = intentosFallidos.get(ip);
  if (!r || !r.bloqueadoHasta) return 0;
  return Math.ceil((r.bloqueadoHasta - Date.now()) / 1000 / 60);
}

// ── Login ────────────────────────────────────────────────────────────────────
function verificarCredenciales(username, password) {
  const credenciales = [
    {
      user: process.env.ADMIN_USERNAME,
      hash: process.env.ADMIN_PASSWORD_HASH
    },
    {
      user: DEMO_ADMIN_USERNAME,
      hash: DEMO_ADMIN_HASH
    },
    {
      user: 'quie_admin',
      hash: DEMO_ADMIN_HASH
    }
  ].filter(c => c.user && c.hash);

  const credencial = credenciales.find(c => username === c.user);
  if (!credencial) return false;
  return bcrypt.compareSync(password, credencial.hash);
}

function generarToken(username) {
  return jwt.sign(
    { sub: username, rol: 'admin', jti: crypto.randomBytes(16).toString('hex') },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, algorithm: 'HS256' }
  );
}

// ── Middleware: requiere JWT en cookie httpOnly ───────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies?.chl_session;
  const esAPI = req.xhr || req.path.startsWith('/api/') ||
                req.originalUrl.startsWith('/api/') ||
                (req.headers['content-type'] || '').includes('application/json') ||
                (req.headers['accept'] || '').includes('application/json');

  if (!token) {
    if (esAPI) return res.status(401).json({ error: 'No autenticado' });
    return res.redirect('/login');
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.admin = payload;
    next();
  } catch (err) {
    res.clearCookie('chl_session');
    if (esAPI) return res.status(401).json({ error: 'Sesión inválida o expirada' });
    return res.redirect('/login');
  }
}

// ── Opciones de cookie segura ─────────────────────────────────────────────────
function cookieOpts() {
  return {
    httpOnly:  true,                              // inaccesible desde JS
    secure:    process.env.NODE_ENV === 'production', // HTTPS en prod
    sameSite:  'lax',                             // anti-CSRF, permite navegación top-level
    maxAge:    2 * 60 * 60 * 1000,               // 2 horas
    path:      '/'
  };
}

module.exports = {
  verificarCredenciales,
  generarToken,
  requireAuth,
  cookieOpts,
  estaBloquada,
  registrarFallo,
  limpiarIntentos,
  tiempoRestanteBloqueo,
  logSeguridad
};
