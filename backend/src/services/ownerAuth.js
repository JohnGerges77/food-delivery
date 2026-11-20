import { createHash, randomBytes } from 'node:crypto';
import RestaurantSchema from '../models/Restaurant.js';
import UserSchema from '../models/User.js';
import OwnerSessionSchema from '../models/OwnerSession.js';
import { hashPassword, verifyPassword } from '../security/password.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const dummyHash = hashPassword(randomBytes(24).toString('hex'));
const verifiedOwnerContexts = new WeakSet();

export function isVerifiedOwnerContext(value) {
  return value !== null && typeof value === 'object' && verifiedOwnerContexts.has(value);
}

export function tokenHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function modelsFor(connection) {
  if (!connection || connection.readyState !== 1) throw new Error('Database unavailable');
  return {
    User: connection.models.User ?? connection.model('User', UserSchema.schema),
    Restaurant: connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema),
    OwnerSession: connection.models.OwnerSession ??
      connection.model('OwnerSession', OwnerSessionSchema.schema),
  };
}

export async function loginOwner(connection, email, password, { session } = {}) {
  const { User, Restaurant, OwnerSession } = modelsFor(connection);
  const user = await User.findOne({ email }).select('+passwordHash').session(session);
  let validPassword = false;
  try {
    validPassword = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
  } catch {
    // A malformed stored hash is indistinguishable from invalid credentials.
  }
  if (!user || !validPassword || user.role !== 'owner' || !user.isActive) return null;

  const restaurant = await Restaurant.findById(user.restaurantId).session(session);
  if (!restaurant || restaurant.status === 'suspended') return null;

  const sessionToken = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await new OwnerSession({
    userId: user._id,
    tokenHash: tokenHash(sessionToken),
    csrfTokenHash: tokenHash(csrfToken),
    expiresAt,
  }).save({ session });
  return { sessionToken, csrfToken, expiresAt, user, restaurant };
}

export async function authenticateOwner(connection, sessionToken, { session: transaction } = {}) {
  const { User, Restaurant, OwnerSession } = modelsFor(connection);
  const session = await OwnerSession.findOne({
    tokenHash: tokenHash(sessionToken),
    expiresAt: { $gt: new Date() },
  }).select('+csrfTokenHash').session(transaction);
  if (!session) return null;

  const user = await User.findById(session.userId).select('_id restaurantId name email role isActive')
    .session(transaction);
  const restaurant = user && await Restaurant.findById(user.restaurantId)
    .select('_id name slug currency status').session(transaction);
  if (!user || user.role !== 'owner' || !user.isActive ||
      !restaurant || restaurant.status === 'suspended') {
    await OwnerSession.deleteOne({ _id: session._id }, { session: transaction });
    return null;
  }
  const auth = { user, restaurant, userId: user._id, restaurantId: restaurant._id };
  Object.defineProperties(auth, {
    sessionId: { value: session._id },
    csrfTokenHash: { value: session.csrfTokenHash },
    toJSON: { value: () => ({
      userId: String(user._id), restaurantId: String(restaurant._id),
    }) },
  });
  Object.freeze(auth);
  verifiedOwnerContexts.add(auth);
  return auth;
}

export async function logoutOwner(connection, sessionId, { session } = {}) {
  const { OwnerSession } = modelsFor(connection);
  await OwnerSession.deleteOne({ _id: sessionId }, { session });
}
