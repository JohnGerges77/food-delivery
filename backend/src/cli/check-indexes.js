import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import OwnerSession from '../models/OwnerSession.js';
import PlatformAdmin from '../models/PlatformAdmin.js';
import PlatformAdminSession from '../models/PlatformAdminSession.js';
import PlatformAudit from '../models/PlatformAudit.js';

const MODELS = [Restaurant, User, Category, Product, Order, OwnerSession,
  PlatformAdmin, PlatformAdminSession, PlatformAudit];

export function compareIndexes(expected, actual) {
  const findings = [];
  for (const [key, options] of expected) {
    const name = Object.entries(key).map(([field, direction]) =>
      `${field}_${direction}`).join('_');
    const found = actual.find((index) => JSON.stringify(index.key) === JSON.stringify(key));
    if (!found) {
      findings.push({ name, issue: 'missing' });
      continue;
    }
    for (const option of ['unique', 'expireAfterSeconds', 'partialFilterExpression']) {
      const wanted = options[option] ?? (option === 'unique' ? false : undefined);
      const present = found[option] ?? (option === 'unique' ? false : undefined);
      if (JSON.stringify(wanted) !== JSON.stringify(present)) {
        findings.push({ name, issue: `conflicting ${option}` });
      }
    }
  }
  return findings;
}

export async function inspectIndexes(uri, expectedDatabase) {
  if (typeof uri !== 'string' || !uri || !expectedDatabase ||
      !/^[a-zA-Z0-9_-]+$/.test(expectedDatabase)) {
    throw new Error('Explicit index inspection URI and database name are required');
  }
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error('Invalid index inspection URI'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
      parsed.pathname !== `/${expectedDatabase}` ||
      [...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname')) {
    throw new Error('Index inspection URI database mismatch');
  }
  if (expectedDatabase === 'savora_test' &&
      decodeURIComponent(parsed.username) !== 'savora_test_user') {
    throw new Error('savora_test requires savora_test_user');
  }
  const connection = mongoose.createConnection(uri, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000,
  });
  try {
    await connection.asPromise();
    if (connection.name !== expectedDatabase ||
        connection.db.databaseName !== expectedDatabase) {
      throw new Error('Connected database name mismatch');
    }
    const findings = [];
    for (const model of MODELS) {
      let actual;
      try {
        actual = await connection.db.collection(model.collection.collectionName)
          .listIndexes().toArray();
      } catch (error) {
        if (error.codeName !== 'NamespaceNotFound') throw error;
        actual = [];
      }
      for (const finding of compareIndexes(model.schema.indexes(), actual)) {
        findings.push({ collection: model.collection.collectionName, ...finding });
      }
    }
    return findings;
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  try {
    const findings = await inspectIndexes(process.env.MONGODB_INDEX_CHECK_URI,
      process.env.MONGODB_INDEX_CHECK_DATABASE);
    console.log(JSON.stringify({ status: findings.length ? 'review' : 'ok', findings }));
    if (findings.length) process.exitCode = 2;
  } catch (error) {
    console.error(`Index inspection failed: ${error.message}`);
    process.exitCode = 1;
  }
}
