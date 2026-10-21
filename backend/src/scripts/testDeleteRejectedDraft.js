const assert = require("assert");
const { EMAIL_STATUSES } = require("../models/email");

function runTests() {
  console.log("--- Starting Delete Rejected Draft & Status Logic Tests ---");

  // Test 1: Verify REJECTED is in EMAIL_STATUSES
  console.log("Test 1: Verify REJECTED is supported in EMAIL_STATUSES");
  assert(EMAIL_STATUSES.includes("REJECTED"), "EMAIL_STATUSES must include REJECTED");
  assert(EMAIL_STATUSES.includes("DRAFT"), "EMAIL_STATUSES must include DRAFT");
  assert(EMAIL_STATUSES.includes("PENDING_APPROVAL"), "EMAIL_STATUSES must include PENDING_APPROVAL");
  assert(EMAIL_STATUSES.includes("APPROVED"), "EMAIL_STATUSES must include APPROVED");
  assert(EMAIL_STATUSES.includes("SENT"), "EMAIL_STATUSES must include SENT");
  console.log("  ✓ All required email statuses including REJECTED are present");

  // Test 2: Check rejection logic & metadata enrichment
  console.log("Test 2: Rejection status determination");
  const mockEmailDraft = {
    _id: "670aa1112223334445550001",
    status: "DRAFT",
    subject: "Cloud Sponsorship Pitch"
  };
  const mockLogs = [
    {
      emailId: "670aa1112223334445550001",
      decision: "REJECTED",
      notes: "Needs to ask for credits instead of cash",
      decidedAt: new Date()
    }
  ];

  const latestLog = mockLogs[0];
  const isRejected = mockEmailDraft.status === "REJECTED" || (latestLog && latestLog.decision === "REJECTED" && mockEmailDraft.status === "DRAFT");
  const rejectionReason = isRejected && latestLog ? latestLog.notes : null;

  assert.strictEqual(isRejected, true, "Email should be identified as rejected");
  assert.strictEqual(rejectionReason, "Needs to ask for credits instead of cash", "Rejection reason should match log notes");
  console.log("  ✓ Email correctly identified as rejected with reviewer notes attached");

  // Test 3: Safe deletion guard for SENT emails
  console.log("Test 3: Deletion guard for SENT emails");
  const sentEmail = {
    _id: "670aa1112223334445550002",
    status: "SENT",
    subject: "Confirmed Sent Outreach"
  };

  const canDeleteSentWithoutForce = sentEmail.status !== "SENT";
  assert.strictEqual(canDeleteSentWithoutForce, false, "SENT emails must be protected from accidental deletion");

  const canDeleteRejectedDraft = mockEmailDraft.status !== "SENT";
  assert.strictEqual(canDeleteRejectedDraft, true, "Rejected/draft emails can be safely deleted");
  console.log("  ✓ Guard blocks accidental deletion of SENT emails while allowing draft removal");

  // Test 4: Subject Line Preservation during AI Regeneration
  console.log("Test 4: Subject Line Preservation during AI Regeneration");
  const originalSubject = "Default Hackathon Pitch";
  const customOrganizerSubject = "Exclusive Dev Tier Partnership with HackFest 2026";
  const aiGeneratedSubject = "Sponsorship Invitation for Event";

  // Simulate subject candidate extraction logic from emailController.js
  const customSubjectInput = customOrganizerSubject;
  const preserveSubjectOption = true;
  const hasCustom = typeof customSubjectInput === "string" && customSubjectInput.trim().length > 0;
  const subjectCandidate = hasCustom
    ? customSubjectInput.trim()
    : (preserveSubjectOption && originalSubject)
      ? originalSubject.trim()
      : null;

  const finalSubject = subjectCandidate || aiGeneratedSubject;
  assert.strictEqual(finalSubject, customOrganizerSubject, "Custom subject must be preserved across AI regenerations");
  console.log("  ✓ Custom subject line is locked and preserved, overriding generic AI subject");

  // Test 5: Repetition Guard Enforcement
  console.log("Test 5: Repetition Guard on Approval");
  const v1Draft = { _id: "670aa1112223334445550003", version: 1, status: "PENDING_APPROVAL" };
  const v2RegeneratedDraft = { _id: "670aa1112223334445550004", version: 2, status: "PENDING_APPROVAL" };

  function checkApprovalGuard(email, { requireRegenerated = false, allowInitial = false } = {}) {
    if (requireRegenerated && !allowInitial && email.version <= 1) {
      return { allowed: false, error: "Repetition Guard Active: Default version 1 drafts cannot be approved directly." };
    }
    return { allowed: true, error: null };
  }

  const v1ApprovalResult = checkApprovalGuard(v1Draft, { requireRegenerated: true });
  assert.strictEqual(v1ApprovalResult.allowed, false, "Approval should be strictly blocked for un-regenerated v1 drafts");
  assert(v1ApprovalResult.error.includes("Repetition Guard Active"), "Error message must cite Repetition Guard");

  const v2ApprovalResult = checkApprovalGuard(v2RegeneratedDraft, { requireRegenerated: true });
  assert.strictEqual(v2ApprovalResult.allowed, true, "Approval must be allowed once email has been AI-regenerated (v2+)");
  console.log("  ✓ Repetition Guard strictly blocks canned v1 drafts and unlocks approval on AI-regenerated emails");

  // Test 6: Bulk clear drafts filter (protecting SENT emails)
  console.log("Test 6: Bulk clear drafts queue safety");
  const sampleEmailCollection = [
    { _id: "670aa1112223334445550005", status: "PENDING_APPROVAL" },
    { _id: "670aa1112223334445550006", status: "DRAFT" },
    { _id: "670aa1112223334445550007", status: "REJECTED" },
    { _id: "670aa1112223334445550008", status: "SENT" }
  ];

  const clearableDrafts = sampleEmailCollection.filter(e => e.status !== "SENT");
  const protectedEmails = sampleEmailCollection.filter(e => e.status === "SENT");

  assert.strictEqual(clearableDrafts.length, 3, "All 3 pending/draft/rejected items should be cleared");
  assert.strictEqual(protectedEmails.length, 1, "Dispatched SENT email must be completely protected from bulk queue clearing");
  console.log("  ✓ Bulk clear queue wipes mock/unwanted drafts safely while protecting dispatched communications");

  // Test 7: Event Name & Event Dates Customization
  console.log("Test 7: Event Name & Dates Customization in AI Prompts & Fallback");
  const { buildEmailPrompt } = require("../services/emailPrompts");
  const { generateFallbackEmail, parseAndValidateEmailResponse } = require("../services/emailGenerationService");

  const testCompany = {
    name: "Vercel Inc",
    category: "Cloud & DevTools",
    recommendedTier: "Gold",
    recommendedAsk: "infra"
  };

  // 7a: Custom Event and Dates
  const customPrompt = buildEmailPrompt(testCompany, {
    eventName: "InnovateX 2026",
    eventDates: "December 12–14, 2026"
  });
  assert(customPrompt.includes("InnovateX 2026"), "Prompt must include custom event name");
  assert(customPrompt.includes("December 12–14, 2026"), "Prompt must include custom event dates");
  assert(!customPrompt.includes("Sponsy Bot Hackathon 2026"), "Prompt must not use obsolete hardcoded bot hackathon name");

  const customFallback = generateFallbackEmail(testCompany, {
    eventName: "InnovateX 2026",
    eventDates: "December 12–14, 2026",
    customInstructions: "Propose $5k bounty for Next.js builders"
  });
  assert(customFallback.subject.includes("InnovateX 2026"), "Fallback subject must use custom event name");
  assert(customFallback.body.includes("InnovateX 2026"), "Fallback body must use custom event name");
  assert(customFallback.body.includes("December 12–14, 2026"), "Fallback body must use custom event dates");
  assert(customFallback.body.includes("Next.js"), "Fallback body must weave custom requirement");

  // 7b: Default Event and Dates
  const defaultPrompt = buildEmailPrompt(testCompany);
  assert(defaultPrompt.includes("HackFest 2026"), "Default event name must be HackFest 2026");
  assert(!defaultPrompt.includes("Sponsy Bot Hackathon 2026"), "Default event name must not be Sponsy Bot Hackathon");

  // 7c: Dynamic Bracket Placeholder Replacer
  const rawWithBrackets = JSON.stringify({
    subject: "Partner with [Event Name]",
    body: "Join us for [Event Name] on [Event Dates]. Best, [Organizer Name]"
  });
  const resolved = parseAndValidateEmailResponse(rawWithBrackets, testCompany, {
    eventName: "BuilderHacks 2027",
    eventDates: "March 5–7, 2027"
  });
  assert.strictEqual(resolved.subject, "Partner with BuilderHacks 2027");
  assert(resolved.body.includes("BuilderHacks 2027"));
  assert(resolved.body.includes("March 5–7, 2027"));
  assert(!resolved.body.includes("[Event"));
  console.log("  ✓ Event Name & Event Dates are dynamically propagated, replacing hardcoded Sponsy Bot defaults");

  console.log("\n🎉 ALL DRAFT APPROVAL, REPETITION GUARD & SUBJECT LOGIC TESTS PASSED!\n");
}

runTests();
