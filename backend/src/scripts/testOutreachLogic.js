const assert = require("assert");
const { OUTREACH_STATUSES } = require("../models/outreach");
const {
  calculateNextFollowUpDate,
  processFollowUp,
  closeOutreach,
  updateOutreachStatus
} = require("../services/outreachService");

// Mock Outreach model instance
const createMockOutreach = (initialData = {}) => {
  const doc = {
    _id: "670aa1112223334445556667",
    companyId: "670aa1112223334445556668",
    memberId: "670aa1112223334445556669",
    status: "SENT",
    followUpCount: 0,
    nextFollowUpAt: null,
    lastContactedAt: null,
    closedReason: "",
    saveCalls: 0,
    async save() {
      this.saveCalls++;
      return this;
    },
    ...initialData
  };
  return doc;
};

async function runTests() {
  console.log("--- Starting Outreach CRM Logic Tests ---");

  // Test 1: Verify Status Enum completeness
  console.log("Test 1: Status Enum completeness");
  const expectedStatuses = [
    "DRAFT", "APPROVED", "SENT", "WAITING FOR REPLY", "INTERESTED",
    "MEETING", "DECLINED", "NO REPLY", "FOLLOW-UP 1", "FOLLOW-UP 2", "CLOSED"
  ];
  expectedStatuses.forEach(s => {
    assert(OUTREACH_STATUSES.includes(s), `Missing status: ${s}`);
  });
  console.log("  ✓ All 11 agreed statuses are present");

  // Test 2: Follow-up 1
  console.log("Test 2: Follow-up 1 registration");
  const outreach1 = createMockOutreach({ status: "WAITING FOR REPLY", followUpCount: 0 });
  const updated1 = await processFollowUp(outreach1, { notes: "Sent follow-up 1" });
  assert.strictEqual(updated1.followUpCount, 1, "Follow-up count should be 1");
  assert.strictEqual(updated1.status, "FOLLOW-UP 1", "Status should be FOLLOW-UP 1");
  assert(updated1.nextFollowUpAt instanceof Date, "nextFollowUpAt should be scheduled");
  console.log("  ✓ Follow-up 1 correctly increments count, updates status, and schedules next follow-up");

  // Test 3: Follow-up 2
  console.log("Test 3: Follow-up 2 registration (Final allowed)");
  const outreach2 = createMockOutreach({ status: "FOLLOW-UP 1", followUpCount: 1 });
  const updated2 = await processFollowUp(outreach2, { notes: "Sent follow-up 2" });
  assert.strictEqual(updated2.followUpCount, 2, "Follow-up count should be 2");
  assert.strictEqual(updated2.status, "FOLLOW-UP 2", "Status should be FOLLOW-UP 2");
  assert.strictEqual(updated2.nextFollowUpAt, null, "nextFollowUpAt should be null after follow-up 2");
  console.log("  ✓ Follow-up 2 correctly sets limit and nullifies nextFollowUpAt");

  // Test 4: Follow-up 3 BLOCKED (Max 2 Rule Enforced)
  console.log("Test 4: Follow-up 3 attempt (Strict Block & Auto-Close)");
  const outreach3 = createMockOutreach({ status: "FOLLOW-UP 2", followUpCount: 2 });
  let blocked = false;
  try {
    await processFollowUp(outreach3, { notes: "Attempting follow-up 3" });
  } catch (err) {
    blocked = true;
    assert.strictEqual(err.statusCode, 400, "Should return status code 400");
    assert(err.message.includes("Maximum follow-ups (2) reached"), "Error should explain max 2 follow-ups reached");
    assert.strictEqual(outreach3.status, "CLOSED", "Status should transition to CLOSED");
    assert(outreach3.closedReason.includes("MAX_FOLLOWUPS_REACHED"), "closedReason should indicate max follow-ups");
  }
  assert(blocked, "Follow-up 3 MUST be blocked and throw an error");
  console.log("  ✓ 3rd follow-up attempt was strictly blocked, outreach auto-closed, spam prevented!");

  // Test 5: Close Outreach
  console.log("Test 5: Close outreach manually");
  const outreach4 = createMockOutreach({ status: "WAITING FOR REPLY" });
  await closeOutreach(outreach4, "Budget declined");
  assert.strictEqual(outreach4.status, "CLOSED");
  assert.strictEqual(outreach4.closedReason, "Budget declined");
  assert.strictEqual(outreach4.nextFollowUpAt, null);
  console.log("  ✓ Close outreach properly sets status and reason");

  // Test 6: Move to Meeting
  console.log("Test 6: Move interested sponsor to Meeting");
  const outreach5 = createMockOutreach({ status: "INTERESTED" });
  await updateOutreachStatus(outreach5, "MEETING", {
    meetingLink: "https://meet.google.com/xyz-123",
    meetingScheduledAt: new Date()
  });
  assert.strictEqual(outreach5.status, "MEETING");
  assert.strictEqual(outreach5.meetingLink, "https://meet.google.com/xyz-123");
  console.log("  ✓ Meeting booked transition verified");

  console.log("\n🎉 ALL OUTREACH CRM LOGIC TESTS PASSED!");
}

runTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
