const { Email } = require("../models/email");
const { EmailVersion } = require("../models/emailVersion");

/**
 * Creates the initial Email document and records version 1.
 */
async function createInitialEmail({
  companyId,
  type = "initial",
  askType = "money",
  subject,
  body,
  promptUsed = "",
  status = "PENDING_APPROVAL",
  customInstructions = "",
  isCustomized = false,
  eventName = "HackFest 2026",
  eventDates = "November 14–16, 2026"
}) {
  const hasCustomReq = Boolean(isCustomized || (customInstructions && customInstructions.trim()));
  const email = new Email({
    companyId,
    type,
    askType,
    subject,
    body,
    status,
    version: 1,
    customInstructions: customInstructions ? customInstructions.trim() : "",
    isCustomized: hasCustomReq,
    eventName: (eventName && eventName.trim()) || "HackFest 2026",
    eventDates: (eventDates && eventDates.trim()) || "November 14–16, 2026"
  });

  await email.save();

  const emailVersion = new EmailVersion({
    emailId: email._id,
    version: 1,
    subject,
    body,
    type,
    source: "ai",
    promptUsed,
    notes: hasCustomReq ? `Initial AI draft (Requirement: ${customInstructions.slice(0, 40)})` : "Initial AI generation"
  });

  await emailVersion.save();

  return { email, emailVersion };
}

/**
 * Atomically bumps the version and updates the email, but ONLY if it is
 * still editable. Returns the updated email, or throws 404 / 409.
 */
async function applyEditableUpdate(emailId, fields, extra = {}) {
  const email = await Email.findOneAndUpdate(
    { _id: emailId, status: { $in: ["DRAFT", "PENDING_APPROVAL"] } },
    { $set: { ...fields, ...extra }, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );

  if (!email) {
    const exists = await Email.exists({ _id: emailId });
    const error = new Error(
      exists
        ? "Email is no longer editable (already APPROVED or SENT)"
        : "Email not found"
    );
    error.statusCode = exists ? 409 : 404;
    throw error;
  }

  return email;
}

async function recordRegeneratedVersion({
  emailId,
  subject,
  body,
  promptUsed = "",
  notes = "",
  customInstructions = null,
  eventName = null,
  eventDates = null
}) {
  const updateFields = { subject, body };
  if (customInstructions !== null && customInstructions !== undefined) {
    updateFields.customInstructions = String(customInstructions).trim();
    updateFields.isCustomized = Boolean(updateFields.customInstructions.length > 0);
  }
  if (eventName && String(eventName).trim()) {
    updateFields.eventName = String(eventName).trim();
  }
  if (eventDates && String(eventDates).trim()) {
    updateFields.eventDates = String(eventDates).trim();
  }

  const email = await applyEditableUpdate(
    emailId,
    updateFields,
    { status: "PENDING_APPROVAL" }
  );

  const emailVersion = await EmailVersion.create({
    emailId: email._id,
    version: email.version,
    subject: email.subject,
    body: email.body,
    type: email.type,
    source: "ai",
    promptUsed,
    notes: notes || "AI regeneration"
  });

  return { email, emailVersion };
}

async function recordHumanEdit({ emailId, subject, body, notes = "" }) {
  const newSubject = typeof subject === "string" ? subject.trim() : "";
  const newBody = typeof body === "string" ? body.trim() : "";

  if (!newSubject && !newBody) {
    const error = new Error("At least subject or body must be provided for edit");
    error.statusCode = 400;
    throw error;
  }

  const fields = {};
  if (newSubject) fields.subject = newSubject;
  if (newBody) fields.body = newBody;

  const email = await applyEditableUpdate(emailId, fields);

  const emailVersion = await EmailVersion.create({
    emailId: email._id,
    version: email.version,
    subject: email.subject,
    body: email.body,
    type: email.type,
    source: "human",
    promptUsed: "",
    notes: notes || "Human edit"
  });

  return { email, emailVersion };
}
/**
 * Fetches email along with all its version history.
 */
async function getEmailWithVersions(emailId) {
  const email = await Email.findById(emailId).populate("companyId");
  if (!email) {
    const error = new Error("Email not found");
    error.statusCode = 404;
    throw error;
  }

  const versions = await EmailVersion.find({ emailId: email._id }).sort({ version: 1 });

  return {
    email,
    versions
  };
}

module.exports = {
  createInitialEmail,
  recordRegeneratedVersion,
  recordHumanEdit,
  getEmailWithVersions
};
