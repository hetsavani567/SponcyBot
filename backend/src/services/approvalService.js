const mongoose = require("mongoose");
const { Email } = require("../models/email");
const { ApprovalLog } = require("../models/approvalLog");

/**
 * Record an approval or rejection event in the audit trail.
 */
const logApproval = async ({
  emailId,
  companyId = null,
  decision,
  reviewerName = "Human Reviewer",
  notes = ""
}) => {
  return await ApprovalLog.create({
    emailId,
    companyId,
    decision,
    reviewerName,
    notes,
    decidedAt: new Date()
  });
};

/**
 * Send Guard assertion:
 * Strictly checks that an email exists and its status is exactly "APPROVED".
 * Throws 404 if not found, or 403 Forbidden if not approved.
 */
const assertEmailApproved = async (emailId) => {
  if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
    const error = new Error("Invalid or missing emailId");
    error.statusCode = 400;
    throw error;
  }

  const email = await Email.findById(emailId);
  if (!email) {
    const error = new Error(`Email not found: ${emailId}`);
    error.statusCode = 404;
    throw error;
  }

  if (email.status !== "APPROVED") {
    const error = new Error(
      `Send Guard Blocked: Email status is "${email.status}". ONLY emails with status "APPROVED" can be sent.`
    );
    error.statusCode = 403;
    error.currentStatus = email.status;
    throw error;
  }

  return email;
};

/**
 * Performs email approval and records the audit log in a single transaction-like flow.
 */
const approveEmailWithLog = async ({
  emailId,
  reviewerName = "Human Reviewer",
  notes = ""
}) => {
  if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
    const error = new Error("Invalid email ID format");
    error.statusCode = 400;
    throw error;
  }

  const email = await Email.findById(emailId);
  if (!email) {
    const error = new Error("Email not found");
    error.statusCode = 404;
    throw error;
  }

  if (email.status === "APPROVED") {
    return { email, log: null };
  }

  if (email.status === "SENT") {
    const error = new Error("Cannot approve an email that has already been dispatched via Gmail");
    error.statusCode = 409;
    throw error;
  }

  email.status = "APPROVED";
  await email.save();

  const log = await logApproval({
    emailId: email._id,
    companyId: email.companyId,
    decision: "APPROVED",
    reviewerName,
    notes
  });

  return { email, log };
};

/**
 * Performs email rejection (moving back to DRAFT for rewrite) and records the audit log.
 */
const rejectEmailWithLog = async ({
  emailId,
  reviewerName = "Human Reviewer",
  reason = "",
  notes = ""
}) => {
  if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
    const error = new Error("Invalid email ID format");
    error.statusCode = 400;
    throw error;
  }

  const email = await Email.findById(emailId);
  if (!email) {
    const error = new Error("Email not found");
    error.statusCode = 404;
    throw error;
  }

  if (email.status === "SENT") {
    const error = new Error("Cannot reject an email that has already been dispatched via Gmail");
    error.statusCode = 409;
    throw error;
  }

  const combinedNotes = reason || notes || "Rejected by reviewer";
  email.status = "DRAFT";
  await email.save();

  const log = await logApproval({
    emailId: email._id,
    companyId: email.companyId,
    decision: "REJECTED",
    reviewerName,
    notes: combinedNotes
  });

  return { email, log, reason: combinedNotes };
};

/**
 * Retrieve approval history for a given email.
 */
const getApprovalHistory = async (emailId) => {
  return await ApprovalLog.find({ emailId }).sort({ decidedAt: -1 });
};

module.exports = {
  logApproval,
  assertEmailApproved,
  approveEmailWithLog,
  rejectEmailWithLog,
  getApprovalHistory
};
