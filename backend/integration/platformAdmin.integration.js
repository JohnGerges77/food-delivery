import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import AdminSchema from '../src/models/PlatformAdmin.js';
import AdminSessionSchema from '../src/models/PlatformAdminSession.js';
import AuditSchema from '../src/models/PlatformAudit.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import { bootstrapPlatformAdmin } from '../src/services/platformAdminAuth.js';
import { verifyPassword } from '../src/security/password.js';

const origin = 'https://dashboard.example.test';
const password = 'Temporary integration password 123!';
function testUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI required');
  let uri;
  try { uri = new URL(value); } catch { throw new Error('Invalid test URI'); }
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(uri.protocol));
  assert.equal(decodeURIComponent(uri.username), 'savora_test_user');
  assert.equal(uri.pathname, '/savora_test');
  assert.equal([...uri.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'), false);
  return value;
}
function cookies(response) {
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}

test('Platform Admin API journey, suspension, audit and exact fixture teardown', async () => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24);
  const connection = mongoose.createConnection(testUri(), { autoIndex: false,
    autoCreate: false, serverSelectionTimeoutMS: 10_000 });
  const suffix = randomUUID().replaceAll('-', '');
  const slug = `it-platform-${suffix}`;
  const ownerEmail = `owner-${suffix}@example.test`;
  const adminEmail = `admin-${suffix}@example.test`;
  let server;
  let adminId;
  let restaurantId;
  let ownerId;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Admin = connection.model('PlatformAdmin', AdminSchema.schema);
    const AdminSession = connection.model('PlatformAdminSession', AdminSessionSchema.schema);
    const Audit = connection.model('PlatformAudit', AuditSchema.schema);
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const OwnerSession = connection.model('OwnerSession', OwnerSessionSchema.schema);
    const auditTrail = async () => (await Audit.find({ restaurantId }).sort({ _id: 1 }).lean())
      .map(({ adminId: actorId, restaurantId: subjectId, action, details }) => {
        assert.equal(String(actorId), String(adminId));
        assert.equal(String(subjectId), String(restaurantId));
        return { action, details };
      });
    assert.equal(await Admin.countDocuments(), 0, 'Test DB must not have a Platform Admin');
    const admin = await bootstrapPlatformAdmin(connection, adminEmail, password);
    adminId = admin._id;
    assert.equal(admin.passwordHash.startsWith('$argon2id$'), true);
    assert.equal(await verifyPassword(password, admin.passwordHash), true);
    await assert.rejects(bootstrapPlatformAdmin(connection, `other-${suffix}@example.test`, password),
      /already exists/);
    await AdminSession.createIndexes();
    await Audit.createIndexes();
    server = createApp({ connection, allowedOrigins: origin, secureCookies: false }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path, options = {}) => fetch(`${base}${path}`, options);
    const body = (value) => JSON.stringify(value);
    const jsonHeaders = { Origin: origin, 'Content-Type': 'application/json' };
    assert.equal((await call('/api/admin/overview')).status, 401);
    const wrong = await call('/api/admin/auth/login', { method: 'POST', headers: {
      ...jsonHeaders, 'X-Savora-CSRF': '1' }, body: body({ email: adminEmail, password: 'Wrong password 123!' }) });
    assert.equal(wrong.status, 401);
    const login = await call('/api/admin/auth/login', { method: 'POST', headers: {
      ...jsonHeaders, 'X-Savora-CSRF': '1' }, body: body({ email: adminEmail, password }) });
    assert.equal(login.status, 200);
    assert.equal(JSON.stringify(await login.json()).includes('passwordHash'), false);
    const adminCookie = cookies(login);
    assert.match(adminCookie, /savora_platform_session=/);
    assert.equal((await call('/api/admin/overview', { headers: {
      Cookie: `savora_owner_session=${'a'.repeat(64)}` } })).status, 401);
    const csrfResponse = await call('/api/admin/auth/csrf', { headers: { Origin: origin, Cookie: adminCookie } });
    assert.equal(csrfResponse.status, 200);
    const { csrfToken } = await csrfResponse.json();
    const mutation = { ...jsonHeaders, Cookie: adminCookie, 'X-Savora-CSRF': csrfToken };
    const createBody = { restaurant: { name: 'Integration Cafe', slug, currency: 'EGP',
      storefrontTheme: 'savora-luxury' },
      owner: { name: 'Integration Owner', email: ownerEmail, password } };
    assert.equal((await call('/api/admin/restaurants', { method: 'POST', headers: {
      ...jsonHeaders, Cookie: adminCookie }, body: body(createBody) })).status, 403);
    const created = await call('/api/admin/restaurants', { method: 'POST', headers: mutation,
      body: body(createBody) });
    assert.equal(created.status, 201);
    const createdJson = await created.json();
    restaurantId = createdJson.restaurant.id;
    ownerId = createdJson.restaurant.owner.id;
    assert.equal(JSON.stringify(createdJson).includes(password), false);
    assert.equal(createdJson.restaurant.storefrontTheme, 'savora-luxury');
    assert.deepEqual(await auditTrail(), [{ action: 'restaurant.created', details: {
      slug, ownerEmail, storefrontTheme: 'savora-luxury' } }]);
    assert.equal((await (await call(`/api/public/restaurants/${slug}`)).json()).restaurant.storefrontTheme,
      'savora-luxury');
    assert.equal((await call('/api/admin/restaurants', { method: 'POST', headers: mutation,
      body: body({ ...createBody, restaurant: { ...createBody.restaurant,
        slug: `${slug}-invalid`, storefrontTheme: 'savora-luxury-dark' } }) })).status, 400);
    assert.equal(await Restaurant.countDocuments({ slug: `${slug}-invalid` }), 0);
    const duplicate = await call('/api/admin/restaurants', { method: 'POST', headers: mutation,
      body: body({ ...createBody, owner: { ...createBody.owner,
        email: `other-${suffix}@example.test` } }) });
    assert.equal(duplicate.status, 409);
    assert.equal(await User.countDocuments({ email: `other-${suffix}@example.test` }), 0);
    const emailConflict = await call('/api/admin/restaurants', { method: 'POST', headers: mutation,
      body: body({ restaurant: { ...createBody.restaurant, slug: `${slug}-other` },
        owner: createBody.owner }) });
    assert.equal(emailConflict.status, 409);
    assert.equal(await Restaurant.countDocuments({ slug: `${slug}-other` }), 0);
    const list = await call(`/api/admin/restaurants?search=${slug}&page=1&limit=20`,
      { headers: { Cookie: adminCookie } });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).restaurants[0].id, restaurantId);
    assert.equal((await call(`/api/admin/restaurants/${restaurantId}`,
      { headers: { Cookie: adminCookie } })).status, 200);
    const ownerLogin = () => call('/api/auth/login', { method: 'POST', headers: {
      ...jsonHeaders, 'X-Savora-CSRF': '1' }, body: body({ email: ownerEmail, password }) });
    const ownerResponse = await ownerLogin();
    assert.equal(ownerResponse.status, 200);
    const ownerCookie = cookies(ownerResponse);
    assert.equal((await call('/api/admin/overview', { headers: { Cookie: ownerCookie } })).status, 401);
    const themeUrl = `/api/admin/restaurants/${restaurantId}/theme`;
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: { ...jsonHeaders,
      Cookie: ownerCookie }, body: body({ storefrontTheme: 'savora-classic' }) })).status, 401);
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: { ...jsonHeaders,
      Cookie: adminCookie }, body: body({ storefrontTheme: 'savora-classic' }) })).status, 403);
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: mutation,
      body: body({ storefrontTheme: 'savora-luxury-dark' }) })).status, 400);
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: mutation,
      body: body({ storefrontTheme: 'savora-classic' }) })).status, 200);
    assert.equal((await Restaurant.findById(restaurantId)).storefrontTheme, 'savora-classic');
    await connection.collection('restaurants').updateOne({ _id: new mongoose.Types.ObjectId(restaurantId) },
      { $unset: { storefrontTheme: '' } }); // Simulate a pre-theme Restaurant.
    assert.equal((await (await call(`/api/public/restaurants/${slug}`)).json()).restaurant.storefrontTheme,
      'savora-classic');
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: mutation,
      body: body({ storefrontTheme: 'savora-aqua' }) })).status, 200);
    assert.equal((await (await call(`/api/public/restaurants/${slug}`)).json()).restaurant.storefrontTheme,
      'savora-aqua');
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: mutation,
      body: body({ storefrontTheme: 'savora-cafe' }) })).status, 200);
    assert.equal((await (await call(`/api/public/restaurants/${slug}`)).json()).restaurant.storefrontTheme,
      'savora-cafe');
    assert.equal((await call(themeUrl, { method: 'PATCH', headers: mutation,
      body: body({ storefrontTheme: 'savora-luxury' }) })).status, 200);
    assert.equal((await (await call(`/api/public/restaurants/${slug}`)).json()).restaurant.storefrontTheme,
      'savora-luxury');
    assert.deepEqual((await auditTrail())
      .filter(({ action }) => action === 'restaurant.theme_changed')
      .map(({ details }) => details), [
        { from: 'savora-luxury', to: 'savora-classic' },
        { from: 'savora-classic', to: 'savora-aqua' },
        { from: 'savora-aqua', to: 'savora-cafe' },
        { from: 'savora-cafe', to: 'savora-luxury' },
      ]);
    const suspended = await call(`/api/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH', headers: mutation, body: body({ status: 'suspended' }) });
    assert.equal(suspended.status, 200);
    assert.equal((await suspended.json()).restaurant.status, 'suspended');
    assert.equal((await ownerLogin()).status, 401);
    assert.equal((await call('/api/auth/me', { headers: { Cookie: ownerCookie } })).status, 401);
    assert.equal((await call(`/api/public/restaurants/${slug}`)).status, 404);
    const checkoutDenied = await call(`/api/public/restaurants/${slug}/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        'Idempotency-Key': `blocked-${suffix}` }, body: body({
        customerName: 'Guest', customerPhone: '+201001234567',
        deliveryAddress: '12 Test Street', city: 'Cairo', submissionMethod: 'direct',
        items: [{ productId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
      }) });
    assert.equal(checkoutDenied.status, 404);
    const expectedAudit = [
      { action: 'restaurant.created', details: {
        slug, ownerEmail, storefrontTheme: 'savora-luxury' } },
      { action: 'restaurant.theme_changed', details: {
        from: 'savora-luxury', to: 'savora-classic' } },
      { action: 'restaurant.theme_changed', details: {
        from: 'savora-classic', to: 'savora-aqua' } },
      { action: 'restaurant.theme_changed', details: {
        from: 'savora-aqua', to: 'savora-cafe' } },
      { action: 'restaurant.theme_changed', details: {
        from: 'savora-cafe', to: 'savora-luxury' } },
      { action: 'restaurant.suspended', details: { from: 'active', to: 'suspended' } },
    ];
    assert.deepEqual(await auditTrail(), expectedAudit);
    const reactivated = await call(`/api/admin/restaurants/${restaurantId}/status`, {
      method: 'PATCH', headers: mutation, body: body({ status: 'active' }) });
    assert.equal(reactivated.status, 200);
    assert.equal((await ownerLogin()).status, 200);
    assert.equal((await call(`/api/public/restaurants/${slug}`)).status, 200);
    assert.deepEqual(await auditTrail(), [
      ...expectedAudit,
      { action: 'restaurant.activated', details: { from: 'suspended', to: 'active' } },
    ]);
    assert.equal((await call('/api/admin/auth/logout', { method: 'POST', headers: mutation })).status, 204);
    assert.equal((await call('/api/admin/overview', { headers: { Cookie: adminCookie } })).status, 401);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
      if (connection.readyState === 1) {
        const foundRestaurant = await connection.collection('restaurants').findOne({ slug });
        restaurantId ??= foundRestaurant?._id?.toString();
        const foundOwner = await connection.collection('users').findOne({ email: ownerEmail });
        ownerId ??= foundOwner?._id?.toString();
        if (restaurantId) {
          await connection.collection('platformaudits').deleteMany({ restaurantId: new mongoose.Types.ObjectId(restaurantId) });
        }
        if (adminId) await connection.collection('platformadminsessions').deleteMany({ adminId });
        if (ownerId) await connection.collection('ownersessions').deleteMany({ userId: new mongoose.Types.ObjectId(ownerId) });
        if (ownerId) await connection.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(ownerId) });
        if (restaurantId) await connection.collection('restaurants').deleteOne({ _id: new mongoose.Types.ObjectId(restaurantId) });
        if (adminId) await connection.collection('platformadmins').deleteOne({ _id: adminId });
        assert.equal(await connection.collection('restaurants').countDocuments({ slug }), 0);
        assert.equal(await connection.collection('users').countDocuments({ email: ownerEmail }), 0);
        assert.equal(await connection.collection('platformadmins').countDocuments({ email: adminEmail }), 0);
        if (adminId) {
          assert.equal(await connection.collection('platformadminsessions').countDocuments({ adminId }), 0);
        }
        assert.equal(await connection.collection('platformaudits').countDocuments({ restaurantId: restaurantId ? new mongoose.Types.ObjectId(restaurantId) : null }), 0);
        if (restaurantId) {
          const tenantId = new mongoose.Types.ObjectId(restaurantId);
          for (const collection of ['ownersessions', 'categories', 'products', 'orders']) {
            assert.equal(await connection.collection(collection).countDocuments(
              collection === 'ownersessions' ? { userId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null } :
                { restaurantId: tenantId }), 0, `${collection} fixture cleanup`);
          }
        }
      }
    } finally {
      await connection.close();
    }
  }
});
