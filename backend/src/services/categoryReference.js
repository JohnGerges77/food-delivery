import { ownerIdFilter, OwnerResourceNotFound } from './ownerTenant.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
const MAX_COMMIT_ATTEMPTS = 3;

function labeled(error, label) {
  return typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel(label);
}

// Retry the whole transaction only on known transient aborts. An uncertain commit is
// retried on the same session, so a completed create is never blindly repeated.
export async function withCategoryReferenceTransaction(connection, work) {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
    const session = await connection.startSession();
    let retry = false;
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
      });
      const result = await work(session);
      for (let commit = 0; commit < MAX_COMMIT_ATTEMPTS; commit++) {
        try {
          await session.commitTransaction();
          return result;
        } catch (error) {
          if (labeled(error, 'UnknownTransactionCommitResult')) {
            if (commit < MAX_COMMIT_ATTEMPTS - 1) continue;
            throw error;
          }
          if (labeled(error, 'TransientTransactionError') &&
              attempt < MAX_TRANSACTION_ATTEMPTS - 1) {
            retry = true;
            break;
          }
          throw error;
        }
      }
    } catch (error) {
      if (!labeled(error, 'UnknownTransactionCommitResult') && session.inTransaction()) {
        await session.abortTransaction();
      }
      if (labeled(error, 'TransientTransactionError') &&
          !labeled(error, 'UnknownTransactionCommitResult') &&
          attempt < MAX_TRANSACTION_ATTEMPTS - 1) retry = true;
      else throw error;
    } finally {
      if (retry && session.inTransaction()) await session.abortTransaction();
      await session.endSession();
    }
    if (!retry) throw new Error('Category reference transaction did not commit');
  }
  throw new Error('Category reference transaction retry limit reached');
}

export async function touchOwnedCategory(Category, auth, categoryId, session) {
  const category = await Category.findOneAndUpdate(ownerIdFilter(auth, categoryId),
    { $inc: { referenceRevision: 1 } },
    { session, returnDocument: 'after', timestamps: false, projection: { _id: 1 } });
  if (!category) throw new OwnerResourceNotFound();
  return category;
}
