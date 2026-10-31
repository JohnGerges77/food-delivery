import argon2 from 'argon2';

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 ||
      password.trim().length === 0) {
    throw new Error('Password must be 12 to 128 characters long');
  }
}

export async function hashPassword(password) {
  validatePassword(password);
  try {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  } catch {
    throw new Error('Password hashing failed');
  }
}

export async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string' ||
      !passwordHash.startsWith('$argon2id$')) {
    throw new Error('Invalid password verification input');
  }
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    throw new Error('Password verification failed');
  }
}
