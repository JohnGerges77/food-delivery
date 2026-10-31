import mongoose from 'mongoose';
import CategorySchema from '../models/Category.js';
import ProductSchema from '../models/Product.js';
import OrderSchema from '../models/Order.js';
import { isVerifiedOwnerContext } from './ownerAuth.js';

export class OwnerResourceNotFound extends Error {
  constructor() {
    super('Not found');
    this.status = 404;
  }
}

function restaurantIdFrom(auth) {
  if (!isVerifiedOwnerContext(auth) ||
      !auth.userId || !mongoose.isValidObjectId(auth.userId) ||
      !auth.restaurantId || !mongoose.isValidObjectId(auth.restaurantId)) {
    throw new Error('Verified owner context is required');
  }
  return auth.restaurantId;
}

export function ownerIdFilter(auth, id) {
  const restaurantId = restaurantIdFrom(auth);
  if (!mongoose.isValidObjectId(id)) throw new OwnerResourceNotFound();
  return { _id: id, restaurantId };
}

export function ownerListFilter(auth, criteria = {}) {
  const restaurantId = restaurantIdFrom(auth);
  if (criteria === null || typeof criteria !== 'object' || Array.isArray(criteria)) {
    throw new TypeError('Query criteria must be an object');
  }
  // The fixed tenant clause cannot be overridden by later query criteria.
  return { $and: [{ restaurantId }, criteria] };
}

export function createOwnerTenantScope(connection, auth) {
  restaurantIdFrom(auth);
  if (!connection || connection.readyState !== 1) throw new Error('Database unavailable');
  const Category = connection.models.Category ?? connection.model('Category', CategorySchema.schema);
  const Product = connection.models.Product ?? connection.model('Product', ProductSchema.schema);
  const Order = connection.models.Order ?? connection.model('Order', OrderSchema.schema);

  function bind(Model) {
    return Object.freeze({
      find(criteria = {}) { return Model.find(ownerListFilter(auth, criteria)); },
      findById(id) { return Model.findOne(ownerIdFilter(auth, id)); },
      // Use this exact filter for an owner-scoped update or delete; validate write fields separately.
      idFilter(id) { return ownerIdFilter(auth, id); },
    });
  }

  const categories = bind(Category);
  const products = bind(Product);
  const orders = bind(Order);
  return Object.freeze({
    categories, products, orders,
    // Validate these references before setting Product.categoryId or Order.items[].productId.
    async requireCategory(id) {
      const category = await categories.findById(id);
      if (!category) throw new OwnerResourceNotFound();
      return category;
    },
    async requireProduct(id) {
      const product = await products.findById(id);
      if (!product) throw new OwnerResourceNotFound();
      return product;
    },
  });
}
