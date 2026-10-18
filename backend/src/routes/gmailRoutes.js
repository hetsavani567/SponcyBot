const express = require("express");
const router = express.Router();

const {
  startOAuth,
  oAuthCallback,
  getOAuthStatus,
  sendEmail,
  getThreadById,
  getInboxMessages,
  classifyReplyHandler,
  confirmReplyHandler,
  getSystemStats,
  runSimulationHandler
} = require("../controllers/gmailController");
const { sendGuard } = require("../middleware/sendGuard");

// ── Phase 1: OAuth ──────────────────────────────────────────────────────────
// Step 1: Browser/Postman hits this to start Gmail consent flow
router.get("/oauth/start", startOAuth);
// Step 2: Google redirects here after user approves
router.get("/oauth/callback", oAuthCallback);
// Health check: is Gmail connected?
router.get("/oauth/status", getOAuthStatus);

// ── Phase 3: Outbound Send (Guarded by sendGuard) ───────────────────────────
// Golden Rule: Only emails with status === "APPROVED" can be sent
router.post("/send", sendGuard, sendEmail);

// ── Phase 4: Thread Inspection, Reply Polling & Human Confirmation ──────────
// Fetch thread for one sponsor
router.get("/thread/:threadId", getThreadById);
router.get("/thread/:id", getThreadById);

// Fetch new messages / replies
router.get("/messages", getInboxMessages);
router.get("/replies", getInboxMessages);

// AI-assisted reply classification
router.post("/replies/classify", classifyReplyHandler);

// Human confirms reply label -> updates Outreach CRM
router.post("/replies/confirm", confirmReplyHandler);

// ── Phase 5: System Dashboard Stats & End-to-End Walkthrough Runner ─────────
// Aggregated stats across the system
router.get("/stats", getSystemStats);

// 12-step end-to-end simulation runner for judge demos
router.post("/demo/simulate-flow", runSimulationHandler);

module.exports = router;
