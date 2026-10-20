const mongoose = require("mongoose");

// Fast 2s buffer timeout prevents hanging requests during cloud cold starts or network reconnects
mongoose.set("bufferTimeoutMS", 2000);

// Global connection cache across serverless / cloud function invocations
let cachedPromise = null;

/**
 * Connect to MongoDB Atlas or local MongoDB instance with connection reuse
 */
const connectDB = async () => {
  // If already connected, return active connection immediately (0ms latency)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If already connecting, return the in-flight promise to avoid redundant parallel connection attempts
  if (cachedPromise && mongoose.connection.readyState === 2) {
    return cachedPromise;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn("[Database] MONGODB_URI is not set. Server running in resilient in-memory mode.");
    return null;
  }

  try {
    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 4000,
      socketTimeoutMS: 25000,
      maxPoolSize: 10,
      minPoolSize: 1
    }).then(conn => {
      console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}`);
      return conn;
    }).catch(err => {
      cachedPromise = null;
      console.warn(`[Database] MongoDB connection warning: ${err.message}`);
      return null;
    });

    return await cachedPromise;
  } catch (error) {
    cachedPromise = null;
    console.warn(`[Database] MongoDB connection error: ${error.message}`);
    return null;
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;

