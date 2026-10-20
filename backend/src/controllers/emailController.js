const mongoose = require("mongoose");
const Company = require("../models/company");
const { Email } = require("../models/email");
const { generateEmailDraft } = require("../services/emailGenerationService");
const {
  createInitialEmail,
  recordRegeneratedVersion,
  recordHumanEdit,
  getEmailWithVersions
} = require("../services/emailVersioningService");
const {
  approveEmailWithLog,
  rejectEmailWithLog,
  getApprovalHistory
} = require("../services/approvalService");
const { EmailVersion } = require("../models/emailVersion");
const { ApprovalLog } = require("../models/approvalLog");
const serverCache = require("../services/cacheService");

async function resolveCompany(companyId) {
  if (!companyId) return null;

  if (mongoose.connection.readyState === 1) {
    try {
      if (mongoose.Types.ObjectId.isValid(companyId)) {
        const found = await Company.findById(companyId);
        if (found) return found;
      }
      const foundByName = await Company.findOne({ name: String(companyId).trim() });
      if (foundByName) return foundByName;
    } catch {}
  }

  const { getCompanyById } = require("./companyController");
  return getCompanyById(companyId);
}

/**
 * POST /emails/generate
 * Generates an initial email draft from companyId
 */
const generateEmail = async (req, res) => {
  try {
    const {
      companyId,
      type = "initial",
      customInstructions,
      previousSubject,
      previousBody,
      eventDetails = {},
      options: extraOptions = {}
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required"
      });
    }

    const company = await resolveCompany(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: `Company not found with id: ${companyId}`
      });
    }

    const targetCompanyId = company._id;

    // If generating a follow-up, auto-retrieve earlier email context if not explicitly provided
    let prevSubj = previousSubject || "";
    let prevBdy = previousBody || "";
    if ((type === "followup1" || type === "followup2") && (!prevSubj || !prevBdy) && targetCompanyId) {
      const priorEmail = await Email.findOne({
        companyId: targetCompanyId,
        type: type === "followup2" ? { $in: ["initial", "followup1"] } : "initial"
      }).sort({ createdAt: -1 });

      if (priorEmail) {
        prevSubj = prevSubj || priorEmail.subject;
        prevBdy = prevBdy || priorEmail.body;
      }
    }

    const draft = await generateEmailDraft(company, {
      type,
      customInstructions,
      previousSubject: prevSubj,
      previousBody: prevBdy,
      ...eventDetails,
      ...extraOptions
    });

    const { email, emailVersion } = await createInitialEmail({
      companyId: targetCompanyId,
      type,
      askType: company.recommendedAsk || "money",
      subject: draft.subject,
      body: draft.body,
      promptUsed: draft.promptUsed,
      status: "PENDING_APPROVAL"
    });

    // Populate company details so the frontend immediately displays company info without extra round-trip
    let responseEmail = email;
    if (email && typeof email.populate === "function") {
      try {
        await email.populate("companyId");
        responseEmail = email;
      } catch (_) {}
    }
    if (responseEmail && (!responseEmail.companyId || typeof responseEmail.companyId !== "object" || !responseEmail.companyId.name)) {
      const emailObj = responseEmail.toObject ? responseEmail.toObject() : { ...responseEmail };
      emailObj.companyId = company;
      responseEmail = emailObj;
    }

    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");

    return res.status(201).json({
      success: true,
      message: "Email generated successfully",
      data: {
        email: responseEmail,
        version: emailVersion
      }
    });
  } catch (error) {
    console.error("Error in generateEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate email"
    });
  }
};

/**
 * POST /emails/regenerate
 * Regenerates an existing email, creating a new version.
 * Rejects APPROVED or SENT.
 * Accepts DRAFT and PENDING_APPROVAL, and sets status back to PENDING_APPROVAL.
 */
const regenerateEmail = async (req, res) => {
  try {
    const {
      emailId,
      customInstructions,
      subject: customSubject,
      preserveSubject = true
    } = req.body;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: "emailId is required"
      });
    }

    const email = await Email.findById(emailId);
    if (!email) {
      return res.status(404).json({
        success: false,
        message: "Email not found"
      });
    }

    if (email.status === "APPROVED" || email.status === "SENT") {
      return res.status(409).json({
        success: false,
        message: `Cannot regenerate an email that is already ${email.status}`
      });
    }

    const company = await resolveCompany(email.companyId);
    const companyData = company || { name: "Sponsor", recommendedAsk: email.askType };

    // Determine custom subject candidate:
    // If a customSubject was explicitly passed in req.body, prioritize that.
    // Otherwise, if preserveSubject is true, keep email.subject.
    const hasCustomSubjectInput = typeof customSubject === "string" && customSubject.trim().length > 0;
    const subjectCandidate = hasCustomSubjectInput
      ? customSubject.trim()
      : (preserveSubject && email.subject)
        ? email.subject.trim()
        : null;

    const draft = await generateEmailDraft(companyData, {
      type: email.type || "initial",
      customInstructions,
      previousSubject: subjectCandidate || email.subject,
      previousBody: email.body,
      isRegeneration: true
    });

    // Use preserved/custom subject if available; otherwise use AI-generated subject
    const finalSubject = subjectCandidate || draft.subject;

    const { email: updatedEmail, emailVersion } = await recordRegeneratedVersion({
      emailId: email._id,
      subject: finalSubject,
      body: draft.body,
      promptUsed: draft.promptUsed,
      notes: customInstructions || (subjectCandidate ? "Regenerated body (custom subject preserved)" : "Regenerated by AI")
    });

    serverCache.invalidateTag("emails");

    return res.status(200).json({
      success: true,
      message: "Email regenerated successfully",
      data: {
        email: updatedEmail,
        version: emailVersion
      }
    });
  } catch (error) {
    console.error("Error in regenerateEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to regenerate email"
    });
  }
};

/**
 * POST /emails/edit
 * Saves a human edit as a new version.
 * Rejects APPROVED or SENT.
 */
const editEmail = async (req, res) => {
  try {
    const { emailId, subject, body, notes } = req.body;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: "emailId is required"
      });
    }

    const { email, emailVersion } = await recordHumanEdit({
      emailId,
      subject,
      body,
      notes
    });

    serverCache.invalidateTag("emails");

    return res.status(200).json({
      success: true,
      message: "Email edited and new version saved successfully",
      data: {
        email,
        version: emailVersion
      }
    });
  } catch (error) {
    console.error("Error in editEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to edit email"
    });
  }
};

/**
 * GET /emails/:id
 * Fetches an email along with all its version history.
 */
const getEmail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email ID format"
      });
    }

    const data = await getEmailWithVersions(id);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error in getEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch email"
    });
  }
};

/**
 * GET /emails
 * List emails with optional filters
 */
const listEmails = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const { status, type, companyId } = req.query;
    const cacheKey = `emails_list_${status || "all"}_${type || "all"}_${companyId || "all"}`;

    const emailsWithLogs = await serverCache.getOrSet(cacheKey, async () => {
      const filter = {};

      if (status) filter.status = status;
      if (type) filter.type = type;
      if (companyId) filter.companyId = companyId;

      const emails = await Email.find(filter).populate("companyId").sort({ updatedAt: -1 }).lean();

      // Attach latest approval decision (e.g. if rejected) so frontend immediately knows if draft was rejected
      const emailIds = emails.map(e => e._id);
      const logs = await ApprovalLog.find({ emailId: { $in: emailIds } }).sort({ decidedAt: -1 }).lean();

      return emails.map(email => {
        const emailLogs = logs.filter(l => l.emailId && l.emailId.toString() === email._id.toString());
        const latestLog = emailLogs[0] || null;
        const isRejected = email.status === "REJECTED" || (latestLog && latestLog.decision === "REJECTED" && email.status === "DRAFT");
        return {
          ...email,
          isRejected: Boolean(isRejected),
          latestDecision: latestLog ? latestLog.decision : null,
          rejectionReason: isRejected && latestLog ? (latestLog.notes || "Rejected by reviewer") : null
        };
      });
    }, 15, "emails");

    res.setHeader("Cache-Control", "private, no-cache");
    return res.status(200).json({
      success: true,
      count: emailsWithLogs.length,
      data: emailsWithLogs
    });
  } catch (error) {
    console.error("Error in listEmails:", error);
    return res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  }
};

/**
 * GET /emails/pending-approval
 * Returns all emails awaiting human review/approval
 */
const getPendingApprovalEmails = async (req, res) => {
  try {
    const emails = await Email.find({ status: "PENDING_APPROVAL" })
      .populate("companyId")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: emails.length,
      data: emails
    });
  } catch (error) {
    console.error("Error in getPendingApprovalEmails:", error);
    return res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  }
};

/**
 * PATCH /emails/:id/approve
 * Approves an email that is currently pending approval
 */
const approveEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reviewerName = "Human Reviewer",
      notes = "",
      requireRegenerated = false,
      allowInitial = false
    } = req.body || {};

    const email = await Email.findById(id);
    if (!email) {
      return res.status(404).json({
        success: false,
        message: "Email not found"
      });
    }

    // Repetition Guard: If requireRegenerated is active, block approving version 1 un-regenerated drafts
    const enforceRepetition = requireRegenerated || req.headers["x-enforce-repetition-guard"] === "true";
    if (enforceRepetition && !allowInitial && email.version <= 1) {
      return res.status(400).json({
        success: false,
        message: "Repetition Guard Active: Default version 1 drafts cannot be approved directly. Please generate a new AI email version first to eliminate repetitive outreach."
      });
    }

    const { email: approvedEmail, log } = await approveEmailWithLog({
      emailId: id,
      reviewerName,
      notes
    });

    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: "Email approved successfully",
      data: { email: approvedEmail, approvalLog: log }
    });
  } catch (error) {
    console.error("Error in approveEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to approve email"
    });
  }
};

/**
 * POST / PATCH /emails/:id/reject
 * Rejects an email and moves it back to draft status, recording rejection reason in audit log
 */
const rejectEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName = "Human Reviewer", reason = "", notes = "" } = req.body || {};

    const { email, log, reason: finalReason } = await rejectEmailWithLog({
      emailId: id,
      reviewerName,
      reason,
      notes
    });

    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: "Email rejected and moved back to draft",
      data: { email, reason: finalReason, approvalLog: log }
    });
  } catch (error) {
    console.error("Error in rejectEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to reject email"
    });
  }
};

/**
 * GET /emails/:id/approval-history
 * Returns the audit trail of approval and rejection decisions for an email
 */
const getEmailApprovalLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await getApprovalHistory(id);

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error("Error in getEmailApprovalLogs:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch approval history"
    });
  }
};

/**
 * DELETE /emails/:id
 * Removes a specific email draft, its versions, and its approval history
 */
const deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email ID format"
      });
    }

    const email = await Email.findById(id);
    if (!email) {
      return res.status(404).json({
        success: false,
        message: "Draft not found"
      });
    }

    // Safety guard: prevent accidental deletion of already sent emails unless force=true
    if (email.status === "SENT" && req.query.force !== "true") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete dispatched emails that have already been sent via Gmail."
      });
    }

    await Email.findByIdAndDelete(id);
    await EmailVersion.deleteMany({ emailId: id });
    await ApprovalLog.deleteMany({ emailId: id });

    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: "Draft removed successfully",
      data: { emailId: id, status: email.status }
    });
  } catch (error) {
    console.error("Error in deleteEmail:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove draft"
    });
  }
};

/**
 * DELETE /emails/rejected
 * Bulk removes all rejected email drafts
 */
const deleteRejectedEmails = async (req, res) => {
  try {
    const rejectedLogs = await ApprovalLog.find({ decision: "REJECTED" }).select("emailId");
    const rejectedEmailIds = rejectedLogs.map(l => l.emailId);

    const targetEmails = await Email.find({
      $or: [
        { status: "REJECTED" },
        { status: "DRAFT" },
        { _id: { $in: rejectedEmailIds }, status: { $ne: "SENT" } }
      ]
    });

    const targetIds = targetEmails.map(e => e._id);

    if (targetIds.length > 0) {
      await Email.deleteMany({ _id: { $in: targetIds } });
      await EmailVersion.deleteMany({ emailId: { $in: targetIds } });
      await ApprovalLog.deleteMany({ emailId: { $in: targetIds } });
    }

    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: `Removed ${targetIds.length} rejected draft(s) successfully`,
      count: targetIds.length,
      data: { deletedCount: targetIds.length }
    });
  } catch (error) {
    console.error("Error in deleteRejectedEmails:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove rejected drafts"
    });
  }
};

/**
 * DELETE /emails/all-drafts
 * Bulk removes all un-sent drafts (DRAFT, PENDING_APPROVAL, REJECTED)
 */
const deleteAllDrafts = async (req, res) => {
  try {
    const drafts = await Email.find({ status: { $ne: "SENT" } }).select("_id");
    const draftIds = drafts.map(d => d._id);

    if (draftIds.length > 0) {
      await Email.deleteMany({ _id: { $in: draftIds } });
      await EmailVersion.deleteMany({ emailId: { $in: draftIds } });
      await ApprovalLog.deleteMany({ emailId: { $in: draftIds } });
    }

    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: `Cleared ${draftIds.length} draft(s) successfully`,
      count: draftIds.length,
      data: { deletedCount: draftIds.length }
    });
  } catch (error) {
    console.error("Error in deleteAllDrafts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to clear drafts"
    });
  }
};

module.exports = {
  generateEmail,
  regenerateEmail,
  editEmail,
  getEmail,
  getPendingApprovalEmails,
  listEmails,
  approveEmail,
  rejectEmail,
  getEmailApprovalLogs,
  deleteEmail,
  deleteRejectedEmails,
  deleteAllDrafts
};
