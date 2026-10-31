import express from 'express';
import mongoose from 'mongoose';
import { createAuthRouter } from './routes/auth.js';
import { createOwnerRouter } from './routes/owner.js';
import { createPublicRouter } from './routes/public.js';
import { createAdminRouter } from './routes/admin.js';
import { AdminConflict, AdminNotFound, InvalidAdminInput } from './services/platformRestaurants.js';
import { OwnerResourceNotFound } from './services/ownerTenant.js';
import { InvalidRestaurantSettings } from './services/restaurantSettings.js';
import { CategoryConflict, InvalidCategoryInput } from './services/ownerCategories.js';
import { InvalidProductInput, ProductConflict } from './services/ownerProducts.js';
import { InvalidOrderInput, OrderStatusConflict } from './services/ownerOrders.js';
import { InvalidAnalyticsQuery } from './services/analyticsPeriod.js';
import { InvalidPublicRequest, PublicRestaurantNotFound } from './services/publicMenu.js';
import { CheckoutConflict, CheckoutUnavailable, InvalidCheckout } from './services/guestCheckout.js';

export function handleApiError(error, _req, res, _next) {
  if (error instanceof InvalidAdminInput) return res.status(400).json({ error: 'Invalid admin input' });
  if (error instanceof AdminConflict) return res.status(409).json({ error: error.message });
  if (error instanceof AdminNotFound) return res.status(404).json({ error: 'Not found' });
  if (error instanceof PublicRestaurantNotFound) return res.status(404).json({ error: 'Not found' });
  if (error instanceof InvalidPublicRequest) return res.status(400).json({ error: 'Invalid public request' });
  if (error instanceof InvalidCheckout) return res.status(400).json({ error: 'Invalid checkout' });
  if (error instanceof CheckoutConflict) return res.status(409).json({ error: 'Idempotency key conflict' });
  if (error instanceof CheckoutUnavailable) return res.status(409).json({ error: 'Checkout unavailable' });
  if (error instanceof OwnerResourceNotFound) return res.status(404).json({ error: 'Not found' });
  if (error instanceof InvalidRestaurantSettings) {
    return res.status(400).json({ error: 'Invalid restaurant settings' });
  }
  if (error instanceof InvalidCategoryInput) {
    return res.status(400).json({ error: 'Invalid category input' });
  }
  if (error instanceof CategoryConflict) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof InvalidProductInput) {
    return res.status(400).json({ error: 'Invalid product input' });
  }
  if (error instanceof InvalidOrderInput) {
    return res.status(400).json({ error: 'Invalid order input' });
  }
  if (error instanceof InvalidAnalyticsQuery) {
    return res.status(400).json({ error: 'Invalid analytics query' });
  }
  if (error instanceof OrderStatusConflict) {
    return res.status(409).json({ error: 'Order status conflict' });
  }
  if (error instanceof ProductConflict) {
    return res.status(409).json({ error: error.message });
  }
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  return res.status(503).json({ error: 'Service unavailable' });
}

export function createApp(options) {
  const app = express();
  const connection = options?.connection ?? mongoose.connection;
  app.disable('x-powered-by');
  app.set('trust proxy', options?.trustProxyHops ?? 0);
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api/auth', createAuthRouter(options));
  app.use('/api/admin', createAdminRouter(options));
  app.use('/api/owner', createOwnerRouter(options));
  app.use('/api/public', createPublicRouter(options));
  app.get('/api/health', (_req, res) => {
    if (connection.readyState !== 1) {
      return res.status(503).json({ status: 'unavailable' });
    }
    res.json({ status: 'ok', message: 'HTTP service is running' });
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(handleApiError);

  return app;
}

