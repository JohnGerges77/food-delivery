import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { provisionRestaurantOwner, ProvisioningError } from '../services/provisionRestaurantOwner.js';
import { validatePassword } from '../security/password.js';

export function validateDevUri(value, expectedHostname = process.env.SAVORA_DEV_ATLAS_HOSTNAME) {
  if (typeof expectedHostname !== 'string' ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.mongodb\.net$/i.test(expectedHostname)) {
    throw new Error('SAVORA_DEV_ATLAS_HOSTNAME must be an Atlas cluster hostname');
  }
  if (typeof value !== 'string' || !value) throw new Error('MONGODB_URI is required');
  let parsed;
  try {
    parsed = new URL(value);
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
        parsed.hostname !== expectedHostname.toLowerCase() ||
        decodeURIComponent(parsed.username) !== 'savora_dev_user' ||
        parsed.pathname !== '/savora_dev' ||
        [...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname')) {
      throw new Error();
    }
  } catch {
    throw new Error('MONGODB_URI must target the configured Atlas cluster, savora_dev, and the expected user');
  }
  return value;
}

async function askFields() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return {
      restaurant: {
        name: await prompt.question('Restaurant name: '),
        slug: await prompt.question('Restaurant slug: '),
        currency: await prompt.question('Currency code: '),
      },
      owner: {
        name: await prompt.question('Owner name: '),
        email: await prompt.question('Owner email: '),
      },
    };
  } finally {
    prompt.close();
  }
}

export function askHidden(label, input = process.stdin, output = process.stdout) {
  return new Promise((resolvePassword, reject) => {
    let value = '';
    let finished = false;
    const wasRaw = input.isRaw === true;
    const wasPaused = input.isPaused();

    function finish(error) {
      if (finished) return;
      finished = true;
      input.off('keypress', onKeypress);
      input.off('error', onError);
      input.off('end', onCancel);
      input.off('close', onCancel);
      process.off('SIGINT', onCancel);
      try { input.setRawMode(wasRaw); } catch (cleanupError) { error ??= cleanupError; }
      try { if (wasPaused) input.pause(); } catch (cleanupError) { error ??= cleanupError; }
      try { output.write('\n'); } catch (cleanupError) { error ??= cleanupError; }
      if (error) reject(error);
      else resolvePassword(value);
    }

    function onKeypress(character, key) {
      if (key?.ctrl && (key.name === 'c' || key.name === 'd')) return finish(new Error('Cancelled'));
      if (key?.name === 'return' || key?.name === 'enter') return finish();
      if (key?.name === 'backspace') value = value.slice(0, -1);
      else if (character && !key?.ctrl && !key?.meta) value += character;
    }

    function onError(error) { finish(error); }
    function onCancel() { finish(new Error('Cancelled')); }

    try {
      readline.emitKeypressEvents(input);
      input.on('keypress', onKeypress);
      input.on('error', onError);
      input.on('end', onCancel);
      input.on('close', onCancel);
      process.on('SIGINT', onCancel);
      input.setRawMode(true);
      output.write(label);
      input.resume();
    } catch (error) {
      finish(error);
    }
  });
}

async function askConfirmation() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question('Type PROVISION to create these records: ')) === 'PROVISION';
  } finally {
    prompt.close();
  }
}

async function run() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Node 24 is required');
  if (process.argv.length !== 2) throw new Error('This command does not accept arguments');
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('An interactive terminal is required');
  }
  const uri = validateDevUri(process.env.MONGODB_URI);
  const input = await askFields();
  input.password = await askHidden('Password (hidden): ');
  validatePassword(input.password);
  const confirmation = await askHidden('Confirm password (hidden): ');
  if (input.password !== confirmation) throw new Error('Passwords do not match');

  // Show only non-sensitive fields. The service applies the model setters again.
  console.log('\nProvisioning summary:');
  console.log(`Restaurant: ${input.restaurant.name.trim()}`);
  console.log(`Slug: ${input.restaurant.slug.trim().toLowerCase()}`);
  console.log(`Currency: ${input.restaurant.currency.trim().toUpperCase()}`);
  console.log(`Owner: ${input.owner.name.trim()}`);
  console.log(`Owner email: ${input.owner.email.trim().toLowerCase()}`);
  if (!(await askConfirmation())) {
    console.log('Cancelled.');
    return;
  }

  const connection = mongoose.createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    if (connection.name !== 'savora_dev' || connection.db.databaseName !== 'savora_dev') {
      throw new Error('Connected database is not savora_dev');
    }
    const result = await provisionRestaurantOwner(input, { connection });
    console.log(`Provisioned restaurant ${result.slug} and its owner.`);
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error instanceof ProvisioningError ? error.message : 'Provisioning failed or was cancelled');
    process.exitCode = 1;
  });
}
