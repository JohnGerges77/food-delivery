import express from 'express';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { inspectConnectionIndexes } from './cli/check-indexes.js';

const STAGING_BRANCH = 'codex/savora-staging-preview';

export function stagingConfig(env = process.env) {
  if (Number(process.versions.node.split('.')[0]) !== 24 ||
      env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== STAGING_BRANCH) {
    throw new Error('Staging requires the designated Node 24 Preview branch');
  }
  if (!/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '')) {
    throw new Error('A Vercel deployment URL is required');
  }
  const deploymentOrigin = `https://${env.VERCEL_URL}`;
  const branchUrl = env.VERCEL_BRANCH_URL;
  if (branchUrl && !/^[a-z0-9-]+-git-[a-z0-9-]+\.vercel\.app$/.test(branchUrl)) {
    throw new Error('A valid Vercel Preview branch URL is required');
  }
  const origins = new Set([deploymentOrigin]);
  if (branchUrl) origins.add(`https://${branchUrl}`);
  if (env.AUTH_TRUSTED_ORIGINS) {
    const configured = env.AUTH_TRUSTED_ORIGINS.split(',').map((origin) => origin.trim());
    if (configured.some((origin) => !origins.has(origin))) {
      throw new Error('Trusted Origin does not match this Preview deployment or branch');
    }
  }

  let uri;
  try { uri = new URL(env.MONGODB_URI); } catch {
    throw new Error('A dedicated staging MongoDB URI is required');
  }
  if (uri.protocol !== 'mongodb+srv:' || uri.pathname !== '/savora_staging' ||
      decodeURIComponent(uri.username) !== 'savora_staging_user' || !uri.password ||
      [...uri.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname')) {
    throw new Error('MongoDB URI must use the dedicated savora_staging database and user');
  }
  return { mongoUri: env.MONGODB_URI, allowedOrigins: [...origins].join(',') };
}

// Production is opt-in and uses an entirely separate database principal.
export function betaConfig(env = process.env) {
  if (Number(process.versions.node.split('.')[0]) !== 24 || env.VERCEL_ENV !== 'production' ||
      env.NODE_ENV !== 'production' || env.VERCEL_GIT_COMMIT_REF !== 'main' ||
      env.SAVORA_DEPLOYMENT_MODE !== 'beta') throw new Error('Explicit Node 24 main Production beta is required');
  if (!/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '')) throw new Error('Invalid deployment hostname');
  const hostname = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (typeof hostname !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname)) {
    throw new Error('A Production hostname is required');
  }
  const primary = 'https://' + hostname;
  // One canonical public hostname in beta; the protected deployment URL also supports pre-promotion QA.
  if (env.AUTH_TRUSTED_ORIGINS !== primary) throw new Error('Trusted Origin must equal the Production origin');
  if (env.MEDIA_STORAGE_PROVIDER || env.UPLOADS_DIR) throw new Error('Beta uploads must remain disabled');
  if (env.SAVORA_BETA_CHECKOUT_ENABLED !== undefined &&
      !['true', 'false'].includes(env.SAVORA_BETA_CHECKOUT_ENABLED)) throw new Error('Invalid beta checkout setting');
  let uri;
  try { uri = new URL(env.MONGODB_URI); } catch { throw new Error('A dedicated beta MongoDB URI is required'); }
  if (uri.protocol !== 'mongodb+srv:' || uri.pathname !== '/savora_beta' ||
      decodeURIComponent(uri.username) !== 'savora_beta_user' || !uri.password || !uri.hostname || uri.hash) {
    throw new Error('Beta requires the dedicated savora_beta database and user');
  }
  const seen = new Set();
  for (const [name, value] of uri.searchParams) {
    const key = name.toLowerCase();
    if (seen.has(key) || !['retrywrites', 'w', 'appname', 'authsource', 'tls'].includes(key) ||
        (key === 'retrywrites' && value !== 'true') || (key === 'w' && value !== 'majority') ||
        (key === 'tls' && value !== 'true') ||
        (key === 'authsource' && !['admin', 'savora_beta'].includes(value))) throw new Error('Unsafe beta URI options');
    seen.add(key);
  }
  return { mongoUri: env.MONGODB_URI, databaseName: 'savora_beta',
    allowedOrigins: [...new Set([primary, 'https://' + env.VERCEL_URL])].join(','),
    checkoutEnabled: env.SAVORA_BETA_CHECKOUT_ENABLED === 'true' };
}

export function vercelConfig(env = process.env) {
  if (env.VERCEL_ENV === 'production') return betaConfig(env);
  if (env.SAVORA_DEPLOYMENT_MODE && env.SAVORA_DEPLOYMENT_MODE !== 'staging') {
    throw new Error('Preview cannot select beta');
  }
  return { ...stagingConfig(env), databaseName: 'savora_staging', checkoutEnabled: true };
}

export function createVercelEntry({ env = process.env, connection = mongoose.connection,
  connect = connectDB, disconnect = () => mongoose.disconnect(), makeApp = createApp,
  checkIndexes = inspectConnectionIndexes } = {}) {
  const entry = express();
  entry.disable('x-powered-by');
  let app;
  let connecting;
  let inspecting;
  let checkedDatabase;
  entry.use(async (req, res) => {
    try {
      const config = vercelConfig(env);
      const verifyDatabase = () => {
        if (connection.readyState !== 1 || connection.db?.databaseName !== config.databaseName) {
          throw new Error('Connected to the wrong database');
        }
      };
      if (connection.readyState === 1) verifyDatabase();
      else {
        connecting ??= connect(config.mongoUri, { maxPoolSize: 5,
          autoIndex: false, autoCreate: false })
          .then(verifyDatabase).catch(async (error) => {
            await disconnect();
            throw error;
          }).finally(() => { connecting = undefined; });
        await connecting;
      }
      verifyDatabase();
      if (config.databaseName === 'savora_beta' && checkedDatabase !== connection.db) {
        const database = connection.db;
        inspecting ??= checkIndexes(connection).then(findings => {
          verifyDatabase();
          if (findings.length || connection.db !== database) throw new Error('Beta indexes require review');
          checkedDatabase = database;
        }).finally(() => { inspecting = undefined; });
        await inspecting;
      }
      verifyDatabase();
      app ??= makeApp({ connection, env, allowedOrigins: config.allowedOrigins,
        secureCookies: true, trustProxyHops: 0, mediaStorage: null,
        checkoutEnabled: config.checkoutEnabled,
        ...(config.databaseName === 'savora_beta' ? {
          checkoutAllowedOrigins: config.allowedOrigins.split(','), checkoutLimit: 10,
          betaCheckout: true } : {}) });
      app(req, res);
    } catch {
      res.status(503).json({ error: 'Service unavailable' });
    }
  });
  return entry;
}

export default createVercelEntry();
