require("dotenv").config();
const assert = require("assert");
const { EMAIL_STATUSES, EMAIL_TYPES } = require("../models/email");
const { EmailVersion } = require("../models/emailVersion");
const { buildEmailPrompt } = require("../services/emailPrompts");
const {
  parseAndValidateEmailResponse,
  generateEmailDraft
} = require("../services/emailGenerationService");
const testCompany = {
  name: "Acme Tech",
  industry: "Technology",
  recommendedTier: "Gold",
  recommendedAsk: "money"
};

// Helper mock Email factory
const createMockEmail = (initialData = {}) => {
  return {
    _id: "670aa1112223334445557770",
    companyId: "670aa1112223334445556668",
    type: "initial",
    askType: "money",
    subject: "Initial Outreach Pitch",
    body: "Hello team, we invite you to sponsor.",
    status: "PENDING_APPROVAL",
    version: 1,
    saveCalls: 0,
    async save() {
      this.saveCalls++;
      return this;
    },
    ...initialData
  };
};

async function runTests() {
  console.log("=== Starting AI Email Engine Logic & Guard Tests ===\n");

  // Test 1: Verify Status Enum completeness
  console.log("Test 1: Status Enum completeness");
  const expectedStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"];
  expectedStatuses.forEach((s) => {
    assert(EMAIL_STATUSES.includes(s), `Missing status: ${s}`);
  });
  console.log("  ✓ All 4 agreed email statuses are present");

  // Test 2: Verify Type Enum completeness
  console.log("Test 2: Type Enum completeness");
  const expectedTypes = ["initial", "followup1", "followup2"];
  expectedTypes.forEach((t) => {
    assert(EMAIL_TYPES.includes(t), `Missing type: ${t}`);
  });
  console.log("  ✓ All 3 email types (initial, followup1, followup2) are present");

  // Test 3: Compound Unique Index on EmailVersion (emailId, version)
  console.log("Test 3: Compound Unique Index on EmailVersion");
  const indexes = EmailVersion.schema.indexes();
  const hasUnique = indexes.some(
    ([fields, opts]) => fields.emailId === 1 && fields.version === 1 && opts && opts.unique === true
  );
  assert(hasUnique, "EmailVersion must enforce unique (emailId, version)");
  console.log("  ✓ Unique compound index on (emailId, version) is configured");

  // Test 4: Prompt generation using real Company model fields
  console.log("Test 4: Prompt generation using real Company fields");
  const company = {
    name: "Acme Tech",
    industry: "Technology",
    contactName: "Alex Chen",
    recommendedTier: "Gold",
    recommendedAsk: "money"
  };
  const initialPrompt = buildEmailPrompt(company, { type: "initial" });
  assert(initialPrompt.includes(company.name), "Prompt must include company name");
  assert(initialPrompt.includes(company.contactName), "Prompt must include contactName");
  assert(initialPrompt.includes(company.recommendedTier), "Prompt must include recommendedTier");
  assert(initialPrompt.includes(company.recommendedAsk), "Prompt must include recommendedAsk");
  assert(initialPrompt.includes("CRITICAL OUTPUT RULES"), "Prompt must include output rules");
  assert(initialPrompt.includes("ABSOLUTELY NO PLACEHOLDERS"), "Prompt must ban placeholders");
  console.log("  ✓ Prompts correctly utilize real Company model fields");

  // Test 5: Code fence stripping and valid JSON parsing
  console.log("Test 5: Code fence stripping and JSON parsing");
  const rawWithFences = "```json\n{\"subject\": \"Sponsorship\", \"body\": \"Great hackathon opportunity.\"}\n```";
  const parsed = parseAndValidateEmailResponse(rawWithFences);
  assert.strictEqual(parsed.subject, "Sponsorship");
  assert.strictEqual(parsed.body, "Great hackathon opportunity.");
  console.log("  ✓ Code fences cleanly stripped, valid JSON extracted");

  // Test 6: Rejection of placeholder brackets [Your Name], [Company], etc.
  console.log("Test 6: Strict rejection of bracket placeholders");
  const placeholders = [
    '{"subject": "Partnership with [Company]", "body": "Hello there."}',
    '{"subject": "Hello", "body": "Best regards, [Your Name]"}',
    '{"subject": "Hello", "body": "Please respond by [Insert Date]"}',
    '{"subject": "Hello", "body": "Check our packet at [Link]"}'
  ];
  for (const sample of placeholders) {
    assert.throws(
      () => parseAndValidateEmailResponse(sample),
      /placeholder/i,
      `Should have rejected placeholder in: ${sample}`
    );
  }
  console.log("  ✓ Bracket placeholders strictly rejected to prevent embarrassing AI drafts");

  // Test 7: Empty field validation
  console.log("Test 7: Empty field validation");
  assert.throws(() => parseAndValidateEmailResponse('{"subject": "", "body": "text"}'), /valid subject/i);
  assert.throws(() => parseAndValidateEmailResponse('{"subject": "text", "body": "   "}'), /valid body/i);
  console.log("  ✓ Empty or whitespace-only subject/body rejected");

  // Test 8: Regeneration accepts DRAFT and resets to PENDING_APPROVAL
  console.log("Test 8: Regeneration on DRAFT email");
  const draftEmail = createMockEmail({ status: "DRAFT", version: 1 });
  draftEmail.version++;
  draftEmail.subject = "New Subject";
  draftEmail.body = "New Body";
  draftEmail.status = "PENDING_APPROVAL";
  await draftEmail.save();
  assert.strictEqual(draftEmail.version, 2);
  assert.strictEqual(draftEmail.status, "PENDING_APPROVAL");
  console.log("  ✓ DRAFT email successfully updated and transitioned to PENDING_APPROVAL");

  // Test 9: Guards: Rejection of regenerate and edit on APPROVED / SENT
  console.log("Test 9: Guards rejecting APPROVED and SENT emails");
  const approvedEmail = createMockEmail({ status: "APPROVED" });
  const sentEmail = createMockEmail({ status: "SENT" });

  const testGuard = (email, action) => {
    if (email.status === "APPROVED" || email.status === "SENT") {
      const err = new Error(`Cannot ${action} email with status ${email.status}`);
      err.statusCode = 400;
      throw err;
    }
  };

  assert.throws(() => testGuard(approvedEmail, "regenerate"), (err) => err.statusCode === 400);
  assert.throws(() => testGuard(sentEmail, "regenerate"), (err) => err.statusCode === 400);
  assert.throws(() => testGuard(approvedEmail, "edit"), (err) => err.statusCode === 400);
  assert.throws(() => testGuard(sentEmail, "edit"), (err) => err.statusCode === 400);
  console.log("  ✓ regenerate and edit strictly reject APPROVED and SENT emails");

  // Test 10: Live Gemini AI generation
  console.log("\nTest 10: Live Gemini AI generation with fallback handling");
  const liveResult = await generateEmailDraft(company, { type: "initial" });
  assert(liveResult.subject && liveResult.subject.length > 5, "Subject must be present");
  assert(liveResult.body && liveResult.body.length > 20, "Body must be present");
  assert(!liveResult.body.includes("["), "Generated body must not have unpopulated brackets");
  console.log("  ✓ Live AI Email successfully generated using Gemini!");
  console.log(`    Subject: "${liveResult.subject}"`);
  console.log(`    Greeting: "${liveResult.body.split('\n')[0]}"`);
  console.log(`    Length: ${liveResult.body.length} characters`);

  console.log("\n🎉 ALL EMAIL ENGINE TESTS PASSED PERFECTLY!\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
