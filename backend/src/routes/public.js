import express from 'express';
import mongoose from 'mongoose';
import { listPublicCategories, listPublicProducts, resolvePublicRestaurant,
  serializePublicRestaurant } from '../services/publicMenu.js';
import { createGuestOrder, betaCheckoutBody } from '../services/guestCheckout.js';
import { publicMedia } from '../services/ownerMedia.js';

export function checkoutRateLimit({ limit = 60, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      while (buckets.size > 10_000) buckets.delete(buckets.keys().next().value);
    }
    const key = `${req.ip}:${req.params.slug.toLowerCase()}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++bucket.count > limit) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many checkout requests' });
    }
    next();
  };
}

export function createPublicRouter({ connection = mongoose.connection, mediaStorage = null,
  checkoutEnabled = true, checkoutAllowedOrigins, checkoutLimit = 60,
  betaCheckout = false, betaWhatsAppTargets = new Map() } = {}) {
  const router = express.Router();
  const betaTargets = betaCheckout ? betaWhatsAppTargets : undefined;

  router.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'OPTIONS') return next();
    if (!['GET', 'HEAD', 'POST'].includes(req.get('Access-Control-Request-Method'))) {
      return res.sendStatus(405);
    }
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    return res.sendStatus(204);
  });

  router.get('/restaurants/:slug', async (req, res) => {
    const restaurant = await resolvePublicRestaurant(connection, req.params.slug);
    res.json({ restaurant: serializePublicRestaurant(restaurant, { checkoutEnabled, betaWhatsAppTargets: betaTargets }) });
  });

  router.get('/restaurants/:slug/categories', async (req, res) => {
    const restaurant = await resolvePublicRestaurant(connection, req.params.slug);
    res.json(await listPublicCategories(connection, restaurant, req.query));
  });

  router.get('/restaurants/:slug/products', async (req, res) => {
    const restaurant = await resolvePublicRestaurant(connection, req.params.slug);
    res.json(await listPublicProducts(connection, restaurant, req.query));
  });

  router.get('/restaurants/:slug/media/:id/:size', async (req, res) => {
    const restaurant = await resolvePublicRestaurant(connection, req.params.slug);
    const stream = await publicMedia(connection, mediaStorage, restaurant,
      req.params.id, req.params.size);
    if (!stream) return res.status(404).json({ error: 'Not found' });
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=60');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });

  router.post('/restaurants/:slug/orders', (req, res, next) => {
    if (!checkoutEnabled) return res.status(503).json({ error: 'Checkout unavailable' });
    if (checkoutAllowedOrigins && !checkoutAllowedOrigins.includes(req.get('Origin'))) {
      return res.status(403).json({ error: 'Untrusted checkout origin' });
    }
    next();
  }, checkoutRateLimit({ limit: checkoutLimit }),
    express.json({ limit: '12kb', strict: true }), async (req, res) => {
      const body = betaCheckout ? betaCheckoutBody(req.body) : req.body;
      const result = await createGuestOrder(connection, req.params.slug, body,
        req.get('Idempotency-Key'), { betaWhatsAppTargets: betaTargets, checkoutEnabled });
      res.status(result.replayed ? 200 : 201).json({ order: result.order,
        ...(result.whatsapp ? { whatsapp: result.whatsapp } : {}) });
    });

  return router;
}
