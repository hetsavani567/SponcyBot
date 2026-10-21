require("dotenv").config();
const mongoose = require("mongoose");

async function clearDraftQueue() {
  console.log("==========================================");
  console.log("     SPONCYBOT DRAFT QUEUE PURGE SCRIPT   ");
  console.log("==========================================");

  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("✓ Connected successfully to MongoDB.\n");

  const db = mongoose.connection.db;
  const emailsCol = db.collection("emails");
  const versionsCol = db.collection("emailversions");
  const logsCol = db.collection("approvallogs");

  // Find all drafts awaiting review, rejected, or in progress
  const drafts = await emailsCol.find({ status: { $ne: "SENT" } }).toArray();
  const draftIds = drafts.map(d => d._id);

  console.log(`Found ${drafts.length} draft email(s) in queue:`);
  drafts.forEach(d => console.log(` - [${d.status}] ${d.subject} (ID: ${d._id})`));

  if (draftIds.length > 0) {
    const delEmails = await emailsCol.deleteMany({ _id: { $in: draftIds } });
    const delVersions = await versionsCol.deleteMany({ emailId: { $in: draftIds } });
    const delLogs = await logsCol.deleteMany({ emailId: { $in: draftIds } });

    console.log(`\n✓ Deleted ${delEmails.deletedCount} draft(s) from emails collection.`);
    console.log(`✓ Deleted ${delVersions.deletedCount} corresponding email version(s).`);
    console.log(`✓ Deleted ${delLogs.deletedCount} corresponding approval log(s).`);
  } else {
    console.log("\nDraft queue is already empty. No un-sent drafts found.");
  }

  const remainingSent = await emailsCol.countDocuments({ status: "SENT" });
  console.log(`\n✓ Dispatched emails protected: ${remainingSent} SENT email(s) remain intact.`);
  console.log("✓ Draft queue is now completely clean.");
  console.log("==========================================");

  await mongoose.disconnect();
  process.exit(0);
}

clearDraftQueue().catch(err => {
  console.error("❌ Draft queue purge failed:", err.message);
  process.exit(1);
});
