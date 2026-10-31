import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import { provisionRestaurantOwner, ProvisioningError } from '../src/services/provisionRestaurantOwner.js';
import { verifyPassword } from '../src/security/password.js';

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  let parsed;
  try {
    parsed = new URL(value);
    assert.ok(['mongodb:', 'mongodb+srv:'].includes(parsed.protocol));
    assert.equal(decodeURIComponent(parsed.username), 'savora_test_user');
    assert.equal(parsed.pathname, '/savora_test');
    assert.equal([...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'), false);
  } catch {
    throw new Error('MONGODB_TEST_URI failed test database safety checks');
  }
  return value;
}

function data(suffix, overrides = {}) {
  return {
    restaurant: { name: 'Integration Restaurant', slug: `it-provision-${suffix}`, currency: ' egp ' },
    owner: { name: 'Integration Owner', email: `it-${suffix}@example.test` },
    password: 'This is a long test password 123!',
    ...overrides,
  };
}

function fixtureTracker(Restaurant, User) {
  const restaurantIds = [];
  const userIds = [];
  return {
    record(result) {
      restaurantIds.push(result.restaurantId);
      userIds.push(result.ownerId);
    },
    async cleanup() {
      for (const _id of userIds) await User.deleteOne({ _id });
      for (const _id of restaurantIds) await Restaurant.deleteOne({ _id });
      assert.equal(await User.countDocuments({ _id: { $in: userIds } }), 0);
      assert.equal(await Restaurant.countDocuments({ _id: { $in: restaurantIds } }), 0);
    },
  };
}

test('transactional Restaurant and Owner provisioning on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Integration tests require Node 24');
  const uri = validatedTestUri();
  const connection = mongoose.createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    await Restaurant.createIndexes();
    await User.createIndexes();

    await t.test('creates both documents and stores only a verifiable Argon2id hash', async () => {
      const fixtures = fixtureTracker(Restaurant, User);
      const suffix = randomUUID().replaceAll('-', '');
      const input = data(suffix, {
        restaurant: { name: '  Integration Restaurant  ', slug: `  IT-PROVISION-${suffix}  `,
          currency: ' egp ' },
        owner: { name: '  Integration Owner  ', email: `  IT-${suffix}@EXAMPLE.TEST  ` },
      });
      try {
        const result = await provisionRestaurantOwner(input, { connection });
        fixtures.record(result);
        assert.equal(result.slug, `it-provision-${suffix}`);
        assert.equal(result.ownerEmail, `it-${suffix}@example.test`);
        const restaurant = await Restaurant.findById(result.restaurantId);
        const owner = await User.findById(result.ownerId).select('+passwordHash');
        assert.equal(restaurant.name, 'Integration Restaurant');
        assert.equal(restaurant.currency, 'EGP');
        assert.equal(owner.name, 'Integration Owner');
        assert.equal(String(owner.restaurantId), String(restaurant._id));
        assert.equal(owner.role, 'owner');
        assert.match(owner.passwordHash, /^\$argon2id\$/);
        assert.notEqual(owner.passwordHash, input.password);
        assert.equal(await verifyPassword(input.password, owner.passwordHash), true);
        assert.equal(await verifyPassword('Wrong long password 123!', owner.passwordHash), false);
        assert.equal(owner.toJSON().passwordHash, undefined);
        assert.equal((await User.findById(owner._id)).passwordHash, undefined);
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('rejects duplicate slug without creating a second owner', async () => {
      const fixtures = fixtureTracker(Restaurant, User);
      const suffix = randomUUID().replaceAll('-', '');
      try {
        const first = await provisionRestaurantOwner(data(suffix), { connection });
        fixtures.record(first);
        const otherEmail = `other-${suffix}@example.test`;
        await assert.rejects(
          provisionRestaurantOwner(data(suffix, {
            owner: { name: 'Other Owner', email: otherEmail },
          }), { connection }),
          (error) => error instanceof ProvisioningError && error.code === 'DUPLICATE_SLUG',
        );
        assert.equal(await User.countDocuments({ email: otherEmail }), 0);
        assert.equal(await Restaurant.countDocuments({ slug: first.slug }), 1);
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('duplicate email aborts the transaction after restaurant insertion', async () => {
      const fixtures = fixtureTracker(Restaurant, User);
      const suffix = randomUUID().replaceAll('-', '');
      const secondSlug = `it-provision-other-${suffix}`;
      try {
        const first = await provisionRestaurantOwner(data(suffix), { connection });
        fixtures.record(first);
        await assert.rejects(
          provisionRestaurantOwner(data(suffix, {
            restaurant: { name: 'Other Restaurant', slug: secondSlug, currency: 'EGP' },
          }), { connection }),
          (error) => error instanceof ProvisioningError && error.code === 'DUPLICATE_EMAIL',
        );
        assert.equal(await Restaurant.countDocuments({ slug: secondSlug }), 0);
        assert.equal(await User.countDocuments({ email: first.ownerEmail }), 1);
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('the partial unique index still permits only one owner per restaurant', async () => {
      const fixtures = fixtureTracker(Restaurant, User);
      const suffix = randomUUID().replaceAll('-', '');
      const attemptedId = new mongoose.Types.ObjectId();
      try {
        const first = await provisionRestaurantOwner(data(suffix), { connection });
        fixtures.record(first);
        const existing = await User.findById(first.ownerId).select('+passwordHash');
        await assert.rejects(User.create({
          _id: attemptedId,
          restaurantId: first.restaurantId,
          name: 'Second Owner',
          email: `second-${suffix}@example.test`,
          passwordHash: existing.passwordHash,
        }), (error) => error.code === 11000);
        assert.equal(await User.countDocuments({ restaurantId: first.restaurantId }), 1);
      } finally {
        await User.deleteOne({ _id: attemptedId });
        await fixtures.cleanup();
      }
    });
  } finally {
    await connection.close();
  }
});
