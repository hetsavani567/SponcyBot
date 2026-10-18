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
  status = "PENDING_APPROVAL"
}) {
  const email = new Email({
    companyId,
    type,
    askType,
    subject,
    body,
    status,
    version: 1
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
    notes: "Initial AI generation"
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
  notes = ""
}) {
  const email = await applyEditableUpdate(
    emailId,
    { subject, body },
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
