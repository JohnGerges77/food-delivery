import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { checkManifest } from '../src/cli/beta-bootstrap-dry-run.js';
import { ensureModelIndexes } from '../src/cli/check-indexes.js';
import {
  assertBetaIdentity, assertBetaStructure, assertDemoCounts, assertDemoMenu, assertDemoUri, demoPlan,
} from '../src/cli/provision-beta-demo.js';
import { parseCategoryInput } from '../src/services/ownerCategories.js';
import { parseProductInput } from '../src/services/ownerProducts.js';
import { serializePublicCategory, serializePublicProduct } from '../src/services/publicMenu.js';

const collections = checkManifest(JSON.parse(await readFile(
  new URL('../../docs/public-beta-index-manifest.json', import.meta.url), 'utf8')));

test('demo URI rejects other databases, users, hosts and insecure options without disclosing input', () => {
  const base = 'mongodb+srv://savora_beta_user:placeholder@cluster.mongodb.net/';
  assert.doesNotThrow(() => assertDemoUri(base + 'savora_beta?retryWrites=true&w=majority'));
  for (const uri of [
    base + 'savora_dev', base + 'savora_test', base + 'savora_staging',
    base + 'savora_beta?tls=false', base + 'savora_beta?dbName=savora_staging',
    base.replace('savora_beta_user', 'other_user') + 'savora_beta',
    base.replace('cluster.mongodb.net', 'cluster.example.org') + 'savora_beta',
  ]) {
    assert.throws(() => assertDemoUri(uri), (error) =>
      /dedicated TLS Atlas URI/.test(error.message) && !error.message.includes('placeholder'));
  }
});

test('demo identity uses the connected database and actual authenticated user', async () => {
  const user = { user: 'savora_beta_user', db: 'admin' };
  const connection = {
    name: 'savora_beta',
    db: {
      databaseName: 'savora_beta',
      admin: () => ({ command: async (input) => {
        assert.deepEqual(input, { connectionStatus: 1 });
        return { authInfo: { authenticatedUsers: [user] } };
      } }),
    },
  };
  await assertBetaIdentity(connection);
  user.user = 'savora_staging_user';
  await assert.rejects(assertBetaIdentity(connection), /Authenticated user/);
  connection.db.databaseName = 'savora_dev';
  await assert.rejects(assertBetaIdentity(connection), /Connected database/);
});

function fakeDatabase() {
  const names = collections.map(({ collection }) => ({ name: collection, type: 'collection' }));
  const indexes = Object.fromEntries(collections.map(({ collection, indexes }) => [
    collection,
    [{ name: '_id_', key: { _id: 1 } }, ...indexes.map(({ key, options }) => ({ key, ...options }))],
  ]));
  const db = {
    listCollections: () => ({ toArray: async () => names }),
    collection: (name) => ({ listIndexes: () => ({ toArray: async () => indexes[name] }) }),
  };
  return { db, names, indexes };
}

test('demo demands the complete collection and index manifest, including Admin uniqueness', async () => {
  const { db, names, indexes } = fakeDatabase();
  assert.equal(collections.length, 9);
  assert.equal(collections.flatMap(({ indexes }) => indexes).length, 20);
  await assertBetaStructure(db, collections);
  names.push({ name: 'unexpected', type: 'collection' });
  await assert.rejects(assertBetaStructure(db, collections), /collection list/);
  names.pop();
  const slot = indexes.platformadmins.find(({ key }) => key.bootstrapSlot === 1);
  slot.unique = false;
  await assert.rejects(assertBetaStructure(db, collections), /index mismatch in platformadmins/);
  slot.unique = true;
  indexes.products.pop();
  await assert.rejects(assertBetaStructure(db, collections), /index mismatch in products/);
});

test('demo retries reject partial and already seeded databases using bounded, session-aware counts', async () => {
  const counts = demoPlan().expectedCounts;
  const empty = Object.fromEntries(Object.keys(counts).map((name) => [name, 0]));
  const session = {};
  const stored = { ...empty };
  const db = {
    collection: (name) => ({
      countDocuments: async (filter, options) => {
        assert.deepEqual(filter, {});
        assert.equal(options.session, session);
        assert.ok(options.limit > 0);
        return Math.min(options.limit, stored[name]);
      },
    }),
  };
  await assertDemoCounts(db, empty, session);
  stored.platformadmins = 1;
  await assert.rejects(assertDemoCounts(db, empty, session), /platformadmins/);
  Object.assign(stored, counts);
  await assertDemoCounts(db, counts, session);
  await assert.rejects(assertDemoCounts(db, empty, session), /restaurants/);
  stored.orders = 1;
  await assert.rejects(assertDemoCounts(db, counts, session), /orders/);
});

test('beta services inspect indexes without DDL even during local provisioning', async () => {
  const { db } = fakeDatabase();
  const schema = mongoose.models.PlatformAdmin.schema;
  await ensureModelIndexes({
    db: { name: 'savora_beta' }, schema, collection: db.collection('platformadmins'),
    createIndexes: () => assert.fail('beta DDL is forbidden'),
  });
});

test('demo rows pass owner validators and the public menu preserves both variant and ordinary products', async () => {
  const plan = demoPlan();
  const restaurantId = new mongoose.Types.ObjectId();
  const catalog = [];
  for (const input of plan.categories) {
    const category = new mongoose.models.Category({ restaurantId, ...parseCategoryInput(input, { create: true }) });
    await category.validate();
    catalog.push(serializePublicCategory(category));
  }
  const menu = [];
  for (const { categorySlug, ...input } of plan.products) {
    const categoryId = catalog.find(({ slug }) => slug === categorySlug).id;
    const product = new mongoose.models.Product({ restaurantId,
      ...parseProductInput({ ...input, categoryId }, { create: true, currency: 'EGP' }) });
    await product.validate();
    menu.push(serializePublicProduct(product));
  }
  assertDemoMenu(catalog, menu);
  const fries = menu.find(({ slug }) => slug === 'french-fries');
  assert.equal(fries.categoryId, catalog.find(({ slug }) => slug === 'sides').id);
  assert.deepEqual(menu.map(({ startingPrice, variants }) =>
    [startingPrice, variants.map(({ price }) => price)]), [[150, [150, 200, 270]], [150, [150, 210]], [60, []]]);
  menu[1].variants[1].price = 211;
  assert.throws(() => assertDemoMenu(catalog, menu), /cheese-burger/);
});
