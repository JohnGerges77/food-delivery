import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
import OrderSchema from '../src/models/Order.js';

const databaseName = 'savora_test';
const testUsername = 'savora_test_user';

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('MONGODB_TEST_URI is not a valid MongoDB URI');
  }

  assert.ok(['mongodb:', 'mongodb+srv:'].includes(parsed.protocol), 'Unsafe test URI protocol');
  assert.equal(decodeURIComponent(parsed.username), testUsername, 'Unsafe test URI username');
  assert.equal(parsed.pathname, `/${databaseName}`, 'Unsafe test URI database path');
  assert.equal(parsed.searchParams.has('dbName'), false, 'Test URI may not override dbName');
  return value;
}

function fixtureScope(models) {
  const ids = new Map(models.map((model) => [model.modelName, []]));

  return {
    async create(model, values) {
      const _id = new mongoose.Types.ObjectId();
      ids.get(model.modelName).push(_id);
      return model.create({ _id, ...values });
    },
    async cleanup() {
      for (const model of [...models].reverse()) {
        for (const _id of ids.get(model.modelName)) {
          await model.deleteOne({ _id });
        }
        const modelIds = ids.get(model.modelName);
        if (modelIds.length > 0) {
          assert.equal(await model.countDocuments({ _id: { $in: modelIds } }), 0,
            `Fixture cleanup failed for ${model.modelName}`);
        }
      }
    },
  };
}

function uniqueSuffix() {
  return randomUUID().replaceAll('-', '');
}

async function expectDuplicate(write) {
  await assert.rejects(write, (error) => error.code === 11000);
}

function assertIndex(indexes, key, options = {}) {
  const index = indexes.find((candidate) =>
    JSON.stringify(candidate.key) === JSON.stringify(key));
  assert.ok(index, `Missing database index ${JSON.stringify(key)}`);
  assert.equal(index.unique, true);
  if (options.partialFilterExpression) {
    assert.deepEqual(index.partialFilterExpression, options.partialFilterExpression);
  }
}

test('MongoDB model integration on the isolated test database', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Integration tests require Node 24');
  // No connection or index creation happens until the complete URI check passes.
  const uri = validatedTestUri();
  const connection = mongoose.createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await connection.asPromise();
    assert.equal(connection.name, databaseName, 'Connected to an unexpected database');
    assert.equal(connection.db.databaseName, databaseName, 'Connected to an unexpected database');

    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const Category = connection.model('Category', CategorySchema.schema);
    const Product = connection.model('Product', ProductSchema.schema);
    const Order = connection.model('Order', OrderSchema.schema);
    const models = [Restaurant, User, Category, Product, Order];

    // createIndexes is intentional here: MongoDB, rather than schema metadata,
    // must enforce the constraints exercised below. No indexes are dropped.
    for (const model of models) await model.createIndexes();

    await t.test('unique indexes exist in MongoDB', async () => {
      assertIndex(await Restaurant.collection.listIndexes().toArray(), { slug: 1 });
      const userIndexes = await User.collection.listIndexes().toArray();
      assertIndex(userIndexes, { email: 1 });
      assertIndex(userIndexes, { restaurantId: 1 }, {
        partialFilterExpression: { role: 'owner' },
      });
      assertIndex(await Category.collection.listIndexes().toArray(), { restaurantId: 1, slug: 1 });
      assertIndex(await Product.collection.listIndexes().toArray(), { restaurantId: 1, slug: 1 });
      assertIndex(await Order.collection.listIndexes().toArray(), { restaurantId: 1, orderNumber: 1 });
    });

    await t.test('Restaurant persists updates and enforces global slug uniqueness', async () => {
      const fixtures = fixtureScope(models);
      const slug = `it-restaurant-${uniqueSuffix()}`;
      try {
        const first = await fixtures.create(Restaurant, { name: 'Integration A', slug, currency: 'EGP' });
        await expectDuplicate(() => fixtures.create(Restaurant, {
          name: 'Integration duplicate', slug, currency: 'EGP',
        }));
        await Restaurant.updateOne({ _id: first._id }, { $set: { name: 'Integration updated' } });
        const read = await Restaurant.findById(first._id);
        assert.equal(read.name, 'Integration updated');
        assert.equal(read.slug, slug);
        assert.ok(read.createdAt instanceof Date);
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('User persists updates, hides password hash, and enforces email and owner indexes', async () => {
      const fixtures = fixtureScope(models);
      const suffix = uniqueSuffix();
      try {
        const firstRestaurant = await fixtures.create(Restaurant, {
          name: 'Integration A', slug: `it-user-a-${suffix}`, currency: 'EGP',
        });
        const secondRestaurant = await fixtures.create(Restaurant, {
          name: 'Integration B', slug: `it-user-b-${suffix}`, currency: 'EGP',
        });
        const email = `it-${suffix}@example.test`;
        const hash = `test-hash-${suffix}`;
        const first = await fixtures.create(User, {
          restaurantId: firstRestaurant._id, name: 'Owner A', email, passwordHash: hash,
        });
        await expectDuplicate(() => fixtures.create(User, {
          restaurantId: secondRestaurant._id, name: 'Duplicate email', email, passwordHash: hash,
        }));
        await expectDuplicate(() => fixtures.create(User, {
          restaurantId: firstRestaurant._id, name: 'Duplicate owner',
          email: `other-${suffix}@example.test`, passwordHash: hash,
        }));
        await fixtures.create(User, {
          restaurantId: secondRestaurant._id, name: 'Owner B',
          email: `second-${suffix}@example.test`, passwordHash: hash,
        });
        await User.updateOne({ _id: first._id }, { $set: { name: 'Updated owner' } });
        const read = await User.findById(first._id);
        assert.equal(read.name, 'Updated owner');
        assert.equal(read.passwordHash, undefined);
        const selected = await User.findById(first._id).select('+passwordHash');
        assert.equal(selected.passwordHash, hash);
        assert.equal(selected.toJSON().passwordHash, undefined);
        assert.equal(selected.toObject().passwordHash, undefined);
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('Category persists updates and scopes unique slugs to a restaurant', async () => {
      const fixtures = fixtureScope(models);
      const suffix = uniqueSuffix();
      try {
        const firstRestaurant = await fixtures.create(Restaurant, {
          name: 'Integration A', slug: `it-category-a-${suffix}`, currency: 'EGP',
        });
        const secondRestaurant = await fixtures.create(Restaurant, {
          name: 'Integration B', slug: `it-category-b-${suffix}`, currency: 'EGP',
        });
        const slug = `menu-${suffix}`;
        const first = await fixtures.create(Category, {
          restaurantId: firstRestaurant._id, name: 'Menu', slug,
        });
        await expectDuplicate(() => fixtures.create(Category, {
          restaurantId: firstRestaurant._id, name: 'Duplicate', slug,
        }));
        await fixtures.create(Category, {
          restaurantId: secondRestaurant._id, name: 'Other tenant menu', slug,
        });
        await Category.updateOne({ _id: first._id }, { $set: { sortOrder: 3 } });
        const read = await Category.findById(first._id);
        assert.equal(read.sortOrder, 3);
        assert.equal(read.slug, slug);
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('Product persists updates and scopes unique slugs to a restaurant', async () => {
      const fixtures = fixtureScope(models);
      const suffix = uniqueSuffix();
      try {
        const restaurants = await Promise.all(['a', 'b'].map((letter) =>
          fixtures.create(Restaurant, {
            name: `Integration ${letter}`, slug: `it-product-${letter}-${suffix}`, currency: 'EGP',
          })));
        const categories = await Promise.all(restaurants.map((restaurant, index) =>
          fixtures.create(Category, {
            restaurantId: restaurant._id, name: 'Food', slug: `food-${suffix}-${index}`,
          })));
        const slug = `burger-${suffix}`;
        const first = await fixtures.create(Product, {
          restaurantId: restaurants[0]._id, categoryId: categories[0]._id,
          name: 'Burger', slug, price: 18.5,
        });
        await expectDuplicate(() => fixtures.create(Product, {
          restaurantId: restaurants[0]._id, categoryId: categories[0]._id,
          name: 'Duplicate burger', slug, price: 18.5,
        }));
        await fixtures.create(Product, {
          restaurantId: restaurants[1]._id, categoryId: categories[1]._id,
          name: 'Other tenant burger', slug, price: 18.5,
        });
        await Product.updateOne({ _id: first._id }, { $set: { price: 21.5 } });
        const read = await Product.findById(first._id);
        assert.equal(read.price, 21.5);
        assert.equal(String(read.categoryId), String(categories[0]._id));
      } finally {
        await fixtures.cleanup();
      }
    });

    await t.test('Order persists snapshots and amounts, hides tracking hash, and scopes order numbers', async () => {
      const fixtures = fixtureScope(models);
      const suffix = uniqueSuffix();
      try {
        const restaurants = await Promise.all(['a', 'b'].map((letter) =>
          fixtures.create(Restaurant, {
            name: `Integration ${letter}`, slug: `it-order-${letter}-${suffix}`, currency: 'EGP',
          })));
        const category = await fixtures.create(Category, {
          restaurantId: restaurants[0]._id, name: 'Food', slug: `food-${suffix}`,
        });
        const product = await fixtures.create(Product, {
          restaurantId: restaurants[0]._id, categoryId: category._id,
          name: 'Burger', slug: `burger-${suffix}`, price: 18.5,
        });
        const orderNumber = `IT-${suffix}`;
        const hash = `tracking-hash-${suffix}`;
        const orderData = (restaurantId) => ({
          restaurantId, orderNumber, customerName: 'Test Guest', customerPhone: '+201000000000',
          deliveryAddress: '12 Test Street', city: 'Cairo',
          items: [{ productId: product._id, name: 'Burger snapshot', unitPrice: 18.5,
            quantity: 2, notes: 'No onions' }],
          subtotal: 37, deliveryFee: 3.5, total: 40.5,
          submissionMethod: 'direct', trackingTokenHash: hash,
        });
        const first = await fixtures.create(Order, orderData(restaurants[0]._id));
        await expectDuplicate(() => fixtures.create(Order, orderData(restaurants[0]._id)));
        await fixtures.create(Order, orderData(restaurants[1]._id));
        await Order.updateOne({ _id: first._id }, { $set: { status: 'preparing' } });
        const read = await Order.findById(first._id);
        assert.equal(read.status, 'preparing');
        assert.equal(read.subtotal, 37);
        assert.equal(read.deliveryFee, 3.5);
        assert.equal(read.total, 40.5);
        assert.equal(read.items.length, 1);
        assert.equal(read.items[0].name, 'Burger snapshot');
        assert.equal(read.items[0].unitPrice, 18.5);
        assert.equal(read.items[0].quantity, 2);
        assert.equal(read.items[0].notes, 'No onions');
        assert.equal(read.items[0]._id, undefined);
        assert.equal(read.trackingTokenHash, undefined);
        const selected = await Order.findById(first._id).select('+trackingTokenHash');
        assert.equal(selected.trackingTokenHash, hash);
        assert.equal(selected.toJSON().trackingTokenHash, undefined);
        assert.equal(selected.toObject().trackingTokenHash, undefined);
      } finally {
        await fixtures.cleanup();
      }
    });
  } finally {
    await connection.close();
  }
});
