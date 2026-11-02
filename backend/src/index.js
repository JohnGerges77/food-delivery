import express from 'express';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

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

const entry = express();
let app;
let connecting;

entry.use(async (req, res, next) => {
  try {
    const config = stagingConfig();
    app ??= createApp({ allowedOrigins: config.allowedOrigins,
      secureCookies: true, trustProxyHops: 0 });
    if (mongoose.connection.readyState === 1 &&
        mongoose.connection.db?.databaseName !== 'savora_staging') {
      throw new Error('Connected to the wrong database');
    }
    if (mongoose.connection.readyState !== 1) {
      connecting ??= connectDB(config.mongoUri, { maxPoolSize: 5 })
        .then(() => {
          if (mongoose.connection.db?.databaseName !== 'savora_staging') {
            throw new Error('Connected to the wrong database');
          }
        }).catch(async (error) => {
          await mongoose.disconnect();
          throw error;
        }).finally(() => { connecting = undefined; });
      await connecting;
    }
    app(req, res, next);
  } catch {
    res.status(503).json({ error: 'Service unavailable' });
  }
});

export default entry;
