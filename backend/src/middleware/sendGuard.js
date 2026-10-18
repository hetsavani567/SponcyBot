const { assertEmailApproved } = require("../services/approvalService");

/**
 * Send Guard Middleware:
 * Gating middleware for any outbound sending endpoint (e.g. POST /gmail/send).
 *
 * Golden Rule: AI draft -> Human reviews -> Human approves -> Gmail sends.
 * Refuses ANY email that is not strictly in "APPROVED" status.
 */
const sendGuard = async (req, res, next) => {
  try {
    const emailId =
      req.body?.emailId ||
      req.params?.emailId ||
      req.params?.id ||
      req.query?.emailId;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        code: "SEND_GUARD_MISSING_EMAIL_ID",
        message: "Send Guard: 'emailId' is required to send an email."
      });
    }

    // assertEmailApproved will throw 400 (invalid format), 404 (not found), or 403 (not approved)
    const approvedEmail = await assertEmailApproved(emailId);

    // Attach to request object so downstream controllers can use it without redundant DB query
    req.approvedEmail = approvedEmail;

    return next();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.statusCode === 403 ? "SEND_GUARD_FORBIDDEN" : "SEND_GUARD_ERROR",
      message: error.message,
      currentStatus: error.currentStatus || null
    });
  }
};

module.exports = {
  sendGuard
};
