import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { askHidden } from './provision-owner.js';
import { bootstrapPlatformAdmin } from '../services/platformAdminAuth.js';
import { validatePassword } from '../security/password.js';

export function validateBootstrapTarget(uri, expectedDatabase) {
  if (typeof expectedDatabase !== 'string' || !/^savora_[a-z0-9_]+$/.test(expectedDatabase) ||
      typeof uri !== 'string') throw new Error('Explicit bootstrap database is required');
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error('Invalid MongoDB target'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
      parsed.pathname !== `/${expectedDatabase}` || !parsed.username ||
      [...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname') ||
      (expectedDatabase === 'savora_test' &&
        decodeURIComponent(parsed.username) !== 'savora_test_user') ||
      (expectedDatabase === 'savora_dev' &&
        decodeURIComponent(parsed.username) !== 'savora_dev_user')) {
    throw new Error('MongoDB target does not match bootstrap database');
  }
  return uri;
}

async function run() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Node 24 is required');
  if (process.argv.length !== 2) throw new Error('No command arguments are accepted');
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('An interactive terminal is required');
  }
  const expected = process.env.ADMIN_BOOTSTRAP_DATABASE;
  const uri = validateBootstrapTarget(process.env.MONGODB_URI, expected);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let email;
  try { email = (await prompt.question('Platform Admin email: ')).trim().toLowerCase(); }
  finally { prompt.close(); }
  const password = await askHidden('Password (hidden): ');
  validatePassword(password);
  if (password !== await askHidden('Confirm password (hidden): ')) {
    throw new Error('Passwords do not match');
  }
  const confirm = await askHidden(`Type ${expected} to create the first Platform Admin: `);
  if (confirm !== expected) throw new Error('Cancelled');
  const connection = mongoose.createConnection(uri, { autoIndex: false,
    autoCreate: false, serverSelectionTimeoutMS: 10_000 });
  try {
    await connection.asPromise();
    if (connection.name !== expected || connection.db.databaseName !== expected) {
      throw new Error('Connected database mismatch');
    }
    await bootstrapPlatformAdmin(connection, email, password);
    console.log('Platform Admin created.');
  } finally { await connection.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(() => { console.error('Bootstrap failed or was cancelled'); process.exitCode = 1; });
}
