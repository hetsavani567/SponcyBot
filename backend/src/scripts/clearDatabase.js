require("dotenv").config();
const mongoose = require("mongoose");

async function clearDatabase() {
  console.log("==========================================");
  console.log("       SPONCYBOT DATABASE PURGE SCRIPT    ");
  console.log("==========================================");

  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("✓ Connected successfully to MongoDB.\n");

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  if (collections.length === 0) {
    console.log("Database has no collections. Already clean!");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Found ${collections.length} collection(s) in database:`);
  let totalDeleted = 0;

  for (const col of collections) {
    const colName = col.name;
    // Skip system collections
    if (colName.startsWith("system.")) continue;

    const collection = db.collection(colName);
    const countBefore = await collection.countDocuments();
    const result = await collection.deleteMany({});
    console.log(` - Collection '${colName}': deleted ${result.deletedCount} document(s) (was ${countBefore})`);
    totalDeleted += result.deletedCount;
  }

  console.log("\n==========================================");
  console.log(`✓ COMPLETE: Deleted ${totalDeleted} total document(s) across all collections.`);
  console.log("✓ Database is now 100% empty and ready for fresh production data.");
  console.log("==========================================");

  await mongoose.disconnect();
  process.exit(0);
}

clearDatabase().catch(err => {
  console.error("❌ Database purge failed:", err.message);
  process.exit(1);
});
