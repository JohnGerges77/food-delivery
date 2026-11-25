import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { checkManifest, checkUri } from './beta-bootstrap-dry-run.js';
import { compareIndexes } from './check-indexes.js';
import { askHidden } from './provision-owner.js';
import { validatePassword } from '../security/password.js';
import { bootstrapPlatformAdmin } from '../services/platformAdminAuth.js';
import { createPlatformRestaurant } from '../services/platformRestaurants.js';
import { authenticateOwner, loginOwner, logoutOwner } from '../services/ownerAuth.js';
import { createOwnerCategory } from '../services/ownerCategories.js';
import { createOwnerProduct } from '../services/ownerProducts.js';
import { patchOwnerRestaurant } from '../services/restaurantSettings.js';
import {
  listPublicCategories, listPublicProducts, resolvePublicRestaurant, serializePublicRestaurant,
} from '../services/publicMenu.js';

const database = 'savora_beta';
const authenticatedUser = 'savora_beta_user';
const manifest = new URL('../../../docs/public-beta-index-manifest.json', import.meta.url);
const restaurant = {
  name: 'Savora Beta Demo Kitchen',
  slug: 'savora-beta-demo',
  description: 'Fictional restaurant for the Savora public beta. Menu and prices are for demonstration only.',
  currency: 'EGP',
  storefrontTheme: 'savora-classic',
};
const settings = { deliverySettings: { deliveryAvailable: false } };
const ownerName = 'Savora Beta Demo Owner';
const categories = [
  { name: 'Pizza', slug: 'pizza', sortOrder: 0, isActive: true },
  { name: 'Burgers', slug: 'burgers', sortOrder: 1, isActive: true },
  { name: 'Sides', slug: 'sides', sortOrder: 2, isActive: true },
];
const products = [
  {
    categorySlug: 'pizza', name: 'Pizza Margherita', slug: 'pizza-margherita',
    description: 'Stone-baked pizza with tomato sauce, fresh mozzarella and basil.',
    price: 150, preparationTime: 18, isAvailable: true, isFeatured: true,
    variants: makeVariants([['Small', 150], ['Medium', 200], ['Large', 270]]),
  },
  {
    categorySlug: 'burgers', name: 'Cheese Burger', slug: 'cheese-burger',
    description: 'Griddled beef with cheddar, pickles and house sauce on a toasted bun.',
    price: 150, preparationTime: 14, isAvailable: true, isFeatured: true,
    variants: makeVariants([['Single', 150], ['Double', 210]]),
  },
  {
    categorySlug: 'sides', name: 'French Fries', slug: 'french-fries',
    description: 'Crisp golden potato fries tossed with sea salt.',
    price: 60, preparationTime: 8, isAvailable: true, isFeatured: false, variants: [],
  },
];
const expectedCounts = {
  restaurants: 1, users: 1, categories: 3, products: 3, orders: 0,
  ownersessions: 0, platformadmins: 1, platformadminsessions: 0, platformaudits: 1,
};
const emptyCounts = Object.fromEntries(Object.keys(expectedCounts).map((name) => [name, 0]));

function makeVariants(rows) {
  return rows.map(([name, price], sortOrder) => ({ name, price, sortOrder, isAvailable: true }));
}

export function demoPlan() {
  return structuredClone({
    database, expectedAuthenticatedUser: authenticatedUser, restaurant: { ...restaurant, ...settings },
    accounts: { platformAdmin: '[private input]', owner: ownerName, ownerCredentials: '[private input]' },
    categories, products, expectedCounts, checkout: 'disabled', publicContact: null,
  });
}

class DemoError extends Error {}
function requireCheck(condition, message) {
  if (!condition) throw new DemoError(message);
}

export function assertDemoUri(uri) {
  try {
    checkUri(uri);
    const { hostname, port } = new URL(uri);
    if (!hostname.endsWith('.mongodb.net') || port) throw new Error();
  } catch {
    throw new DemoError('Enter the dedicated TLS Atlas URI for savora_beta_user and /savora_beta.');
  }
}

export async function assertBetaIdentity(connection) {
  requireCheck(connection.name === database && connection.db?.databaseName === database,
    'Connected database is not savora_beta.');
  const users = (await connection.db.admin().command({ connectionStatus: 1 })).authInfo?.authenticatedUsers;
  requireCheck(Array.isArray(users) && users.length === 1 && users[0]?.user === authenticatedUser &&
    ['admin', database].includes(users[0].db), 'Authenticated user is not exclusively savora_beta_user.');
}

export async function assertBetaStructure(db, collections) {
  const actual = await db.listCollections().toArray();
  requireCheck(actual.length === collections.length && collections.every(({ collection }) =>
    actual.some(({ name, type }) => name === collection && type === 'collection')),
  'Beta collection list differs from the approved manifest.');
  for (const { collection, indexes } of collections) {
    const current = await db.collection(collection).listIndexes().toArray();
    const idIndex = current.find(({ name }) => name === '_id_');
    requireCheck(current.length === indexes.length + 1 &&
      JSON.stringify(idIndex?.key) === '{"_id":1}' &&
      current.every((index) => !index.sparse && !index.hidden && !index.collation) &&
      !compareIndexes(indexes.map(({ key, options }) => [key, options]), current).length,
    'Beta index mismatch in ' + collection + '.');
  }
}

export async function assertDemoCounts(db, counts, session) {
  for (const [collection, expected] of Object.entries(counts)) {
    const count = await db.collection(collection).countDocuments({}, { session, limit: expected + 1 });
    requireCheck(count === expected, 'Unexpected record count in ' + collection + '.');
  }
}

async function readAccount(role) {
  const email = (await askHidden(role + ' email (hidden): ')).trim().toLowerCase();
  requireCheck(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    'Enter a valid ' + role + ' email.');
  const password = await askHidden(role + ' password (hidden): ');
  requireCheck(password.trim().length >= 16, 'Use a generated password of at least 16 characters.');
  try { validatePassword(password); }
  catch { throw new DemoError('Passwords must be no longer than 128 characters.'); }
  requireCheck(password === await askHidden('Confirm ' + role + ' password (hidden): '),
    'Password confirmation did not match.');
  return { email, password };
}

async function seedDemo(connection, adminAccount, ownerAccount) {
  await connection.transaction(async (session) => {
    // MongoDB retries transient errors. Repeat the empty-state guard in every snapshot.
    await assertDemoCounts(connection.db, emptyCounts, session);
    const options = { session };
    const admin = await bootstrapPlatformAdmin(connection, adminAccount.email, adminAccount.password, options);
    const created = await createPlatformRestaurant(connection, admin._id, {
      restaurant, owner: { name: ownerName, ...ownerAccount },
    }, options);
    // Use the same verified context as Owner requests. The temporary session is
    // revoked inside this transaction, before any write becomes visible.
    const login = await loginOwner(connection, ownerAccount.email, ownerAccount.password, options);
    const auth = login && await authenticateOwner(connection, login.sessionToken, options);
    requireCheck(auth && String(auth.restaurantId) === created.id &&
      String(auth.userId) === created.owner.id, 'Could not verify the new Owner for the demo restaurant.');
    await patchOwnerRestaurant(connection, auth, settings, options);
    const categoryIds = new Map();
    for (const category of categories) {
      const record = await createOwnerCategory(connection, auth, category, options);
      categoryIds.set(category.slug, String(record._id));
    }
    for (const { categorySlug, ...product } of products) {
      await createOwnerProduct(connection, auth, {
        ...product, categoryId: categoryIds.get(categorySlug),
      }, options);
    }
    await logoutOwner(connection, auth.sessionId, options);
    await assertDemoCounts(connection.db, expectedCounts, session);
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}

export function assertDemoMenu(catalog, menu) {
  requireCheck(catalog.length === categories.length && menu.length === products.length,
    'Public catalog count differs from the demo plan.');
  const categoryIds = new Map();
  for (const expected of categories) {
    const actual = catalog.find(({ slug }) => slug === expected.slug);
    requireCheck(actual?.name === expected.name && actual.sortOrder === expected.sortOrder,
      'Public category differs from the plan: ' + expected.slug + '.');
    categoryIds.set(expected.slug, actual.id);
  }
  for (const expected of products) {
    const actual = menu.find(({ slug }) => slug === expected.slug);
    requireCheck(actual?.categoryId === categoryIds.get(expected.categorySlug) &&
      actual.name === expected.name && actual.description === expected.description &&
      actual.price === expected.price && actual.startingPrice === expected.price &&
      actual.preparationTime === expected.preparationTime && actual.isFeatured === expected.isFeatured &&
      actual.variants.length === expected.variants.length &&
      new Set(actual.variants.map(({ id }) => id)).size === actual.variants.length &&
      actual.variants.every((variant, index) => /^[0-9a-f]{24}$/.test(variant.id) &&
        Object.entries(expected.variants[index]).every(([key, value]) => variant[key] === value)),
    'Public product differs from the plan: ' + expected.slug + '.');
  }
}

async function verifyDemo(connection) {
  const { db } = connection;
  await assertDemoCounts(db, expectedCounts);
  const publicRecord = await resolvePublicRestaurant(connection, restaurant.slug);
  const storefront = serializePublicRestaurant(publicRecord);
  requireCheck(Object.entries(restaurant).every(([key, value]) => storefront[key] === value) &&
    storefront.deliverySettings.deliveryAvailable === false && !storefront.socialLinks.whatsapp &&
    !storefront.phone && !storefront.contactEmail && !storefront.address,
  'Public restaurant settings differ from the demo plan.');

  const { _id: restaurantId } = publicRecord;
  const argon2id = /^\$argon2id\$/;
  const admin = await db.collection('platformadmins').findOne({
    role: 'platform_admin', bootstrapSlot: 'primary', isActive: true, passwordHash: argon2id,
  }, { projection: { _id: 1 } });
  const owner = await db.collection('users').findOne({
    restaurantId, name: ownerName, role: 'owner', isActive: true, passwordHash: argon2id,
  }, { projection: { _id: 1, email: 1 } });
  requireCheck(admin && owner, 'Expected Platform Admin or tenant Owner could not be verified.');
  requireCheck(await db.collection('platformaudits').findOne({
    adminId: admin._id, restaurantId, action: 'restaurant.created', 'details.slug': restaurant.slug,
    'details.ownerEmail': owner.email, 'details.storefrontTheme': restaurant.storefrontTheme,
  }, { projection: { _id: 1 } }), 'Restaurant creation audit does not match the accounts.');

  const catalog = await listPublicCategories(connection, publicRecord, {});
  const menu = await listPublicProducts(connection, publicRecord, {});
  assertDemoMenu(catalog.categories, menu.products);
}

async function withBetaConnection(uri, collections, work) {
  const connection = mongoose.createConnection(uri, { autoIndex: false, autoCreate: false,
    serverSelectionTimeoutMS: 10000, readConcern: { level: 'majority' } });
  try {
    await connection.asPromise();
    await assertBetaIdentity(connection);
    await assertBetaStructure(connection.db, collections);
    await work(connection);
  } finally {
    await connection.close();
  }
}

async function main() {
  const mode = process.argv[2] ?? 'plan';
  requireCheck(process.versions.node.split('.')[0] === '24' && process.argv.length <= 3 &&
    ['plan', 'preflight', 'apply', 'verify'].includes(mode),
  'Use Node 24 and one of plan, preflight, apply or verify.');
  const report = (data) => console.log(JSON.stringify(data, null, 2));
  const collections = checkManifest(JSON.parse(await readFile(manifest, 'utf8')));
  const indexes = collections.reduce((total, collection) => total + collection.indexes.length, 0);
  if (mode === 'plan') {
    report({ status: 'offline-plan', ...demoPlan() });
    return;
  }
  requireCheck(process.stdin.isTTY && process.stdout.isTTY && process.stdin.setRawMode,
    'Open an interactive PowerShell or Windows Terminal session for private input.');
  const uri = await askHidden('Atlas URI for savora_beta (hidden): ');
  assertDemoUri(uri);

  if (mode === 'preflight' || mode === 'apply') {
    await withBetaConnection(uri, collections, (connection) => assertDemoCounts(connection.db, emptyCounts));
    report({ status: 'preflight-passed', indexes, authenticatedUser, ...demoPlan() });
    if (mode === 'preflight') return;
    const admin = await readAccount('Platform Admin');
    const owner = await readAccount('Owner');
    requireCheck(admin.password !== owner.password, 'Use different passwords for the two accounts.');
    requireCheck(await askHidden('Type savora_beta to apply the reviewed plan: ') === database,
      'Provisioning cancelled.');
    // Reconnect after private input and validate the live target before the transaction.
    await withBetaConnection(uri, collections, (connection) => seedDemo(connection, admin, owner));
    report({ status: 'committed', database, authenticatedUser });
  }
  await withBetaConnection(uri, collections, verifyDemo);
  report({ status: 'verified', database, authenticatedUser, indexes, counts: expectedCounts });
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof DemoError ? error.message :
      'Beta operation stopped. Check Atlas access and run the read-only verify command before any retry.');
    process.exitCode = 1;
  });
}
