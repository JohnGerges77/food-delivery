import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import { hashPassword } from '../src/security/password.js';
import { createLoginLimiter } from '../src/routes/auth.js';
import { tokenHash } from '../src/services/ownerAuth.js';

const origin = 'https://dashboard.example.test';
const password = 'A long integration password 123!';

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  try {
    const parsed = new URL(value);
    assert.ok(['mongodb:', 'mongodb+srv:'].includes(parsed.protocol));
    assert.equal(decodeURIComponent(parsed.username), 'savora_test_user');
    assert.equal(parsed.pathname, '/savora_test');
    assert.equal([...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'), false);
  } catch {
    throw new Error('MONGODB_TEST_URI failed test database safety checks');
  }
  return value;
}

async function closeServer(server) {
  if (server) await new Promise((resolve) => server.close(resolve));
}

test('owner auth HTTP integration on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Integration tests require Node 24');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const restaurantIds = [];
  const userIds = [];
  const sessionIds = [];
  let server;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');

    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const OwnerSession = connection.model('OwnerSession', OwnerSessionSchema.schema);
    await Restaurant.createIndexes();
    await User.createIndexes();
    await OwnerSession.createIndexes();
    const indexes = await OwnerSession.collection.listIndexes().toArray();
    assert.ok(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));

    const suffix = randomUUID().replaceAll('-', '');
    const passwordHash = await hashPassword(password);
    const fixtures = [];
    for (const letter of ['a', 'b']) {
      const restaurantId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      restaurantIds.push(restaurantId);
      userIds.push(userId);
      const restaurant = await Restaurant.create({
        _id: restaurantId, name: `Auth Restaurant ${letter}`,
        slug: `it-auth-${letter}-${suffix}`, currency: 'EGP',
      });
      const user = await User.create({
        _id: userId, restaurantId, name: `Owner ${letter}`,
        email: `it-auth-${letter}-${suffix}@example.test`, passwordHash,
      });
      fixtures.push({ restaurant, user });
    }

    server = createApp({ connection, allowedOrigins: origin, secureCookies: true,
      loginLimiter: createLoginLimiter({ maxAttempts: 100 }) })
      .listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = (email, attemptedPassword = password) => fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Savora-CSRF': '1' },
      body: JSON.stringify({ email, password: attemptedPassword }),
    });
    const me = (cookies, query = '') => fetch(`${base}/api/auth/me${query}`, {
      headers: { Cookie: cookies, Origin: origin },
    });
    const logout = (cookies, csrf, requestOrigin = origin) => fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookies, Origin: requestOrigin, 'X-Savora-CSRF': csrf },
    });
    const readLogin = async (user) => {
      const response = await login(user.email);
      assert.equal(response.status, 200);
      const setCookies = response.headers.getSetCookie();
      const sessionCookie = setCookies.find((value) => value.startsWith('savora_owner_session='));
      const csrfCookie = setCookies.find((value) => value.startsWith('savora_owner_csrf='));
      assert.ok(sessionCookie);
      assert.ok(csrfCookie);
      const sessionToken = sessionCookie.split(';')[0].split('=')[1];
      const csrfToken = csrfCookie.split(';')[0].split('=')[1];
      const session = await OwnerSession.findOne({ tokenHash: tokenHash(sessionToken) })
        .select('+tokenHash +csrfTokenHash');
      assert.ok(session);
      sessionIds.push(session._id);
      return {
        response, body: await response.json(), session, sessionCookie, csrfCookie,
        csrfToken, sessionToken,
        cookies: `${sessionCookie.split(';')[0]}; ${csrfCookie.split(';')[0]}`,
      };
    };

    await t.test('unknown email and wrong password return the same generic error', async () => {
      const unknown = await login(`missing-${suffix}@example.test`);
      const wrong = await login(fixtures[0].user.email, 'Wrong integration password 123!');
      assert.equal(unknown.status, 401);
      assert.equal(wrong.status, 401);
      assert.deepEqual(await unknown.json(), await wrong.json());
    });

    await t.test('inactive owner and suspended restaurant cannot log in', async () => {
      const { user, restaurant } = fixtures[0];
      try {
        await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
        assert.equal((await login(user.email)).status, 401);
        await User.updateOne({ _id: user._id }, { $set: { isActive: true } });
        await Restaurant.updateOne({ _id: restaurant._id }, { $set: { status: 'suspended' } });
        assert.equal((await login(user.email)).status, 401);
      } finally {
        await User.updateOne({ _id: user._id }, { $set: { isActive: true } });
        await Restaurant.updateOne({ _id: restaurant._id }, { $set: { status: 'active' } });
      }
    });

    await t.test('login stores hashes and sets secure, scoped cookies', async () => {
      const auth = await readLogin(fixtures[0].user);
      assert.match(auth.sessionCookie, /HttpOnly/);
      assert.match(auth.sessionCookie, /Secure/);
      assert.match(auth.sessionCookie, /SameSite=Lax/);
      assert.match(auth.sessionCookie, /Path=\/api/);
      assert.doesNotMatch(auth.csrfCookie, /HttpOnly/);
      assert.equal(auth.session.tokenHash, tokenHash(auth.sessionToken));
      assert.equal(auth.session.csrfTokenHash, tokenHash(auth.csrfToken));
      assert.notEqual(auth.session.tokenHash, auth.sessionToken);
      assert.deepEqual(Object.keys(auth.body).sort(), ['restaurant', 'user']);
      assert.doesNotMatch(JSON.stringify(auth.body), /passwordHash|trackingTokenHash|tokenHash|csrfTokenHash|sessionToken/);
    });

    await t.test('/me derives the tenant from each verified owner session', async () => {
      const first = await readLogin(fixtures[0].user);
      const second = await readLogin(fixtures[1].user);
      const firstResponse = await me(first.cookies, `?restaurantId=${fixtures[1].restaurant._id}`);
      const secondResponse = await me(second.cookies);
      assert.equal(firstResponse.status, 200);
      assert.equal(secondResponse.status, 200);
      const firstBody = await firstResponse.json();
      const secondBody = await secondResponse.json();
      assert.equal(firstBody.restaurant.id, String(fixtures[0].restaurant._id));
      assert.equal(secondBody.restaurant.id, String(fixtures[1].restaurant._id));
      assert.equal(firstBody.user.id, String(fixtures[0].user._id));
      assert.doesNotMatch(JSON.stringify(firstBody), /passwordHash|trackingTokenHash|tokenHash|csrfTokenHash|sessionToken/);
    });

    await t.test('invalid and expired session cookies are rejected and cleared', async () => {
      const invalid = await me(`savora_owner_session=${'a'.repeat(64)}`);
      assert.equal(invalid.status, 401);
      assert.ok(invalid.headers.getSetCookie().some((value) => /Max-Age=0/.test(value)));

      const auth = await readLogin(fixtures[0].user);
      await OwnerSession.updateOne({ _id: auth.session._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } });
      const expired = await me(auth.cookies);
      assert.equal(expired.status, 401);
      assert.ok(expired.headers.getSetCookie().some((value) => /Max-Age=0/.test(value)));
    });

    await t.test('existing sessions stop working when owner or restaurant becomes unavailable', async () => {
      const auth = await readLogin(fixtures[0].user);
      try {
        await User.updateOne({ _id: fixtures[0].user._id }, { $set: { isActive: false } });
        assert.equal((await me(auth.cookies)).status, 401);
      } finally {
        await User.updateOne({ _id: fixtures[0].user._id }, { $set: { isActive: true } });
      }
      const another = await readLogin(fixtures[0].user);
      try {
        await Restaurant.updateOne({ _id: fixtures[0].restaurant._id },
          { $set: { status: 'suspended' } });
        assert.equal((await me(another.cookies)).status, 401);
      } finally {
        await Restaurant.updateOne({ _id: fixtures[0].restaurant._id },
          { $set: { status: 'active' } });
      }
    });

    await t.test('logout requires trusted Origin and matching CSRF token, then revokes session', async () => {
      const auth = await readLogin(fixtures[0].user);
      assert.equal((await logout(auth.cookies, auth.csrfToken, 'https://other.example.test')).status, 403);
      assert.equal((await logout(auth.cookies, 'b'.repeat(64))).status, 403);
      assert.equal((await me(auth.cookies)).status, 200);
      const response = await logout(auth.cookies, auth.csrfToken);
      assert.equal(response.status, 204);
      assert.ok(response.headers.getSetCookie().some((value) => /Max-Age=0/.test(value)));
      assert.equal((await me(auth.cookies)).status, 401);
      assert.equal(await OwnerSession.countDocuments({ _id: auth.session._id }), 0);
    });
  } finally {
    await closeServer(server);
    if (connection.readyState === 1) {
      const OwnerSession = connection.models.OwnerSession;
      const User = connection.models.User;
      const Restaurant = connection.models.Restaurant;
      for (const _id of sessionIds) await OwnerSession.deleteOne({ _id });
      for (const _id of userIds) await User.deleteOne({ _id });
      for (const _id of restaurantIds) await Restaurant.deleteOne({ _id });
    }
    await connection.close();
  }
});
