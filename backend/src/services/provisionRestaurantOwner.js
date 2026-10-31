import RestaurantSchema from '../models/Restaurant.js';
import UserSchema from '../models/User.js';
import { hashPassword, validatePassword } from '../security/password.js';

export class ProvisioningError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProvisioningError';
    this.code = code;
  }
}

function hasOnlyKeys(value, allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key));
}

function modelsFor(connection) {
  if (!connection || connection.readyState !== 1) {
    throw new ProvisioningError('CONNECTION_REQUIRED', 'A connected database is required');
  }
  return {
    Restaurant: connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema),
    User: connection.models.User ?? connection.model('User', UserSchema.schema),
  };
}

export async function provisionRestaurantOwner(input, { connection } = {}) {
  if (!hasOnlyKeys(input, ['restaurant', 'owner', 'password']) ||
      !hasOnlyKeys(input.restaurant, ['name', 'slug', 'currency']) ||
      !hasOnlyKeys(input.owner, ['name', 'email'])) {
    throw new ProvisioningError('INVALID_INPUT', 'Invalid provisioning data');
  }

  try {
    validatePassword(input.password);
  } catch {
    throw new ProvisioningError('INVALID_PASSWORD', 'Invalid password length');
  }

  const { Restaurant, User } = modelsFor(connection);
  const restaurant = new Restaurant(input.restaurant);
  const owner = new User({
    restaurantId: restaurant._id,
    name: input.owner.name,
    email: input.owner.email,
    passwordHash: 'pending-hash',
  });

  try {
    await restaurant.validate();
    await owner.validate();
  } catch {
    throw new ProvisioningError('INVALID_INPUT', 'Invalid restaurant or owner data');
  }

  // The uniqueness constraints must exist before the transaction begins.
  // This is idempotent and never drops or replaces an existing index.
  try {
    await Restaurant.createIndexes();
    await User.createIndexes();
  } catch {
    throw new ProvisioningError('INDEX_SETUP_FAILED', 'Provisioning indexes are unavailable');
  }

  owner.passwordHash = await hashPassword(input.password);

  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      await restaurant.save({ session });
      await owner.save({ session });
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0];
      if (field === 'slug') throw new ProvisioningError('DUPLICATE_SLUG', 'Restaurant slug already exists');
      if (field === 'email') throw new ProvisioningError('DUPLICATE_EMAIL', 'Owner email already exists');
      if (field === 'restaurantId') {
        throw new ProvisioningError('OWNER_EXISTS', 'Restaurant already has an owner');
      }
      throw new ProvisioningError('DUPLICATE', 'A unique value already exists');
    }
    throw new ProvisioningError('TRANSACTION_FAILED', 'Provisioning transaction failed');
  } finally {
    await session.endSession();
  }

  return {
    restaurantId: restaurant._id,
    ownerId: owner._id,
    slug: restaurant.slug,
    ownerEmail: owner.email,
  };
}
