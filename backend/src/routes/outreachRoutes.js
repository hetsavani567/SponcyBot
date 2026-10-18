const express = require("express");
const router = express.Router();

const {
  createOutreach,
  getAllOutreach,
  getPendingFollowUps,
  getOutreachById,
  registerFollowUp,
  closeOutreachHandler,
  updateStatusHandler,
  getCommsHistory,
  getDashboardStatsHandler,
  handleGmailWebhook
} = require("../controllers/outreachController");

// Exact routes first (to prevent :id collision)
router.get("/pending-followups", getPendingFollowUps);
router.get("/history", getCommsHistory);
router.get("/stats", getDashboardStatsHandler);
router.post("/webhook", handleGmailWebhook);

// Collection routes
router.get("/", getAllOutreach);
router.post("/", createOutreach);

// Parameterized item routes
router.get("/:id", getOutreachById);
router.post("/:id/followup", registerFollowUp);
router.post("/:id/close", closeOutreachHandler);
router.patch("/:id/status", updateStatusHandler);
router.post("/:id/status", updateStatusHandler); // also support POST for convenience

module.exports = router;
