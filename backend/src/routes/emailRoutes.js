const express = require("express");
const router = express.Router();
const {
  generateEmail,
  regenerateEmail,
  editEmail,
  getEmail,
  getPendingApprovalEmails,
  listEmails,
  approveEmail,
  rejectEmail,
  getEmailApprovalLogs
} = require("../controllers/emailController");

// AI Email Generation endpoints
router.post("/generate", generateEmail);
router.post("/regenerate", regenerateEmail);
router.post("/edit", editEmail);
router.get("/pending-approval", getPendingApprovalEmails);

// Approval Queue endpoints (support both POST and PATCH per slide spec)
router.post("/:id/approve", approveEmail);
router.patch("/:id/approve", approveEmail);
router.post("/:id/reject", rejectEmail);
router.patch("/:id/reject", rejectEmail);
router.get("/:id/approval-history", getEmailApprovalLogs);

router.get("/:id", getEmail);
router.get("/", listEmails);

module.exports = router;
