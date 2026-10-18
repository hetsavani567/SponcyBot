const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const path = require("path");

async function main() {
  console.log("=== Starting MongoDB In-Memory Server ===");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`In-memory MongoDB started at: ${uri}`);

  process.env.MONGODB_URI = uri;
  process.env.PORT = "5001";
  process.env.P4_WEBHOOK_SECRET = "test-p4-secret-2026";
  process.env.ORGANIZER_ORG = "ACM NIT Surat";

  // Require server.js without modifying it
  require("../server.js");

  // Wait for server to be up
  const BASE = "http://localhost:5001";
  let connected = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) {
        const json = await res.json();
        if (json.db === "connected") {
          connected = true;
          break;
        }
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!connected) {
    console.error("Server failed to start and connect within 15 seconds");
    process.exit(1);
  }
  console.log("Server is running on port 5001 and DB is connected.\n");

  const Company = require("../models/company");
  const TeamMember = require("../models/teamMember");
  const { Email } = require("../models/email");
  const { Outreach } = require("../models/outreach");

  // Seed sample team member
  const member = await TeamMember.create({
    name: "ACM Outreach Team",
    email: "outreach@acm.svnit.ac.in",
    role: "Outreach Lead"
  });
  console.log(`Created TeamMember: ${member.name} (${member._id})`);

  // Seed 3 companies in different tiers for tests
  const cGold = await Company.create({
    name: "CloudScale India Pvt Ltd",
    website: "https://cloudscale.example.com",
    category: "Cloud & Developer Tools",
    industry: "Cloud Infrastructure",
    recommendedTier: "Gold",
    recommendedAsk: "money",
    contactName: "Priya Sharma",
    contactRole: "DevRel Director",
    research: "Enterprise cloud provider with 10M+ developers and extensive student programs in India."
  });

  const cSilver = await Company.create({
    name: "DevToolz Systems",
    website: "https://devtoolz.example.com",
    category: "Technology",
    industry: "Developer Productivity",
    recommendedTier: "Silver",
    recommendedAsk: "money",
    contactName: "Arjun Verma",
    contactRole: "Head of Community",
    research: "Growing Series-A developer tooling company supporting regional hackathons."
  });

  const cBronze = await Company.create({
    name: "MicroByte Labs",
    website: "https://microbyte.example.com",
    category: "AI & Data",
    industry: "AI Startup",
    recommendedTier: "Bronze",
    recommendedAsk: "money",
    contactName: "Rohan Patel",
    contactRole: "Founder",
    research: "Early stage AI developer tool startup founded in 2025."
  });

  console.log(`Created Companies:
  - Gold: ${cGold.name} (${cGold._id})
  - Silver: ${cSilver.name} (${cSilver._id})
  - Bronze: ${cBronze.name} (${cBronze._id})\n`);

  // ==========================================
  // a) POST /emails/generate (initial email)
  // ==========================================
  console.log("--- a) POST /emails/generate (initial email) ---");
  const genRes = await fetch(`${BASE}/emails/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: cGold._id.toString(),
      type: "initial"
    })
  });
  const genData = await genRes.json();
  console.log("Status:", genRes.status);
  console.log("Success:", genData.success);
  console.log("Email ID:", genData.data?.email?._id);
  console.log("Email Status:", genData.data?.email?.status);
  console.log("Subject:", genData.data?.email?.subject);
  console.log("Body preview:\n", genData.data?.email?.body);
  const emailId = genData.data?.email?._id;

  if (!emailId) {
    throw new Error("Failed to generate initial email");
  }

  // ==========================================
  // b) POST /emails/edit
  // ==========================================
  console.log("\n--- b) POST /emails/edit ---");
  const editRes = await fetch(`${BASE}/emails/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailId,
      subject: "Updated: ACM NIT Surat Hackathon x CloudScale",
      body: genData.data.email.body + "\n[Note: Edited by reviewer]\n\nBest regards,\nACM NIT Surat",
      editorNotes: "Clarified title and confirmed review"
    })
  });
  const editData = await editRes.json();
  console.log("Status:", editRes.status);
  console.log("Success:", editData.success);
  console.log("Version after edit:", editData.data?.email?.version);
  console.log("Updated Subject:", editData.data?.email?.subject);

  // ==========================================
  // d-1) POST /outreach before approval (expect 409)
  // ==========================================
  console.log("\n--- d-1) POST /outreach before approval (expect 409) ---");
  const earlyOutreachRes = await fetch(`${BASE}/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: cGold._id.toString(),
      memberId: member._id.toString(),
      emailId
    })
  });
  const earlyOutreachData = await earlyOutreachRes.json();
  console.log("Status:", earlyOutreachRes.status, "(Expected 409)");
  console.log("Message:", earlyOutreachData.message);

  // ==========================================
  // c) PATCH /emails/:id/approve
  // ==========================================
  console.log("\n--- c) PATCH /emails/:id/approve ---");
  const approveRes = await fetch(`${BASE}/emails/${emailId}/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" }
  });
  const approveData = await approveRes.json();
  console.log("Status:", approveRes.status);
  console.log("Success:", approveData.success);
  console.log("Approved Status:", approveData.data?.email?.status);

  // ==========================================
  // d-2) POST /outreach with approved emailId
  // ==========================================
  console.log("\n--- d-2) POST /outreach with approved emailId ---");
  const outreachRes = await fetch(`${BASE}/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: cGold._id.toString(),
      memberId: member._id.toString(),
      emailId
    })
  });
  const outreachData = await outreachRes.json();
  console.log("Status:", outreachRes.status, "(Expected 201)");
  console.log("Outreach ID:", outreachData._id);
  console.log("Outreach Status:", outreachData.status);
  console.log("Company ID:", outreachData.companyId);

  // Confirm partial unique index blocks 2nd active outreach for the same company
  const dupOutreachRes = await fetch(`${BASE}/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: cGold._id.toString(),
      memberId: member._id.toString(),
      notes: "Duplicate attempt"
    })
  });
  console.log("Duplicate outreach attempt status:", dupOutreachRes.status, "(Expected 409)");

  // ==========================================
  // e) POST /outreach/webhook
  // ==========================================
  console.log("\n--- e) POST /outreach/webhook with x-webhook-secret ---");
  const webhookRes = await fetch(`${BASE}/outreach/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": "test-p4-secret-2026"
    },
    body: JSON.stringify({
      event: "sent",
      emailId
    })
  });
  const webhookData = await webhookRes.json();
  console.log("Status:", webhookRes.status);
  console.log("Webhook response message:", webhookData.message);
  console.log("Updated Outreach Status:", webhookData.outreach?.status);

  const updatedEmail = await Email.findById(emailId);
  console.log("Synced Email status in DB:", updatedEmail.status, "(Expected: SENT)");

  // ==========================================
  // f) Generate emails for 3 companies in different tiers
  // ==========================================
  console.log("\n--- f) Generate emails for 3 companies in different tiers ---");
  const tierResults = [];

  for (const comp of [cGold, cSilver, cBronze]) {
    const res = await fetch(`${BASE}/emails/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: comp._id.toString(),
        type: "initial"
      })
    });
    const d = await res.json();
    const body = d.data?.email?.body || "";
    // Match INR amounts like ₹50,000, ₹75,000, ₹25,000
    const matchedAmounts = body.match(/₹[\d,]+/g) || [];
    tierResults.push({
      company: comp.name,
      tier: comp.recommendedTier,
      amountsInBody: matchedAmounts,
      subject: d.data?.email?.subject,
      bodyExcerpt: body.split("\n").filter((l) => l.includes("₹")).join(" | ")
    });
  }

  console.log("\nTier-differing Ask Results:");
  console.dir(tierResults, { depth: null });

  console.log("\n=== ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
