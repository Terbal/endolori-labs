// auth.js — lightweight signed-session authentication for the admin dashboard.
//
// No third-party auth service: a session token is an HMAC-signed expiry
// timestamp, stored in an HttpOnly cookie. Credentials are compared against
// ADMIN_USERNAME / ADMIN_PASSWORD environment variables (set these on Render
// — never hardcode them). SESSION_SECRET should also be set as an env var so
// sessions survive server restarts; if it's missing, a random one is
// generated at boot (sessions just get invalidated on every restart, which
// is a safe default, not a security hole).

const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
const COOKIE_NAME = 'eo_admin_session';

function sign(value) {
  const h = crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
  return `${value}.${h}`;
}

function createSessionToken() {
  const expiry = Date.now() + SESSION_MAX_AGE_MS;
  return sign(String(expiry));
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return false;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
  // constant-time comparison to avoid timing attacks
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  const expiry = parseInt(value, 10);
  if (!expiry || Date.now() > expiry) return false;
  return true;
}

function checkCredentials(username, password) {
  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;
  if (!validUser || !validPass) return { ok: false, reason: 'not_configured' };
  if (username === validUser && password === validPass) return { ok: true };
  return { ok: false, reason: 'invalid' };
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (verifySessionToken(token)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = {
  COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionToken,
  verifySessionToken,
  checkCredentials,
  requireAuth
};
