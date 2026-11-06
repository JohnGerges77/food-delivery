import express from 'express';
import mongoose from 'mongoose';
import { createAuthGuards, createOwnerMiddleware, requireOwnerCsrf } from './auth.js';
import { getOwnerRestaurant, patchOwnerRestaurant } from '../services/restaurantSettings.js';
import { createOwnerCategory, deleteOwnerCategory, getOwnerCategory,
  listOwnerCategories, patchOwnerCategory, serializeOwnerCategory } from '../services/ownerCategories.js';
import { createOwnerProduct, deleteOwnerProduct, getOwnerProduct,
  listOwnerProducts, patchOwnerProduct, serializeOwnerProduct } from '../services/ownerProducts.js';
import { getOwnerOrder, listOwnerOrders, patchOwnerOrderStatus } from '../services/ownerOrders.js';
import { parseAnalyticsQuery } from '../services/analyticsPeriod.js';
import { ownerActivity, ownerBreakdowns, ownerOverview,
  ownerTopProducts, ownerTrends } from '../services/ownerAnalytics.js';
import { cleanupRetiredMedia, deleteOwnerImage, replaceOwnerImage, requireMediaIndexes } from '../services/ownerMedia.js';
import MediaAssetSchema from '../models/MediaAsset.js';

export function serializeOwnerRestaurant(restaurant) {
  return {
    id: String(restaurant._id),
    name: restaurant.name,
    slug: restaurant.slug,
    currency: restaurant.currency,
    status: restaurant.status,
    heroProductId: restaurant.heroProductId ? String(restaurant.heroProductId) : null,
    description: restaurant.description ?? null,
    logoUrl: restaurant.logoUrl ?? null,
    phone: restaurant.phone ?? null,
    contactEmail: restaurant.contactEmail ?? null,
    address: restaurant.address ?? null,
    openingHours: restaurant.openingHours ?? null,
    deliverySettings: {
      deliveryFee: restaurant.deliverySettings?.deliveryFee ?? null,
      minimumOrder: restaurant.deliverySettings?.minimumOrder ?? null,
      estimatedDeliveryTime: restaurant.deliverySettings?.estimatedDeliveryTime ?? null,
      deliveryAvailable: restaurant.deliverySettings?.deliveryAvailable ?? true,
    },
    socialLinks: {
      facebook: restaurant.socialLinks?.facebook ?? null,
      instagram: restaurant.socialLinks?.instagram ?? null,
      whatsapp: restaurant.socialLinks?.whatsapp ?? null,
    },
    branding: {
      brandName: restaurant.branding?.brandName ?? null,
      primaryColor: restaurant.branding?.primaryColor ?? null,
    },
  };
}

export function createOwnerRouter({ connection = mongoose.connection,
  allowedOrigins = process.env.AUTH_TRUSTED_ORIGINS,
  secureCookies = process.env.NODE_ENV === 'production', mediaStorage = null } = {}) {
  const router = express.Router();
  const { cors, trustedMutationOrigin } = createAuthGuards({ allowedOrigins, secureCookies });
  router.use(cors);
  router.use(createOwnerMiddleware({ connection, secureCookies }));

  router.get('/restaurant', async (req, res) => {
    res.json({ restaurant: serializeOwnerRestaurant(
      await getOwnerRestaurant(connection, req.auth)) });
  });

  router.patch('/restaurant', trustedMutationOrigin, requireOwnerCsrf,
    express.json({ limit: '8kb', strict: true }), async (req, res) => {
      res.json({ restaurant: serializeOwnerRestaurant(
        await patchOwnerRestaurant(connection, req.auth, req.body)) });
  });

  router.get('/categories', async (req, res) => {
    res.json(await listOwnerCategories(connection, req.auth, req.query));
  });

  router.get('/categories/:id', async (req, res) => {
    res.json({ category: serializeOwnerCategory(
      await getOwnerCategory(connection, req.auth, req.params.id)) });
  });

  const categoryJson = express.json({ limit: '8kb', strict: true });
  router.post('/categories', trustedMutationOrigin, requireOwnerCsrf, categoryJson,
    async (req, res) => {
      res.status(201).json({ category: serializeOwnerCategory(
        await createOwnerCategory(connection, req.auth, req.body)) });
    });

  router.patch('/categories/:id', trustedMutationOrigin, requireOwnerCsrf, categoryJson,
    async (req, res) => {
      res.json({ category: serializeOwnerCategory(
        await patchOwnerCategory(connection, req.auth, req.params.id, req.body)) });
    });

  router.delete('/categories/:id', trustedMutationOrigin, requireOwnerCsrf,
    async (req, res) => {
      await deleteOwnerCategory(connection, req.auth, req.params.id);
      res.status(204).end();
    });

  router.get('/products', async (req, res) => {
    res.json(await listOwnerProducts(connection, req.auth, req.query));
  });

  router.get('/products/:id', async (req, res) => {
    res.json({ product: serializeOwnerProduct(
      await getOwnerProduct(connection, req.auth, req.params.id)) });
  });

  const productJson = express.json({ limit: '16kb', strict: true });
  router.post('/products', trustedMutationOrigin, requireOwnerCsrf, productJson,
    async (req, res) => {
      res.status(201).json({ product: serializeOwnerProduct(
        await createOwnerProduct(connection, req.auth, req.body)) });
    });

  router.patch('/products/:id', trustedMutationOrigin, requireOwnerCsrf, productJson,
    async (req, res) => {
      res.json({ product: serializeOwnerProduct(
        await patchOwnerProduct(connection, req.auth, req.params.id, req.body)) });
    });

  router.delete('/products/:id', trustedMutationOrigin, requireOwnerCsrf,
    async (req, res) => {
      await deleteOwnerProduct(connection, req.auth, req.params.id);
      if (mediaStorage) {
        try { await cleanupRetiredMedia(connection, mediaStorage, req.auth.restaurantId); }
        catch { /* A tombstone remains for reconciliation. */ }
      }
      res.status(204).end();
    });

  const mediaBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' });
  router.get('/media/capabilities', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!mediaStorage) return res.json({ available: false });
    try {
      const model = connection.models.MediaAsset ?? connection.model('MediaAsset', MediaAssetSchema.schema);
      await requireMediaIndexes(model);
      return res.json({ available: true });
    } catch { return res.json({ available: false }); }
  });
  const requireMediaStorage = (_req, res, next) => mediaStorage ? next() :
    res.status(503).json({ error: 'Media storage is not configured' });
  router.put('/media/products/:id', trustedMutationOrigin, requireOwnerCsrf,
    requireMediaStorage, mediaBody, async (req, res) => {
      res.json(await replaceOwnerImage(connection, req.auth, mediaStorage,
        'product', req.params.id, req.body, req.get('Content-Type')));
    });
  router.delete('/media/products/:id', trustedMutationOrigin, requireOwnerCsrf,
    requireMediaStorage, async (req, res) => {
      await deleteOwnerImage(connection, req.auth, mediaStorage, 'product', req.params.id);
      res.status(204).end();
    });
  router.put('/media/products/:id/images', trustedMutationOrigin, requireOwnerCsrf,
    requireMediaStorage, mediaBody, async (req, res) => {
      res.json(await replaceOwnerImage(connection, req.auth, mediaStorage,
        'gallery', req.params.id, req.body, req.get('Content-Type')));
    });
  router.delete('/media/products/:id/images/:assetId', trustedMutationOrigin, requireOwnerCsrf,
    requireMediaStorage, async (req, res) => {
      await deleteOwnerImage(connection, req.auth, mediaStorage, 'gallery',
        req.params.id, req.params.assetId);
      res.status(204).end();
    });
  router.put('/media/logo', trustedMutationOrigin, requireOwnerCsrf,
    requireMediaStorage, mediaBody, async (req, res) => {
      res.json(await replaceOwnerImage(connection, req.auth, mediaStorage,
        'logo', req.auth.restaurantId, req.body, req.get('Content-Type')));
    });
  router.delete('/media/logo', trustedMutationOrigin, requireOwnerCsrf,
    requireMediaStorage, async (req, res) => {
      await deleteOwnerImage(connection, req.auth, mediaStorage, 'logo', req.auth.restaurantId);
      res.status(204).end();
    });

  router.get('/orders', async (req, res) => {
    if (req.originalUrl.length > 2048) {
      return res.status(414).json({ error: 'URI too long' });
    }
    return res.json(await listOwnerOrders(connection, req.auth, req.query));
  });

  router.get('/orders/:id', async (req, res) => {
    res.json({ order: await getOwnerOrder(connection, req.auth, req.params.id) });
  });

  router.patch('/orders/:id/status', trustedMutationOrigin, requireOwnerCsrf,
    express.json({ limit: '1kb', strict: true }), async (req, res) => {
      res.json({ order: await patchOwnerOrderStatus(connection, req.auth,
        req.params.id, req.body) });
    });

  const analytics = {
    overview: (auth, period) => ownerOverview(connection, auth, period),
    trends: (auth, period) => ownerTrends(connection, auth, period),
    'top-products': (auth, period, options) =>
      ownerTopProducts(connection, auth, period, options),
    breakdowns: (auth, period) => ownerBreakdowns(connection, auth, period),
    activity: (auth, period) => ownerActivity(connection, auth, period),
  };
  for (const [endpoint, handler] of Object.entries(analytics)) {
    router.get(`/stats/${endpoint}`, async (req, res) => {
      if (req.originalUrl.length > 2048) {
        return res.status(414).json({ error: 'URI too long' });
      }
      const { period, ...options } = parseAnalyticsQuery(req.query, endpoint);
      return res.json(await handler(req.auth, period, options));
    });
  }

  return router;
}
