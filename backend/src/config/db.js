import mongoose from 'mongoose';

export async function connectDB(uri, options = {}) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 20,
      ...options });
    console.log('MongoDB connected');
  } catch (error) {
    throw new Error('MongoDB connection failed; check the URI, network, and Atlas access',
      { cause: error });
  }
}
