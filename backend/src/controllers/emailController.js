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
const mockCompanies = require("../mocks/companies.json");

/**
 * Ask-amount ranges per tier so the sponsorship ask differs per company.
 * EDIT these numbers (INR) to match your event budget. The email prompt
 * in emailGenerationService must read options.askAmountRange to use it.
 */
const TIER_ASK_RANGES = {
  Platinum: { min: 100000, max: 200000, label: "Platinum" },
  Gold: { min: 50000, max: 100000, label: "Gold" },
  Silver: { min: 25000, max: 50000, label: "Silver" },
  Bronze: { min: 10000, max: 25000, label: "Bronze" }
};

function getAskRange(company) {
  return TIER_ASK_RANGES[company?.recommendedTier] || TIER_ASK_RANGES.Silver;
}

/**
 * Helper to fetch company from DB or fallback mock for solo testing
 */
async function resolveCompany(companyId) {
  let company = null;

  if (mongoose.Types.ObjectId.isValid(companyId)) {
    company = await Company.findById(companyId);
  }

  if (!company) {
    // Check mock list by id or name
    company = mockCompanies.find(
      (m) => m.id === companyId || m._id === companyId || m.name === companyId
    );
  }

  return company;
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

    // Resolve or create a DB company if mock was used and user passed an ObjectId
    let targetCompanyId = company._id;
    if (!targetCompanyId || !mongoose.Types.ObjectId.isValid(targetCompanyId)) {
      // If mock has no ObjectId, either create one or find by name in DB
      let dbComp = await Company.findOne({ name: company.name });
      if (!dbComp) {
        dbComp = await Company.create({
          name: company.name,
          website: company.website,
          industry: company.industry,
          category: company.category,
          research: company.research,
          score: company.score || 0,
          recommendedTier: company.recommendedTier || "Silver",
          recommendedAsk: company.recommendedAsk || "money",
          shortPitch: company.shortPitch || "",
          strategy: company.strategy || "",
          whatToAsk: company.whatToAsk || "",
          contactName: company.contactName || "",
          contactRole: company.contactRole || ""
        });
      }
      targetCompanyId = dbComp._id;
    }

    // If generating a follow-up, auto-retrieve earlier email context if not explicitly provided
    let prevSubj = previousSubject || "";
    let prevBdy = previousBody || "";
    if ((type === "followup1" || type === "followup2") && (!prevSubj || !prevBdy) && targetCompanyId) {
      const priorEmail = await Email.findOne({
        companyId: targetCompanyId,
        type: type === "followup2" ? { $in: ["initial", "followup1"] } : "initial",
        status: { $in: ["SENT", "APPROVED"] }
      }).sort({ createdAt: -1 });

      if (priorEmail) {
        prevSubj = prevSubj || priorEmail.subject;
        prevBdy = prevBdy || priorEmail.body;
      }
    }

    const draft = await generateEmailDraft(company, {
      ...eventDetails,
      ...extraOptions,
      // explicit values last so extra options can't override them
      type,
      customInstructions,
      previousSubject: prevSubj,
      previousBody: prevBdy,
      askAmountRange: extraOptions.askAmountRange || getAskRange(company)
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

    return res.status(201).json({
      success: true,
      message: "Email generated successfully",
      data: {
        email,
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
    const { emailId, customInstructions } = req.body;

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

    const draft = await generateEmailDraft(companyData, {
  type: email.type || "initial",
  customInstructions,
  previousSubject: email.subject,
  previousBody: email.body,
  isRegeneration: true,
  askAmountRange: getAskRange(companyData)
});
    const { email: updatedEmail, emailVersion } = await recordRegeneratedVersion({
      emailId: email._id,
      subject: draft.subject,
      body: draft.body,
      promptUsed: draft.promptUsed,
      notes: customInstructions || "Regenerated by AI"
    });

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
    const { status, type, companyId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid companyId format"
        });
      }
      filter.companyId = companyId;
    }

    const emails = await Email.find(filter).populate("companyId").sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: emails.length,
      data: emails
    });
  } catch (error) {
    console.error("Error in listEmails:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to list emails"
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
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pending approval emails"
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
        message: "Email not found"
      });
    }

    if (email.status !== "PENDING_APPROVAL") {
      return res.status(409).json({
        success: false,
        message: `Cannot approve an email that is ${email.status}`
      });
    }

    email.status = "APPROVED";
    await email.save();

    return res.status(200).json({
      success: true,
      message: "Email approved successfully",
      data: { email }
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
 * PATCH /emails/:id/reject
 * Rejects an email and moves it back to draft status
 */
const rejectEmail = async (req, res) => {
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
        message: "Email not found"
      });
    }

    if (email.status !== "PENDING_APPROVAL") {
      return res.status(409).json({
        success: false,
        message: `Cannot reject an email that is ${email.status}`
      });
    }

    const { reason } = req.body;

    const rejectionReason = reason || "Rejected by reviewer";

    email.status = "DRAFT";
    // NOTE: add `rejectionReason: String` to the Email schema or this is dropped silently
    email.rejectionReason = rejectionReason;
    await email.save();

    return res.status(200).json({
      success: true,
      message: "Email rejected and moved back to draft",
      data: { email, reason: rejectionReason }
    });
  } catch (error) {
    console.error("Error in rejectEmail:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to reject email"
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
  rejectEmail
};
