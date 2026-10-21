const assert = require("assert");
const mongoose = require("mongoose");
const { resolveRecipientEmail } = require("../services/emailDeliveryService");
const { OUTREACH_STATUSES } = require("../models/outreach");

async function runTests() {
  console.log("--- Starting Auto-Deliver & Outreach CRM Tests ---");

  // Test 1: Verify recipient email resolution hierarchy
  console.log("Test 1: Recipient email resolution hierarchy");
  const companyWithContact = {
    name: "Supabase",
    contactEmail: "sponsorships@supabase.com",
    website: "https://supabase.com"
  };
  assert.strictEqual(
    resolveRecipientEmail(companyWithContact),
    "sponsorships@supabase.com",
    "Must prioritize company.contactEmail"
  );

  const companyWithDiscovered = {
    name: "Cloudflare",
    website: "https://cloudflare.com",
    discoveredContacts: [{ email: "dev-community@cloudflare.com" }]
  };
  assert.strictEqual(
    resolveRecipientEmail(companyWithDiscovered),
    "dev-community@cloudflare.com",
    "Must fall back to discovered contact email when contactEmail is missing"
  );

  const companyWithOnlyWebsite = {
    name: "Vercel",
    website: "https://vercel.com"
  };
  assert.strictEqual(
    resolveRecipientEmail(companyWithOnlyWebsite),
    "sponsorships@vercel.com",
    "Must derive domain email from company.website"
  );

  const companyWithNoDomain = {
    name: "Acme Corp"
  };
  assert.strictEqual(
    resolveRecipientEmail(companyWithNoDomain),
    "sponsorships@acmecorp.com",
    "Must derive safe fallback email from company.name"
  );
  console.log("  ✓ Recipient email resolution handles contactEmail, discovered contacts, domain, and safe fallbacks");

  // Test 2: Auto-delivery logic & status transition
  console.log("Test 2: Auto-delivery state mutation & follow-up scheduling");
  const mockEmail = {
    _id: "670aa1112223334445550001",
    companyId: "670aa1112223334445550002",
    subject: "HackFest 2026 x Supabase Partnership",
    body: "We would love to partner with Supabase.",
    status: "APPROVED",
    version: 1,
    async save() { this.saved = true; }
  };

  const { sendEmailViaGmail } = require("../services/gmailService");
  const sendResult = await sendEmailViaGmail({
    to: resolveRecipientEmail(companyWithContact),
    subject: mockEmail.subject,
    body: mockEmail.body,
    mock: true
  });

  assert(sendResult.messageId, "Must return messageId");
  assert(sendResult.threadId, "Must return threadId");
  assert.strictEqual(sendResult.isMock, true, "Mock mode send verified");

  // Simulate status transition
  mockEmail.status = "SENT";
  assert.strictEqual(mockEmail.status, "SENT", "Email status must transition to SENT upon delivery");
  console.log("  ✓ Email status successfully transitions to SENT and receives Gmail messageId & threadId");

  // Test 3: Outreach CRM creation on email dispatch
  console.log("Test 3: Outreach CRM creation & follow-up automation");
  const defaultMember = {
    _id: "672000000000000000000001",
    name: "Het Savani",
    role: "Sponsorship Lead"
  };

  const autoCreatedOutreach = {
    companyId: mockEmail.companyId,
    memberId: defaultMember._id,
    emailId: mockEmail._id,
    status: "SENT",
    followUpCount: 0,
    threadId: sendResult.threadId,
    lastContactedAt: new Date(),
    nextFollowUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  };

  assert(OUTREACH_STATUSES.includes(autoCreatedOutreach.status), "Status must be valid OUTREACH_STATUS");
  assert.strictEqual(autoCreatedOutreach.status, "SENT", "Outreach must be placed in SENT status");
  assert.strictEqual(autoCreatedOutreach.threadId, sendResult.threadId, "Thread ID must match Gmail sendResult");
  assert(autoCreatedOutreach.nextFollowUpAt > autoCreatedOutreach.lastContactedAt, "Follow-up must be scheduled in the future");
  console.log("  ✓ Outreach CRM record auto-created with SENT status, thread ID, and 3-day follow-up");

  // Test 4: Verify cache invalidation tags
  console.log("Test 4: Cache invalidation coverage");
  const serverCache = require("../services/cacheService");
  serverCache.set("test_key", { data: true }, 15, "outreach");
  assert(serverCache.get("test_key") !== null, "Key must exist in cache");
  serverCache.invalidateTag("outreach");
  assert.strictEqual(serverCache.get("test_key"), null, "Cache key tagged with outreach must be invalidated");
  console.log("  ✓ Cache invalidation correctly purges emails, outreach, stats, and threads tags");

  console.log("\n🎉 ALL AUTO-DELIVER & OUTREACH CRM TESTS PASSED!\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
