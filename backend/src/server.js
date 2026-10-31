import 'dotenv/config';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

export function serverConfig(env = process.env) {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error('Node.js 24 is required');
  }
  const mongoUri = env.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error('MONGODB_URI is required');
  const allowedOrigins = env.AUTH_TRUSTED_ORIGINS?.trim();
  if (!allowedOrigins) throw new Error('AUTH_TRUSTED_ORIGINS is required');
  const port = env.PORT === undefined ? 5000 : Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }
  const trustProxyHops = env.TRUST_PROXY_HOPS === undefined ? 0 :
    Number(env.TRUST_PROXY_HOPS);
  if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0 ||
      trustProxyHops > 3) throw new Error('TRUST_PROXY_HOPS must be between 0 and 3');
  return { mongoUri, allowedOrigins, port,
    secureCookies: env.NODE_ENV === 'production', trustProxyHops };
}

export async function startServer({ env = process.env, connect = connectDB,
  makeApp = createApp } = {}) {
  const config = serverConfig(env);
  // Validate origin and cookie configuration before contacting MongoDB.
  const app = makeApp({ allowedOrigins: config.allowedOrigins,
    secureCookies: config.secureCookies, trustProxyHops: config.trustProxyHops });
  await connect(config.mongoUri);
  const server = app.listen(config.port);
  server.headersTimeout = 15_000;
  server.requestTimeout = 60_000;
  server.timeout = 60_000;
  try {
    await once(server, 'listening');
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
  return server;
}

if (import.meta.main) {
  let server;
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => {
      console.error('Shutdown timed out');
      process.exitCode = 1;
      server?.closeAllConnections();
    }, 10_000);
    timeout.unref();
    try {
      if (server) await new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      await mongoose.disconnect();
    } catch {
      console.error('Shutdown failed');
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
  }
  try {
    server = await startServer();
    console.log(`HTTP service listening on port ${server.address().port}`);
    server.on('error', () => {
      console.error('HTTP server error');
      process.exitCode = 1;
      void stop();
    });
    process.once('SIGINT', () => { void stop(); });
    process.once('SIGTERM', () => { void stop(); });
  } catch (error) {
    const message = error.code === 'EADDRINUSE' ? 'PORT is already in use' : error.message;
    console.error(`Startup failed: ${message}`);
    process.exitCode = 1;
  }
}
