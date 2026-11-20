import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { demoPlan } from '../src/cli/provision-beta-demo.js';
import { bootstrapPlatformAdmin } from '../src/services/platformAdminAuth.js';
import { createPlatformRestaurant } from '../src/services/platformRestaurants.js';
import { authenticateOwner, loginOwner, logoutOwner } from '../src/services/ownerAuth.js';
import { createOwnerCategory } from '../src/services/ownerCategories.js';
import { createOwnerProduct } from '../src/services/ownerProducts.js';
import { patchOwnerRestaurant } from '../src/services/restaurantSettings.js';

function testUri() {
  try {
    const uri = new URL(process.env.MONGODB_TEST_URI);
    const supportedTarget = uri.protocol === 'mongodb+srv:' ||
      (uri.protocol === 'mongodb:' && uri.hostname === '127.0.0.1');
    if (supportedTarget && uri.pathname === '/savora_test' &&
        decodeURIComponent(uri.username) === 'savora_test_user' &&
        ![...uri.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname')) {
      return process.env.MONGODB_TEST_URI;
    }
  } catch {}
  throw new Error('Dedicated savora_test Atlas or loopback URI required');
}

function connect() {
  return mongoose.createConnection(testUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
}

async function verifyTarget(connection) {
  await connection.asPromise();
  assert.equal(connection.db.databaseName, 'savora_test');
  const users = (await connection.db.admin().command({ connectionStatus: 1 })).authInfo.authenticatedUsers;
  assert.equal(users.length === 1 && users[0].user === 'savora_test_user', true);
}

test('provisioning services share one transaction and abort all exact fixture IDs', async () => {
  assert.equal(process.versions.node.split('.')[0], '24');
  assert.equal(process.env.VERCEL_ENV, 'production', 'Use the production read-only index mode');
  const connection = connect();
  const rollback = new Error('Intentional rollback for test fixtures');
  const ids = [];
  try {
    await verifyTarget(connection);
    const plan = demoPlan();
    const suffix = randomUUID();
    const ownerEmail = 'owner-' + suffix + '@example.test';
    const ownerPassword = randomUUID();
    const { deliverySettings, ...restaurant } = plan.restaurant;
    restaurant.slug = 'it-beta-demo-' + suffix;
    await assert.rejects(connection.transaction(async (session) => {
      const options = { session };
      const admin = await bootstrapPlatformAdmin(connection, 'admin-' + suffix + '@example.test',
        randomUUID(), options);
      ids.push(['platformadmins', admin._id]);
      const created = await createPlatformRestaurant(connection, admin._id, {
        restaurant, owner: { name: plan.accounts.owner, email: ownerEmail, password: ownerPassword },
      }, options);
      ids.push(['restaurants', new mongoose.Types.ObjectId(created.id)],
        ['users', new mongoose.Types.ObjectId(created.owner.id)]);
      const audit = await connection.db.collection('platformaudits').findOne({
        adminId: admin._id, restaurantId: new mongoose.Types.ObjectId(created.id),
      }, { session, projection: { _id: 1 } });
      assert.ok(audit);
      ids.push(['platformaudits', audit._id]);
      const login = await loginOwner(connection, ownerEmail, ownerPassword, options);
      assert.ok(login);
      const auth = await authenticateOwner(connection, login.sessionToken, options);
      assert.equal(String(auth?.restaurantId), created.id);
      ids.push(['ownersessions', auth.sessionId]);
      const settings = await patchOwnerRestaurant(connection, auth, { deliverySettings }, options);
      assert.equal(settings.deliverySettings.deliveryAvailable, false);
      const category = await createOwnerCategory(connection, auth, plan.categories[0], options);
      ids.push(['categories', category._id]);
      const { categorySlug, ...product } = plan.products[0];
      assert.equal(categorySlug, category.slug);
      const saved = await createOwnerProduct(connection, auth, {
        ...product, categoryId: String(category._id),
      }, options);
      ids.push(['products', saved._id]);
      assert.deepEqual(saved.variants.map(({ price }) => price), [150, 200, 270]);
      await logoutOwner(connection, auth.sessionId, options);
      assert.equal(await connection.db.collection('ownersessions')
        .countDocuments({ _id: auth.sessionId }, options), 0);
      throw rollback;
    }), (error) => error === rollback);
  } finally {
    await connection.close();
    if (ids.length) {
      const independent = connect();
      try {
        await verifyTarget(independent);
        for (const [collection, _id] of ids) {
          assert.equal(await independent.db.collection(collection).countDocuments({ _id }), 0, collection);
        }
      } finally { await independent.close(); }
    }
  }
});
