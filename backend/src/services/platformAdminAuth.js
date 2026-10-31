import { randomBytes } from 'node:crypto';
import AdminSchema from '../models/PlatformAdmin.js';
import SessionSchema from '../models/PlatformAdminSession.js';
import { hashPassword, verifyPassword, validatePassword } from '../security/password.js';
import { SESSION_TTL_MS, tokenHash } from './ownerAuth.js';

const dummyHash = hashPassword(randomBytes(24).toString('hex'));

function models(connection) {
  if (connection?.readyState !== 1) throw new Error('Database unavailable');
  return {
    Admin: connection.models.PlatformAdmin ?? connection.model('PlatformAdmin', AdminSchema.schema),
    Session: connection.models.PlatformAdminSession ??
      connection.model('PlatformAdminSession', SessionSchema.schema),
  };
}

export async function bootstrapPlatformAdmin(connection, email, password) {
  if (typeof email !== 'string' || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Invalid email');
  validatePassword(password);
  const { Admin } = models(connection);
  await Admin.createIndexes();
  if (await Admin.exists({})) throw new Error('Platform Admin already exists');
  const passwordHash = await hashPassword(password);
  try {
    return await Admin.create({ email: email.trim().toLowerCase(), passwordHash });
  } catch (error) {
    if (error.code === 11000) throw new Error('Platform Admin already exists');
    throw error;
  }
}

export async function loginPlatformAdmin(connection, email, password) {
  const { Admin, Session } = models(connection);
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  let valid = false;
  try { valid = await verifyPassword(password, admin?.passwordHash ?? await dummyHash); }
  catch { /* Invalid credentials. */ }
  if (!admin || !valid || !admin.isActive || admin.role !== 'platform_admin') return null;
  const sessionToken = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  await Session.create({ adminId: admin._id, tokenHash: tokenHash(sessionToken),
    csrfTokenHash: tokenHash(csrfToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return { admin, sessionToken, csrfToken };
}

export async function authenticatePlatformAdmin(connection, sessionToken) {
  const { Admin, Session } = models(connection);
  const session = await Session.findOne({ tokenHash: tokenHash(sessionToken),
    expiresAt: { $gt: new Date() } }).select('+csrfTokenHash');
  if (!session) return null;
  const admin = await Admin.findById(session.adminId).select('_id email role isActive');
  if (!admin || !admin.isActive || admin.role !== 'platform_admin') {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  return { admin, sessionId: session._id, csrfTokenHash: session.csrfTokenHash };
}

export async function logoutPlatformAdmin(connection, sessionId) {
  const { Session } = models(connection);
  await Session.deleteOne({ _id: sessionId });
}
