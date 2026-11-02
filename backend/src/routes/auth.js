import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { authenticateOwner, loginOwner, logoutOwner, SESSION_TTL_MS, tokenHash } from '../services/ownerAuth.js';

const SESSION_COOKIE = 'savora_owner_session';
const CSRF_COOKIE = 'savora_owner_csrf';
const COOKIE_PATH = '/api';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const LOGIN_ERROR = { error: 'Invalid credentials' };

function trustedOrigins(value, secureCookies) {
  if (!value) return new Set();
  return new Set(value.split(',').map((entry) => {
    const origin = entry.trim();
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('Invalid AUTH_TRUSTED_ORIGINS'); }
    if (parsed.origin !== origin || parsed.username || parsed.password ||
        !['http:', 'https:'].includes(parsed.protocol) ||
        (secureCookies && parsed.protocol !== 'https:')) {
      throw new Error('Invalid AUTH_TRUSTED_ORIGINS');
    }
    return origin;
  }));
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header || header.length > 4096) return null;
  const matches = header.split(';').map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}

function cookie(name, value, { secureCookies, httpOnly = true, maxAge = 0 } = {}) {
  const parts = [`${name}=${value}`, `Path=${COOKIE_PATH}`, 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (secureCookies) parts.push('Secure');
  parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function clearCookies(res, secureCookies) {
  res.setHeader('Set-Cookie', [
    cookie(SESSION_COOKIE, '', { secureCookies }),
    cookie(CSRF_COOKIE, '', { secureCookies, httpOnly: false }),
  ]);
}

export function sessionCookies(sessionToken, csrfToken, secureCookies) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return [
    cookie(SESSION_COOKIE, sessionToken, { secureCookies, maxAge }),
    cookie(CSRF_COOKIE, csrfToken, { secureCookies, httpOnly: false, maxAge }),
  ];
}

export function createLoginLimiter({ maxAttempts = 10, windowMs = 15 * 60 * 1000,
  now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const time = now();
    let entry = attempts.get(key);
    if (!entry || entry.expiresAt <= time) entry = { count: 0, expiresAt: time + windowMs };
    if (entry.count >= maxAttempts) {
      res.set('Retry-After', String(Math.ceil((entry.expiresAt - time) / 1000)));
      return res.status(429).json({ error: 'Too many login attempts' });
    }
    entry.count++;
    attempts.delete(key);
    attempts.set(key, entry);
    if (attempts.size > 5000) attempts.delete(attempts.keys().next().value);
    next();
  };
}

export function createOwnerMiddleware({ connection = mongoose.connection,
  secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  return async (req, res, next) => {
    const sessionToken = readCookie(req, SESSION_COOKIE);
    if (!TOKEN_PATTERN.test(sessionToken ?? '')) {
      if (req.headers.cookie) clearCookies(res, secureCookies);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const auth = await authenticateOwner(connection, sessionToken);
      if (!auth) {
        clearCookies(res, secureCookies);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.auth = auth;
      next();
    } catch (error) { next(error); }
  };
}

export function requireOwnerCsrf(req, res, next) {
  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken = req.get('X-Savora-CSRF');
  if (!TOKEN_PATTERN.test(cookieToken ?? '') || !TOKEN_PATTERN.test(headerToken ?? '') ||
      !timingSafeEqual(Buffer.from(cookieToken, 'hex'), Buffer.from(headerToken, 'hex')) ||
      tokenHash(headerToken) !== req.auth.csrfTokenHash) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function validLoginBody(body) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 2 && Object.hasOwn(body, 'email') &&
    Object.hasOwn(body, 'password') && typeof body.email === 'string' &&
    body.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) &&
    typeof body.password === 'string' && body.password.length >= 12 &&
    body.password.length <= 128;
}

export function createAuthRouter({ connection = mongoose.connection,
  allowedOrigins = process.env.AUTH_TRUSTED_ORIGINS,
  secureCookies = process.env.NODE_ENV === 'production',
  loginLimiter = createLoginLimiter() } = {}) {
  const { cors, trustedMutationOrigin, trustedCsrfReadOrigin } = createAuthGuards({
    allowedOrigins, secureCookies });
  const router = express.Router();
  router.use(cors);
  const requireOwner = createOwnerMiddleware({ connection, secureCookies });

  router.post('/login', trustedMutationOrigin, loginLimiter,
    express.json({ limit: '4kb', strict: true }), async (req, res) => {
      if (req.get('X-Savora-CSRF') !== '1' || !validLoginBody(req.body)) {
        return res.status(401).json(LOGIN_ERROR);
      }
      const email = req.body.email.trim().toLowerCase();
      const result = await loginOwner(connection, email, req.body.password);
      if (!result) return res.status(401).json(LOGIN_ERROR);
      res.setHeader('Set-Cookie', sessionCookies(result.sessionToken, result.csrfToken,
        secureCookies));
      return res.json({ user: {
        id: String(result.user._id), name: result.user.name, email: result.user.email,
      }, restaurant: {
        id: String(result.restaurant._id), name: result.restaurant.name,
        slug: result.restaurant.slug, currency: result.restaurant.currency,
      } });
    });

  router.get('/me', requireOwner, (req, res) => res.json({
    user: { id: String(req.auth.userId), name: req.auth.user.name, email: req.auth.user.email },
    restaurant: {
      id: String(req.auth.restaurantId), name: req.auth.restaurant.name,
      slug: req.auth.restaurant.slug, currency: req.auth.restaurant.currency,
    },
  }));

  // A dashboard on a sibling hostname cannot read the API's host-only CSRF cookie.
  router.get('/csrf', trustedCsrfReadOrigin, requireOwner, (req, res) => {
    const csrfToken = readCookie(req, CSRF_COOKIE);
    if (!TOKEN_PATTERN.test(csrfToken ?? '') ||
        tokenHash(csrfToken) !== req.auth.csrfTokenHash) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({ csrfToken });
  });

  router.post('/logout', trustedMutationOrigin, requireOwner, requireOwnerCsrf, async (req, res) => {
    await logoutOwner(connection, req.auth.sessionId);
    clearCookies(res, secureCookies);
    res.status(204).end();
  });

  return router;
}

export function createAuthGuards({ allowedOrigins = process.env.AUTH_TRUSTED_ORIGINS,
  secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const origins = trustedOrigins(allowedOrigins, secureCookies);
  return {
    cors(req, res, next) {
      res.set('Cache-Control', 'no-store');
      res.vary('Origin');
      const origin = req.get('Origin');
      if (origin && origins.has(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
      }
      if (req.method === 'OPTIONS') {
        if (!origin || !origins.has(origin)) return res.sendStatus(403);
        res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Savora-CSRF');
        return res.sendStatus(204);
      }
      next();
    },
    trustedMutationOrigin(req, res, next) {
      if (!origins.has(req.get('Origin'))) return res.status(403).json({ error: 'Forbidden' });
      next();
    },
    trustedCsrfReadOrigin(req, res, next) {
      const origin = req.get('Origin');
      if (origin) {
        if (!origins.has(origin)) return res.status(403).json({ error: 'Forbidden' });
        return next();
      }
      // Browsers omit Origin on same-origin GET. Require a trusted Referer instead;
      // Host and forwarded headers are not proof of the caller's origin.
      let referer;
      try { referer = new URL(req.get('Referer')); }
      catch { return res.status(403).json({ error: 'Forbidden' }); }
      if (!origins.has(referer.origin) || referer.username || referer.password ||
          ['cross-site', 'none'].includes(req.get('Sec-Fetch-Site'))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    },
  };
}
