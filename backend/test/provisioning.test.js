import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { hashPassword, validatePassword, verifyPassword } from '../src/security/password.js';
import { provisionRestaurantOwner, ProvisioningError } from '../src/services/provisionRestaurantOwner.js';
import { askHidden, validateDevUri } from '../src/cli/provision-owner.js';

test('password length errors never include the supplied value', async () => {
  for (const password of ['shortsecret', 'x'.repeat(129), ' '.repeat(12)]) {
    assert.throws(() => validatePassword(password), (error) =>
      !error.message.includes(password) && !error.stack.includes(password));
    await assert.rejects(hashPassword(password), (error) =>
      !error.message.includes(password) && !error.stack.includes(password));
  }
});

test('Argon2id utility verifies the correct password and rejects another', async () => {
  const password = 'An offline test password 123!';
  const hash = await hashPassword(password);
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('Another offline password 123!', hash), false);
});

test('provisioning rejects unexpected fields before a database connection', async () => {
  await assert.rejects(provisionRestaurantOwner({
    restaurant: { name: 'Name', slug: 'slug', currency: 'EGP', status: 'active' },
    owner: { name: 'Owner', email: 'owner@example.test' },
    password: 'Long test password 123!',
  }), (error) => error instanceof ProvisioningError && error.code === 'INVALID_INPUT');
});

test('provisioning rejects invalid passwords before a database connection', async () => {
  for (const password of ['shortsecret', 'x'.repeat(129), ' '.repeat(12)]) {
    await assert.rejects(provisionRestaurantOwner({
      restaurant: { name: 'Name', slug: 'slug', currency: 'EGP' },
      owner: { name: 'Owner', email: 'owner@example.test' },
      password,
    }), (error) => error instanceof ProvisioningError && error.code === 'INVALID_PASSWORD');
  }
});

test('development CLI URI guard requires an independently configured Atlas hostname', () => {
  const uri = 'mongodb+srv://savora_dev_user:secret@cluster0.abcde.mongodb.net/savora_dev';
  assert.throws(() => validateDevUri(uri, null), /SAVORA_DEV_ATLAS_HOSTNAME/);
  assert.throws(() => validateDevUri(uri, 'localhost'), /SAVORA_DEV_ATLAS_HOSTNAME/);
  assert.throws(() => validateDevUri(uri, 'mongodb+srv://cluster0.abcde.mongodb.net'),
    /SAVORA_DEV_ATLAS_HOSTNAME/);
  assert.equal(validateDevUri(uri, 'cluster0.abcde.mongodb.net'), uri);
});

test('development CLI URI guard refuses another hostname, user, database, and dbName override', () => {
  const host = 'cluster0.abcde.mongodb.net';
  const good = `mongodb+srv://savora_dev_user:secret@${host}/savora_dev`;
  for (const uri of [
    'mongodb+srv://savora_dev_user:secret@cluster1.abcde.mongodb.net/savora_dev',
    `mongodb+srv://savora_test_user:secret@${host}/savora_dev`,
    `mongodb+srv://savora_dev_user:secret@${host}/savora_test`,
    `${good}?dbName=other`,
    `${good}?DBNAME=other`,
  ]) {
    assert.throws(() => validateDevUri(uri, host), (error) =>
      !error.message.includes('secret') && !error.stack.includes('secret'));
  }
});

test('hidden password entry restores terminal state and never echoes on cancellation', async () => {
  const input = new PassThrough();
  input.pause();
  input.isRaw = false;
  input.setRawMode = (raw) => { input.isRaw = raw; };
  const output = { text: '', write(value) { this.text += value; } };
  const result = askHidden('Password (hidden): ', input, output);
  input.emit('keypress', 'secret-password', { name: 's' });
  input.emit('keypress', '\u0003', { name: 'c', ctrl: true });
  await assert.rejects(result, /Cancelled/);
  assert.equal(input.isRaw, false);
  assert.equal(input.isPaused(), true);
  assert.equal(input.listenerCount('keypress'), 0);
  assert.equal(output.text, 'Password (hidden): \n');
});

test('hidden password entry restores terminal state when setup fails', async () => {
  const input = new PassThrough();
  input.pause();
  input.isRaw = false;
  input.setRawMode = (raw) => { input.isRaw = raw; };
  const output = { write() { throw new Error('Output failed'); } };
  await assert.rejects(askHidden('Password (hidden): ', input, output), /Output failed/);
  assert.equal(input.isRaw, false);
  assert.equal(input.isPaused(), true);
  assert.equal(input.listenerCount('keypress'), 0);
});
