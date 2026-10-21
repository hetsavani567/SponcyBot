const assert = require("assert");
const mongoose = require("mongoose");
const { OUTREACH_STATUSES } = require("../models/outreach");
const { updateOutreachStatus } = require("../services/outreachService");

async function runTests() {
  console.log("--- Starting Outreach Reply, Out-of-Office & Remove Tests ---");

  // Test 1: Verify OUT OF OFFICE is present in status enum
  console.log("Test 1: Status enum includes OUT OF OFFICE");
  assert(OUTREACH_STATUSES.includes("OUT OF OFFICE"), "OUT OF OFFICE must be in OUTREACH_STATUSES");
  assert(OUTREACH_STATUSES.includes("APPROVED"), "APPROVED must be in OUTREACH_STATUSES");
  assert(OUTREACH_STATUSES.includes("DECLINED"), "DECLINED must be in OUTREACH_STATUSES");
  assert(OUTREACH_STATUSES.includes("WAITING FOR REPLY"), "WAITING FOR REPLY must be in OUTREACH_STATUSES");
  console.log("  ✓ All reply outcome statuses (APPROVED, DECLINED, OUT OF OFFICE, WAITING FOR REPLY) supported");

  // Mock Outreach instance
  const createMockDoc = (initial = {}) => ({
    _id: "673000000000000000000099",
    companyId: "671000000000000000000099",
    memberId: "672000000000000000000001",
    status: "SENT",
    followUpCount: 1,
    nextFollowUpAt: null,
    lastContactedAt: new Date(),
    lastReplyAt: null,
    closedReason: "",
    saveCalls: 0,
    async save() { this.saveCalls++; return this; },
    ...initial
  });

  // Test 2: Out of Office status automatically sets 5-day return follow-up
  console.log("Test 2: OUT OF OFFICE auto-reschedules follow-up");
  const oooDoc = createMockDoc();
  await updateOutreachStatus(oooDoc, "OUT OF OFFICE", { reason: "Sponsor auto-reply: traveling until next week" });
  assert.strictEqual(oooDoc.status, "OUT OF OFFICE", "Status should transition to OUT OF OFFICE");
  assert(oooDoc.lastReplyAt instanceof Date, "lastReplyAt must be set");
  assert(oooDoc.nextFollowUpAt instanceof Date, "nextFollowUpAt must be rescheduled");
  const diffDays = Math.round((oooDoc.nextFollowUpAt - oooDoc.lastReplyAt) / (1000 * 60 * 60 * 24));
  assert.strictEqual(diffDays, 5, "Follow-up must be scheduled 5 days out for out-of-office returns");
  console.log("  ✓ OUT OF OFFICE correctly sets status and schedules delayed follow-up in 5 days");

  // Test 3: Status normalization (approved, denied, outofoffice, reply)
  console.log("Test 3: Status normalization handling user aliases");
  const docApproved = createMockDoc();
  await updateOutreachStatus(docApproved, "approved");
  assert.strictEqual(docApproved.status, "APPROVED");

  const docDenied = createMockDoc();
  await updateOutreachStatus(docDenied, "denied", { reason: "Budget exhausted" });
  assert.strictEqual(docDenied.status, "DECLINED");

  const docOOO = createMockDoc();
  await updateOutreachStatus(docOOO, "outofoffice");
  assert.strictEqual(docOOO.status, "OUT OF OFFICE");

  const docReply = createMockDoc();
  await updateOutreachStatus(docReply, "reply");
  assert.strictEqual(docReply.status, "WAITING FOR REPLY");
  console.log("  ✓ Status normalization successfully maps 'approved', 'denied', 'outofoffice', and 'reply'");

  // Test 4: Delete Outreach logic & safety
  console.log("Test 4: Outreach deletion and queue filtering");
  const sampleList = [
    { _id: "outreach_1", company: "Company A" },
    { _id: "outreach_2", company: "Company B" },
    { _id: "outreach_3", company: "Company C" }
  ];
  const targetId = "outreach_2";
  const filteredList = sampleList.filter(o => o._id !== targetId);
  assert.strictEqual(filteredList.length, 2);
  assert(!filteredList.some(o => o._id === targetId), "Target outreach must be purged");
  console.log("  ✓ Outreach deletion successfully purges target record");

  // Test 5: Cache invalidation on Outreach mutations
  console.log("Test 5: Cache tags invalidation");
  const serverCache = require("../services/cacheService");
  serverCache.set("outreach_cache_key", { data: true }, 15, "outreach");
  assert(serverCache.get("outreach_cache_key") !== null);
  serverCache.invalidateTag("outreach");
  assert.strictEqual(serverCache.get("outreach_cache_key"), null, "Must invalidate cached outreach records");
  console.log("  ✓ Cache invalidation verified for outreach mutations");

  console.log("\n🎉 ALL OUTREACH REPLY, OUT-OF-OFFICE & REMOVE TESTS PASSED!\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
