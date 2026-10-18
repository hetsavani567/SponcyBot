const { Outreach, OUTREACH_STATUSES } = require("../models/outreach");
const { Email } = require("../models/email");
const OutreachEvent = require("../models/outreachEvent");
const TeamMember = require("../models/teamMember");
const Company = require("../models/company");
const {
  processFollowUp,
  closeOutreach,
  updateOutreachStatus,
  getStats,
  recordEvent
} = require("../services/outreachService");

// strict 24-hex check (mongoose.isValidObjectId also accepts any 12-char string)
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id || ""));

const MAX_HISTORY_LIMIT = 100;

const createOutreach = async (req, res) => {
  try {
    const { companyId, memberId, emailId = null, notes = "" } = req.body || {};

    if (!companyId || !isValidObjectId(companyId)) {
      return res.status(400).json({ message: "Valid companyId is required" });
    }

    if (!memberId || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Valid memberId is required" });
    }

    if (emailId !== null && emailId !== undefined && emailId !== "") {
      if (!isValidObjectId(emailId)) {
        return res.status(400).json({ message: "emailId must be a valid ID" });
      }
      const linkedEmail = await Email.findById(emailId);
      if (!linkedEmail) {
        return res.status(404).json({ message: "Email not found" });
      }
      if (!["APPROVED", "SENT"].includes(linkedEmail.status)) {
        return res.status(409).json({
          message: `Email must be APPROVED before outreach (current status: ${linkedEmail.status})`
        });
      }
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const member = await TeamMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    // DUPLICATE OUTREACH PREVENTION RULE:
    // Check if an active outreach already exists for this company
    const activeOutreach = await Outreach.findOne({
      companyId,
      status: { $nin: ["CLOSED", "DECLINED"] }
    }).populate("memberId", "name email");

    if (activeOutreach) {
      return res.status(409).json({
        message: `Duplicate outreach prevented: An active outreach for '${company.name}' is already assigned to ${activeOutreach.memberId?.name || "another team member"}.`,
        existingOutreach: activeOutreach
      });
    }

    const outreach = await Outreach.create({
      companyId,
      memberId,
      emailId: emailId || null,
      status: "DRAFT",
      followUpCount: 0,
      notes
    });

    await recordEvent({
      outreachId: outreach._id,
      companyId,
      memberId,
      eventType: "OUTREACH_CREATED",
      fromStatus: null,
      toStatus: "DRAFT",
      description: `Outreach created and assigned to ${member.name} (${member.role}).`,
      metadata: { companyName: company.name, memberName: member.name }
    });

    const populatedOutreach = await Outreach.findById(outreach._id)
      .populate("companyId", "name website category score recommendedTier recommendedAsk")
      .populate("memberId", "name email role");

    res.status(201).json(populatedOutreach);
  } catch (error) {
    console.error("Create outreach error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Duplicate outreach prevented: an active outreach already exists for this company"
      });
    }
    res.status(500).json({ message: "Failed to create outreach", error: error.message });
  }
};

const getAllOutreach = async (req, res) => {
  try {
    const { status, memberId, companyId } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (memberId && isValidObjectId(memberId)) {
      filter.memberId = memberId;
    }

    if (companyId && isValidObjectId(companyId)) {
      filter.companyId = companyId;
    }

    const outreaches = await Outreach.find(filter)
      .populate("companyId", "name website industry category score recommendedTier recommendedAsk contactName contactEmail")
      .populate("memberId", "name email role")
      .sort({ updatedAt: -1 });

    res.json(outreaches);
  } catch (error) {
    console.error("Get all outreach error:", error);
    res.status(500).json({ message: "Failed to get outreach records", error: error.message });
  }
};

const getPendingFollowUps = async (req, res) => {
  try {
    const now = new Date();

    const pending = await Outreach.find({
      nextFollowUpAt: { $lte: now },
      followUpCount: { $lt: 2 },
      status: { $nin: ["CLOSED", "DECLINED", "INTERESTED", "MEETING"] }
    })
      .populate("companyId", "name website category score recommendedTier recommendedAsk contactName contactEmail")
      .populate("memberId", "name email role")
      .sort({ nextFollowUpAt: 1 });

    res.json({
      count: pending.length,
      pendingFollowUps: pending
    });
  } catch (error) {
    console.error("Get pending follow-ups error:", error);
    res.status(500).json({ message: "Failed to get pending follow-ups", error: error.message });
  }
};

const getOutreachById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid outreach ID" });
    }

    const outreach = await Outreach.findById(id)
      .populate("companyId")
      .populate("memberId", "name email role");

    if (!outreach) {
      return res.status(404).json({ message: "Outreach record not found" });
    }

    const timeline = await OutreachEvent.find({ outreachId: id })
      .sort({ createdAt: 1 })
      .populate("memberId", "name email");

    res.json({
      ...outreach.toObject(),
      timeline
    });
  } catch (error) {
    console.error("Get outreach by ID error:", error);
    res.status(500).json({ message: "Failed to get outreach record", error: error.message });
  }
};

const registerFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { emailId, notes } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid outreach ID" });
    }

    const outreach = await Outreach.findById(id);
    if (!outreach) {
      return res.status(404).json({ message: "Outreach record not found" });
    }

    try {
      const updated = await processFollowUp(outreach, { emailId, notes });
      const populated = await Outreach.findById(updated._id)
        .populate("companyId", "name category score recommendedTier")
        .populate("memberId", "name email");

      res.json({
        message: `Follow-up ${updated.followUpCount} registered successfully`,
        outreach: populated
      });
    } catch (followUpError) {
      if (followUpError.statusCode === 400) {
        return res.status(400).json({
          message: followUpError.message,
          outreach: followUpError.outreach
        });
      }
      throw followUpError;
    }
  } catch (error) {
    console.error("Register follow-up error:", error);
    res.status(500).json({ message: "Failed to register follow-up", error: error.message });
  }
};

const closeOutreachHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Closed by organizer" } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid outreach ID" });
    }

    const outreach = await Outreach.findById(id);
    if (!outreach) {
      return res.status(404).json({ message: "Outreach record not found" });
    }

    const closed = await closeOutreach(outreach, reason);
    res.json({
      message: "Outreach closed successfully",
      outreach: closed
    });
  } catch (error) {
    console.error("Close outreach error:", error);
    res.status(500).json({ message: "Failed to close outreach", error: error.message });
  }
};

const updateStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, meetingLink, meetingScheduledAt, threadId, notes } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid outreach ID" });
    }

    if (!status || !OUTREACH_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid or missing status. Must be one of: ${OUTREACH_STATUSES.join(", ")}`
      });
    }

    const outreach = await Outreach.findById(id);
    if (!outreach) {
      return res.status(404).json({ message: "Outreach record not found" });
    }

    const updated = await updateOutreachStatus(outreach, status, {
      reason,
      meetingLink,
      meetingScheduledAt,
      threadId,
      metadata: { notes }
    });

    const populated = await Outreach.findById(updated._id)
      .populate("companyId", "name category score")
      .populate("memberId", "name email");

    res.json({
      message: `Status updated to ${status}`,
      outreach: populated
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getCommsHistory = async (req, res) => {
  try {
    const { companyId, outreachId, memberId, eventType, limit = 50 } = req.query;
    const filter = {};

    if (companyId && isValidObjectId(companyId)) filter.companyId = companyId;
    if (outreachId && isValidObjectId(outreachId)) filter.outreachId = outreachId;
    if (memberId && isValidObjectId(memberId)) filter.memberId = memberId;
    if (eventType) filter.eventType = eventType;

    const events = await OutreachEvent.find(filter)
      .populate("companyId", "name website")
      .populate("memberId", "name email")
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_HISTORY_LIMIT));

    res.json({
      count: events.length,
      history: events
    });
  } catch (error) {
    console.error("Get comms history error:", error);
    res.status(500).json({ message: "Failed to get comms history", error: error.message });
  }
};

const getDashboardStatsHandler = async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ message: "Failed to get outreach statistics", error: error.message });
  }
};

const handleP4Webhook = async (req, res) => {
  try {
    const secret = process.env.P4_WEBHOOK_SECRET;
    if (secret && req.get("x-webhook-secret") !== secret) {
      return res.status(401).json({ message: "Unauthorized webhook call" });
    }

    const { event, emailId, threadId, label, notes = "" } = req.body || {};

    if (!["sent", "reply"].includes(event)) {
      return res.status(400).json({ message: "event must be 'sent' or 'reply'" });
    }

    let outreach = null;
    if (threadId) {
      outreach = await Outreach.findOne({ threadId });
    }
    if (!outreach && emailId) {
      outreach = await Outreach.findOne({ emailId });
    }

    if (!outreach) {
      return res.status(404).json({
        message: "Outreach record not found for provided emailId or threadId"
      });
    }

    if (event === "sent") {
      await updateOutreachStatus(outreach, "SENT", {
        threadId,
        metadata: { emailId, notes: notes || "Email sent via Gmail" }
      });

      // keep the Email document in sync so SENT guards in the email module work
      const sentEmailId = emailId || outreach.emailId;
      if (sentEmailId && isValidObjectId(sentEmailId)) {
        await Email.findByIdAndUpdate(sentEmailId, { status: "SENT" });
      }
    } else if (event === "reply") {
      let targetStatus = "WAITING FOR REPLY";
      const normalizedLabel = String(label || "").toLowerCase();

      if (normalizedLabel.includes("interest")) {
        targetStatus = "INTERESTED";
      } else if (normalizedLabel.includes("decline")) {
        targetStatus = "DECLINED";
      } else if (normalizedLabel.includes("no reply") || normalizedLabel.includes("no-reply")) {
        targetStatus = "NO REPLY";
      }

      await updateOutreachStatus(outreach, targetStatus, {
        threadId,
        reason: `Reply received: ${label || "response"}`,
        metadata: { label, notes }
      });
    }

    const updated = await Outreach.findById(outreach._id)
      .populate("companyId", "name category")
      .populate("memberId", "name email");

    res.json({
      message: `P4 Event '${event}' processed successfully`,
      outreach: updated
    });
  } catch (error) {
    console.error("P4 Webhook error:", error);
    res.status(500).json({ message: "Failed to process P4 event", error: error.message });
  }
};

module.exports = {
  createOutreach,
  getAllOutreach,
  getPendingFollowUps,
  getOutreachById,
  registerFollowUp,
  closeOutreachHandler,
  updateStatusHandler,
  getCommsHistory,
  getDashboardStatsHandler,
  handleP4Webhook
};
