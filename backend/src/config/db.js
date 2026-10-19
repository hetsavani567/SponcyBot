const mongoose = require("mongoose");

// Standard 10s buffer timeout for cloud/cold-start stability
mongoose.set("bufferTimeoutMS", 10000);

/**
 * Connect to MongoDB Atlas or local MongoDB instance
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn("[Database] MONGODB_URI is not set. Server running without active database connection.");
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[Database] MongoDB connection warning: ${error.message}`);
    return null;
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
