const mongoose = require("mongoose");
const { Outreach, OUTREACH_STATUSES } = require("../models/outreach");
const OutreachEvent = require("../models/outreachEvent");
const TeamMember = require("../models/teamMember");
const Company = require("../models/company");
const serverCache = require("../services/cacheService");
const {
  processFollowUp,
  closeOutreach,
  updateOutreachStatus,
  getStats,
  recordEvent
} = require("../services/outreachService");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const createOutreach = async (req, res) => {
  try {
    const { companyId, memberId, emailId = null, notes = "" } = req.body || {};

    if (!companyId || !isValidObjectId(companyId)) {
      return res.status(400).json({ message: "Valid companyId is required" });
    }

    if (!memberId || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Valid memberId is required" });
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
      emailId,
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

    serverCache.invalidateTag("outreach");
    serverCache.invalidateTag("stats");

    const populatedOutreach = await Outreach.findById(outreach._id)
      .populate("companyId", "name website category score recommendedTier recommendedAsk")
      .populate("memberId", "name email role")
      .lean();

    res.status(201).json(populatedOutreach);
  } catch (error) {
    console.error("Create outreach error:", error);
    res.status(500).json({ message: "Failed to create outreach", error: error.message });
  }
};

const getAllOutreach = async (req, res) => {
  try {
    const { status, memberId, companyId } = req.query;
    const { defaultOutreaches } = require("../services/seedDataService");

    const filterFn = (items) => {
      return items.filter(item => {
        if (status && item.status !== status) return false;
        if (memberId && String(item.memberId?._id || item.memberId?.id || item.memberId) !== String(memberId)) return false;
        if (companyId && String(item.companyId?._id || item.companyId?.id || item.companyId) !== String(companyId)) return false;
        return true;
      });
    };

    if (mongoose.connection.readyState !== 1) {
      res.setHeader("Cache-Control", "private, no-cache");
      return res.json(filterFn(defaultOutreaches));
    }

    const cacheKey = `outreach_list_${status || "all"}_${memberId || "all"}_${companyId || "all"}`;

    const outreaches = await serverCache.getOrSet(cacheKey, async () => {
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

      const results = await Outreach.find(filter)
        .populate("companyId", "name website industry category score recommendedTier recommendedAsk contactName contactEmail")
        .populate("memberId", "name email role")
        .sort({ updatedAt: -1 })
        .lean();

      if (results && results.length > 0) {
        return results;
      }
      return filterFn(defaultOutreaches);
    }, 15, "outreach");

    res.setHeader("Cache-Control", "private, no-cache");
    res.json(outreaches);
  } catch (error) {
    console.error("Get all outreach error:", error);
    try {
      const { defaultOutreaches } = require("../services/seedDataService");
      res.json(defaultOutreaches);
    } catch (_) {
      res.json([]);
    }
  }
};

const getPendingFollowUps = async (req, res) => {
  try {
    const { defaultOutreaches } = require("../services/seedDataService");
    const getDefaultPending = () => {
      const now = new Date();
      return defaultOutreaches.filter(item => {
        return item.nextFollowUpAt && new Date(item.nextFollowUpAt) <= now && (item.followUpCount || 0) < 2;
      });
    };

    if (mongoose.connection.readyState !== 1) {
      const def = getDefaultPending();
      res.setHeader("Cache-Control", "private, no-cache");
      return res.json({ count: def.length, pendingFollowUps: def });
    }

    const pending = await serverCache.getOrSet("outreach_pending_followups", async () => {
      const now = new Date();
      const results = await Outreach.find({
        nextFollowUpAt: { $lte: now },
        followUpCount: { $lt: 2 },
        status: { $nin: ["CLOSED", "DECLINED", "INTERESTED", "MEETING"] }
      })
        .populate("companyId", "name website category score recommendedTier recommendedAsk contactName contactEmail")
        .populate("memberId", "name email role")
        .sort({ nextFollowUpAt: 1 })
        .lean();

      if (results && results.length > 0) {
        return results;
      }
      return getDefaultPending();
    }, 10, "outreach");

    res.setHeader("Cache-Control", "private, no-cache");
    res.json({
      count: pending.length,
      pendingFollowUps: pending
    });
  } catch (error) {
    console.error("Get pending follow-ups error:", error);
    try {
      const { defaultOutreaches } = require("../services/seedDataService");
      const now = new Date();
      const def = defaultOutreaches.filter(item => item.nextFollowUpAt && new Date(item.nextFollowUpAt) <= now && (item.followUpCount || 0) < 2);
      res.json({ count: def.length, pendingFollowUps: def });
    } catch (_) {
      res.json({
        count: 0,
        pendingFollowUps: []
      });
    }
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
      .limit(Number(limit));

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

const handleGmailWebhook = async (req, res) => {
  try {
    const { event, emailId, threadId, label, notes = "" } = req.body || {};

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
      message: `Event '${event}' processed successfully`,
      outreach: updated
    });
  } catch (error) {
    console.error("Gmail Webhook error:", error);
    res.status(500).json({ message: "Failed to process event", error: error.message });
  }
};

/**
 * GET /outreach/export/csv
 * Exports the complete Outreach Tracker to a standard CSV for Google Sheets / Excel import
 */
const exportOutreachCSV = async (req, res) => {
  try {
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Outreach.find()
        .populate("companyId")
        .populate("memberId")
        .sort({ createdAt: -1 });
    }

    if (!list || list.length === 0) {
      const { defaultOutreaches } = require("../services/seedDataService");
      list = defaultOutreaches;
    }

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Company Name",
      "Website",
      "Category",
      "Recommended Tier",
      "Recommended Ask",
      "Status",
      "Assigned Member",
      "Member Email",
      "Follow-ups Sent",
      "Max Follow-ups",
      "Next Scheduled Date",
      "Last Contacted Date",
      "Meeting Link",
      "Meeting Scheduled At",
      "Notes"
    ];

    const rows = list.map((o) => [
      escapeCSV(o.companyId?.name || "Unknown Company"),
      escapeCSV(o.companyId?.website || ""),
      escapeCSV(o.companyId?.category || "Other"),
      escapeCSV(o.companyId?.recommendedTier || "Silver"),
      escapeCSV(o.companyId?.recommendedAsk || "money"),
      escapeCSV(o.status),
      escapeCSV(o.memberId?.name || "Unassigned"),
      escapeCSV(o.memberId?.email || ""),
      escapeCSV(o.followUpCount || 0),
      escapeCSV(2),
      escapeCSV(o.nextFollowUpAt ? new Date(o.nextFollowUpAt).toISOString().split("T")[0] : ""),
      escapeCSV(o.lastContactedAt ? new Date(o.lastContactedAt).toISOString().split("T")[0] : ""),
      escapeCSV(o.meetingLink || ""),
      escapeCSV(o.meetingScheduledAt ? new Date(o.meetingScheduledAt).toLocaleString() : ""),
      escapeCSV(o.notes || "")
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const filename = `SponcyBot_Outreach_Tracker_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export outreach CSV error:", error);
    res.status(500).json({ message: "Failed to export CSV", error: error.message });
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
  handleGmailWebhook,
  exportOutreachCSV
};
