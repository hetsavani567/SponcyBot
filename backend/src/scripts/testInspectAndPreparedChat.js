const assert = require("assert");
const { getThreadById, sendThreadReply, simulateThreadReply } = require("../controllers/gmailController");
const Company = require("../models/company");
const { GmailThread } = require("../models/gmailThread");
const { Outreach } = require("../models/outreach");

async function runTests() {
  console.log("--- Starting Inspect & Prepared Chat Verification ---");

  // Test 1: getThreadById with a company that has no thread yet
  const testCompId = "671000000000000000000099";
  const mockReq = {
    params: { threadId: `thread_${testCompId}` },
    query: { mock: "true" }
  };

  let responseData = null;
  let statusCode = 200;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    }
  };

  // Run getThreadById
  await getThreadById(mockReq, mockRes);
  console.log("Test 1: getThreadById for unknown thread returns 404 or prepared thread, not mock GitHub");
  if (statusCode === 404) {
    console.log("  ✓ Correctly returns 404 instead of falling back to default mock thread!");
  } else {
    assert.notStrictEqual(responseData?.data?.thread?.companyId?.name, "GitHub", "Should NOT fall back to mock GitHub thread");
    console.log("  ✓ Does not fall back to mock GitHub thread!");
  }

  // Test 2: sendThreadReply for a newly prepared company thread creates real thread in memory/DB
  const replyReq = {
    params: { threadId: `thread_${testCompId}` },
    body: {
      body: "Hi Team, we would love to partner for HackFest 2026!",
      subject: "HackFest 2026 Sponsorship",
      recipientEmail: "test@sponsor.com",
      senderName: "Het Savani",
      companyId: testCompId
    }
  };

  let replyResData = null;
  const replyRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      replyResData = payload;
      return this;
    }
  };

  await sendThreadReply(replyReq, replyRes);
  assert.strictEqual(statusCode, 200, "sendThreadReply should return 200");
  assert.strictEqual(replyResData?.success, true, "sendThreadReply should succeed");
  assert.strictEqual(replyResData?.data?.thread?.threadId, `thread_${testCompId}`, "Should create thread with target threadId");
  assert.strictEqual(replyResData?.data?.thread?.messages?.length, 1, "Thread should have 1 message");
  assert.strictEqual(replyResData?.data?.message?.body, "Hi Team, we would love to partner for HackFest 2026!", "Message body must match");
  console.log("  ✓ Successfully created and dispatched reply in prepared thread!");

  // Test 3: simulateThreadReply on the newly created thread
  const simReq = {
    params: { threadId: `thread_${testCompId}` },
    body: {
      replyText: "We would love to partner as a Gold sponsor and give 500 cloud credits!",
      sentiment: "interested",
      sponsorEmail: "test@sponsor.com",
      companyId: testCompId
    }
  };

  let simResData = null;
  const simRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      simResData = payload;
      return this;
    }
  };

  await simulateThreadReply(simReq, simRes);
  assert.strictEqual(statusCode, 200, "simulateThreadReply should return 200");
  assert.strictEqual(simResData?.success, true, "simulateThreadReply should succeed");
  assert.strictEqual(simResData?.data?.classification?.suggestedLabel, "INTERESTED", "AI should classify reply as INTERESTED");
  assert.strictEqual(simResData?.data?.thread?.messages?.length, 2, "Thread should now have 2 messages");
  // Test 4: Outreach CRM record presence
  console.log("Test 4: Outreach record automatically created and linked to CRM");
  const { defaultOutreaches } = require("../services/seedDataService");
  const crmRecord = defaultOutreaches.find(o => String(o.companyId?._id || o.companyId?.id || o.companyId) === String(testCompId) || o.threadId === `thread_${testCompId}`);
  assert(crmRecord, "Outreach record must be present in CRM after sending outreach from Thread & Details");
  assert(crmRecord.status === "WAITING FOR REPLY" || crmRecord.status === "INTERESTED", "Status should reflect conversation state");
  console.log("  ✓ Outreach record successfully appears in CRM from Thread & Details!");

  // Test 5: Send second organizer message (allowed: 2/3 quota -> FOLLOW-UP 1)
  console.log("Test 5: Second organizer follow-up message allowed (2/3 quota)");
  const replyReq2 = {
    params: { threadId: `thread_${testCompId}` },
    body: {
      body: "Following up on the Google Meet link for HackFest 2026!",
      subject: "HackFest 2026 Sponsorship",
      recipientEmail: "test@sponsor.com",
      senderName: "Het Savani",
      companyId: testCompId
    }
  };
  let reply2ResData = null;
  const reply2Res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      reply2ResData = payload;
      return this;
    }
  };
  await sendThreadReply(replyReq2, reply2Res);
  assert.strictEqual(statusCode, 200, "Second message should succeed");
  assert.strictEqual(reply2ResData?.success, true);
  assert.strictEqual(crmRecord.status, "FOLLOW-UP 1", "CRM status should advance to FOLLOW-UP 1");
  assert.strictEqual(crmRecord.followUpCount, 1, "Follow-up count should be 1");
  console.log("  ✓ Second message successfully dispatched within quota (2/3 sent, CRM: FOLLOW-UP 1)!");

  // Test 6: Send third organizer message (allowed: 3/3 quota -> FOLLOW-UP 2)
  console.log("Test 6: Third organizer follow-up message allowed (3/3 quota)");
  const replyReq3 = {
    params: { threadId: `thread_${testCompId}` },
    body: {
      body: "Final follow-up regarding our hackathon tracks and prospectus.",
      subject: "HackFest 2026 Sponsorship",
      recipientEmail: "test@sponsor.com",
      senderName: "Het Savani",
      companyId: testCompId
    }
  };
  let reply3ResData = null;
  const reply3Res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      reply3ResData = payload;
      return this;
    }
  };
  await sendThreadReply(replyReq3, reply3Res);
  assert.strictEqual(statusCode, 200, "Third message should succeed");
  assert.strictEqual(reply3ResData?.success, true);
  assert.strictEqual(crmRecord.status, "FOLLOW-UP 2", "CRM status should advance to FOLLOW-UP 2");
  assert.strictEqual(crmRecord.followUpCount, 2, "Follow-up count should be 2");
  console.log("  ✓ Third message successfully dispatched within quota (3/3 sent, CRM: FOLLOW-UP 2)!");

  // Test 7: Fourth organizer message attempt STRICTLY BLOCKED (limit reached)
  console.log("Test 7: Fourth organizer message attempt strictly blocked (3-message limit)");
  const replyReq4 = {
    params: { threadId: `thread_${testCompId}` },
    body: {
      body: "4th follow up email attempt...",
      subject: "HackFest 2026 Sponsorship",
      recipientEmail: "test@sponsor.com",
      senderName: "Het Savani",
      companyId: testCompId
    }
  };
  let reply4ResData = null;
  let code4 = 200;
  const reply4Res = {
    status(code) {
      code4 = code;
      return this;
    },
    json(payload) {
      reply4ResData = payload;
      return this;
    }
  };
  await sendThreadReply(replyReq4, reply4Res);
  assert.strictEqual(code4, 400, "Fourth message must be blocked with 400");
  assert.strictEqual(reply4ResData?.success, false);
  assert(reply4ResData?.message.includes("Outreach limit reached: You can only send up to 3 messages"), "Must return deliverability protection error");
  console.log("  ✓ Fourth message strictly blocked! 3-message limit enforced successfully.");

  // Test 8: Verify Gemini Intent Classification buttons are removed from DetailsTab.jsx
  console.log("Test 8: Verify Gemini Intent Classification buttons removed from DetailsTab.jsx");
  const fs = require("fs");
  const path = require("path");
  const detailsTabPath = path.join(__dirname, "../../../frontend/src/components/DetailsTab.jsx");
  const detailsSource = fs.readFileSync(detailsTabPath, "utf8");
  assert(!detailsSource.includes("Confirm: Sponsor Interested & Book Meeting"), "Should not contain 'Confirm: Sponsor Interested & Book Meeting' button");
  assert(!detailsSource.includes("Confirm: Declined (Close)"), "Should not contain 'Confirm: Declined (Close)' button");
  assert(detailsSource.includes("Gemini Intent Classification"), "Should preserve Gemini Intent Classification label");
  console.log("  ✓ Gemini Intent Classification buttons successfully removed!");

  // Test 9: Verify TutorialModal component exists and has 5 complete workflow steps
  console.log("Test 9: Verify TutorialModal.jsx and complete workflow basics");
  const tutorialPath = path.join(__dirname, "../../../frontend/src/components/modals/TutorialModal.jsx");
  assert(fs.existsSync(tutorialPath), "TutorialModal.jsx must exist");
  const tutorialSource = fs.readFileSync(tutorialPath, "utf8");
  assert(tutorialSource.includes("TUTORIAL_STEPS"), "Must define TUTORIAL_STEPS");
  assert(tutorialSource.includes("Sponsors Directory"), "Must guide on Sponsors Directory");
  assert(tutorialSource.includes("Approval Queue"), "Must guide on Approval Queue");
  assert(tutorialSource.includes("Thread & Details"), "Must guide on Thread & Details");
  assert(tutorialSource.includes("Outreach CRM"), "Must guide on Outreach CRM");
  assert(tutorialSource.includes("3-Message"), "Must explain 3-message limit to user");
  console.log("  ✓ TutorialModal verified with complete 5-step workflow walkthrough!");

  console.log("\n🎉 ALL INSPECT, 3-MESSAGE LIMIT, CRM SYNC & TUTORIAL TESTS PASSED!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
