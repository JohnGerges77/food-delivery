import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { createAuthGuards, createLoginLimiter } from './auth.js';
import { SESSION_TTL_MS, tokenHash } from '../services/ownerAuth.js';
import { authenticatePlatformAdmin, loginPlatformAdmin,
  logoutPlatformAdmin } from '../services/platformAdminAuth.js';
import { changeRestaurantStatus, changeRestaurantTheme, createPlatformRestaurant, getPlatformRestaurant,
  listPlatformRestaurants, platformOverview } from '../services/platformRestaurants.js';

const SESSION = 'savora_platform_session';
const CSRF = 'savora_platform_csrf';
const TOKEN = /^[0-9a-f]{64}$/;
const PATH = '/api/admin';
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header || header.length > 4096) return null;
  const found = header.split(';').map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return found.length === 1 ? found[0].slice(name.length + 1) : null;
}
function cookie(name, value, secure, maxAge, httpOnly = true) {
  return `${name}=${value}; Path=${PATH}; SameSite=Lax${secure ? '; Secure' : ''}` +
    `${httpOnly ? '; HttpOnly' : ''}; Max-Age=${maxAge}`;
}
function clear(res, secure) {
  res.setHeader('Set-Cookie', [cookie(SESSION, '', secure, 0),
    cookie(CSRF, '', secure, 0, false)]);
}
export function createAdminMiddleware({ connection = mongoose.connection,
  secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION);
    if (!TOKEN.test(token ?? '')) {
      if (req.headers.cookie) clear(res, secureCookies);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const auth = await authenticatePlatformAdmin(connection, token);
      if (!auth) {
        clear(res, secureCookies);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.platformAuth = auth;
      next();
    } catch (error) { next(error); }
  };
}
export function requireAdminCsrf(req, res, next) {
  const supplied = req.get('X-Savora-CSRF');
  const stored = readCookie(req, CSRF);
  if (!TOKEN.test(supplied ?? '') || !TOKEN.test(stored ?? '') ||
      !timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(stored, 'hex')) ||
      tokenHash(supplied) !== req.platformAuth.csrfTokenHash) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
function validLogin(body) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 2 && typeof body.email === 'string' &&
    body.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) &&
    typeof body.password === 'string' && body.password.length >= 12 &&
    body.password.length <= 128;
}
export function createAdminRouter({ connection = mongoose.connection,
  allowedOrigins = process.env.AUTH_TRUSTED_ORIGINS,
  secureCookies = process.env.NODE_ENV === 'production',
  adminLoginLimiter = createLoginLimiter() } = {}) {
  const router = express.Router();
  const { cors, trustedMutationOrigin } = createAuthGuards({ allowedOrigins, secureCookies });
  router.use(cors);
  const requireAdmin = createAdminMiddleware({ connection, secureCookies });
  router.post('/auth/login', trustedMutationOrigin, adminLoginLimiter,
    express.json({ limit: '4kb', strict: true }), async (req, res) => {
      if (req.get('X-Savora-CSRF') !== '1' || !validLogin(req.body)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const result = await loginPlatformAdmin(connection, req.body.email.trim().toLowerCase(),
        req.body.password);
      if (!result) return res.status(401).json({ error: 'Invalid credentials' });
      const maxAge = Math.floor(SESSION_TTL_MS / 1000);
      res.setHeader('Set-Cookie', [cookie(SESSION, result.sessionToken, secureCookies, maxAge),
        cookie(CSRF, result.csrfToken, secureCookies, maxAge, false)]);
      return res.json({ admin: { id: String(result.admin._id), email: result.admin.email } });
    });
  router.use(requireAdmin);
  router.get('/auth/me', (req, res) => res.json({ admin: {
    id: String(req.platformAuth.admin._id), email: req.platformAuth.admin.email,
  } }));
  router.get('/auth/csrf', trustedMutationOrigin, (req, res) => {
    const value = readCookie(req, CSRF);
    if (!TOKEN.test(value ?? '') || tokenHash(value) !== req.platformAuth.csrfTokenHash) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ csrfToken: value });
  });
  router.post('/auth/logout', trustedMutationOrigin, requireAdminCsrf, async (req, res) => {
    await logoutPlatformAdmin(connection, req.platformAuth.sessionId);
    clear(res, secureCookies);
    res.status(204).end();
  });
  router.get('/overview', async (_req, res) => res.json(await platformOverview(connection)));
  router.get('/restaurants', async (req, res) =>
    res.json(await listPlatformRestaurants(connection, req.query)));
  router.get('/restaurants/:id', async (req, res) =>
    res.json({ restaurant: await getPlatformRestaurant(connection, req.params.id) }));
  router.post('/restaurants', trustedMutationOrigin, requireAdminCsrf,
    express.json({ limit: '8kb', strict: true }), async (req, res) => {
      res.status(201).json({ restaurant: await createPlatformRestaurant(connection,
        req.platformAuth.admin._id, req.body) });
    });
  router.patch('/restaurants/:id/status', trustedMutationOrigin, requireAdminCsrf,
    express.json({ limit: '2kb', strict: true }), async (req, res) => {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          Object.keys(req.body).length !== 1) return res.status(400).json({ error: 'Invalid admin input' });
      res.json({ restaurant: await changeRestaurantStatus(connection,
        req.platformAuth.admin._id, req.params.id, req.body.status) });
    });
  router.patch('/restaurants/:id/theme', trustedMutationOrigin, requireAdminCsrf,
    express.json({ limit: '2kb', strict: true }), async (req, res) => {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          Object.keys(req.body).length !== 1) return res.status(400).json({ error: 'Invalid admin input' });
      res.json({ restaurant: await changeRestaurantTheme(connection,
        req.platformAuth.admin._id, req.params.id, req.body.storefrontTheme) });
    });
  return router;
}
