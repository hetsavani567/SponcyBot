const {
  getAuthUrl,
  exchangeCodeForTokens,
  getAuthStatus
} = require("../services/gmailService");

/**
 * GET /gmail/oauth/start
 * Redirects the user to Google's OAuth consent screen.
 */
const startOAuth = (req, res) => {
  try {
    const url = getAuthUrl();
    // In production this would redirect; we return the URL too
    // so it can be opened from Postman / curl during development.
    res.redirect(url);
  } catch (error) {
    console.error("[GmailController] startOAuth error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate OAuth URL",
      error: error.message
    });
  }
};

/**
 * GET /gmail/oauth/callback
 * Google redirects here after the user approves the consent screen.
 * Exchanges the authorization code for access + refresh tokens
 * and saves them to the database.
 */
const oAuthCallback = async (req, res) => {
  try {
    const { code, error: oauthError } = req.query;

    // User denied access on the consent screen
    if (oauthError) {
      return res.status(400).json({
        success: false,
        message: `OAuth consent denied: ${oauthError}`
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Missing authorization code in callback"
      });
    }

    const { email, tokens } = await exchangeCodeForTokens(code);

    return res.status(200).json({
      success: true,
      message: `Gmail successfully authorized for ${email}`,
      data: {
        email,
        scope: tokens.scope,
        // Never expose raw tokens in the response — just confirm they were stored
        tokensStored: true,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null
      }
    });
  } catch (error) {
    console.error("[GmailController] oAuthCallback error:", error);
    return res.status(500).json({
      success: false,
      message: "OAuth token exchange failed",
      error: error.message
    });
  }
};

/**
 * GET /gmail/oauth/status
 * Returns whether Gmail is currently authorized and which account is connected.
 * Useful for health checks and the demo dashboard.
 */
const getOAuthStatus = async (req, res) => {
  try {
    const status = await getAuthStatus();
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error("[GmailController] getOAuthStatus error:", error);
    return res.status(200).json({
      success: true,
      data: { connected: false, email: null }
    });
  }
};

/**
 * POST /gmail/send
 * Sends an email via Gmail API.
 * Gated by sendGuard middleware: ONLY emails with status "APPROVED" can reach here.
 * Immediately notifies Outreach CRM and updates status to "SENT".
 */
const sendEmail = async (req, res) => {
  try {
    // req.approvedEmail is attached by the sendGuard middleware
    const email = req.approvedEmail;

    const Company = require("../models/company");
    const { Outreach } = require("../models/outreach");
    const { updateOutreachStatus } = require("../services/outreachService");
    const { sendEmailViaGmail } = require("../services/gmailService");

    let recipient = req.body.to;
    if (!recipient && email.companyId) {
      const company = await Company.findById(email.companyId);
      if (company && company.contactEmail) {
        recipient = company.contactEmail;
      }
    }

    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: "Recipient email address 'to' is required in request body or company.contactEmail"
      });
    }

    // Call Gmail send service (supports live OAuth or mock flag)
    const isMock = req.body.mock === true || req.query.mock === "true";
    const sendResult = await sendEmailViaGmail({
      to: recipient,
      subject: email.subject,
      body: email.body,
      threadId: req.body.threadId || null,
      mock: isMock
    });

    // 1. Transition Email status to SENT
    email.status = "SENT";
    await email.save();

    // 2. Synchronize with Outreach CRM
    let outreach = null;
    if (req.body.outreachId) {
      outreach = await Outreach.findById(req.body.outreachId);
    }
    if (!outreach) {
      outreach = await Outreach.findOne({
        $or: [{ emailId: email._id.toString() }, { companyId: email.companyId }]
      });
    }

    if (outreach) {
      outreach.emailId = email._id.toString();
      await updateOutreachStatus(outreach, "SENT", {
        threadId: sendResult.threadId,
        metadata: {
          emailId: email._id,
          messageId: sendResult.messageId,
          recipient,
          senderEmail: sendResult.senderEmail,
          notes: "Email sent via Gmail integration"
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email sent successfully via Gmail",
      data: {
        emailId: email._id,
        status: email.status,
        recipient,
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        senderEmail: sendResult.senderEmail,
        isMock: sendResult.isMock || false,
        outreach: outreach
          ? {
              id: outreach._id,
              status: outreach.status,
              followUpCount: outreach.followUpCount,
              nextFollowUpAt: outreach.nextFollowUpAt
            }
          : null
      }
    });
  } catch (error) {
    console.error("[GmailController] sendEmail error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send email via Gmail",
      error: error.message
    });
  }
};

/**
 * GET /gmail/thread/:id or /gmail/thread/:threadId
 * Fetches full thread messages, syncs with GmailThread model, and suggests label if unclassified
 */
const getThreadById = async (req, res) => {
  try {
    const threadId = req.params.threadId || req.params.id;
    const isMock = req.query.mock === "true";

    const { fetchThread, classifyReplyWithAI } = require("../services/gmailService");
    const { GmailThread } = require("../models/gmailThread");
    const { Outreach } = require("../models/outreach");

    const threadData = await fetchThread(threadId, isMock);

    // Find linked outreach
    const outreach = await Outreach.findOne({ threadId })
      .populate("companyId", "name website category")
      .populate("memberId", "name email");

    // Upsert GmailThread cache document
    let threadDoc = await GmailThread.findOne({ threadId });
    if (!threadDoc) {
      threadDoc = new GmailThread({
        threadId,
        companyId: outreach?.companyId?._id || outreach?.companyId || null,
        outreachId: outreach?._id || null,
        emailId: outreach?.emailId || null,
        subject: threadData.subject,
        snippet: threadData.snippet,
        messages: threadData.messages,
        lastMessageAt: threadData.lastMessageAt
      });
    } else {
      threadDoc.subject = threadData.subject;
      threadDoc.snippet = threadData.snippet;
      threadDoc.messages = threadData.messages;
      threadDoc.lastMessageAt = threadData.lastMessageAt;
    }

    // Auto-classify latest sponsor reply if not yet confirmed
    const latestSponsorMsg = [...threadData.messages].reverse().find((m) => m.isFromSponsor);
    if (latestSponsorMsg && !threadDoc.confirmedLabel) {
      const classification = await classifyReplyWithAI(
        latestSponsorMsg.body || latestSponsorMsg.snippet,
        outreach?.companyId?.name || ""
      );
      threadDoc.suggestedLabel = classification.suggestedLabel;
      threadDoc.confidence = classification.confidence;
      threadDoc.classificationReason = classification.reason;
    }

    await threadDoc.save();

    return res.status(200).json({
      success: true,
      data: {
        thread: threadDoc,
        outreach: outreach
          ? {
              id: outreach._id,
              status: outreach.status,
              followUpCount: outreach.followUpCount,
              nextFollowUpAt: outreach.nextFollowUpAt,
              company: outreach.companyId
            }
          : null
      }
    });
  } catch (error) {
    console.error("[GmailController] getThreadById error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch thread",
      error: error.message
    });
  }
};

/**
 * GET /gmail/messages or /gmail/replies
 * Fetches inbox messages or threads to check for replies
 */
const getInboxMessages = async (req, res) => {
  try {
    const { listInboxMessages } = require("../services/gmailService");
    const isMock = req.query.mock === "true";
    const q = req.query.q || "";
    const maxResults = parseInt(req.query.maxResults, 10) || 20;

    const messages = await listInboxMessages({ q, maxResults, mock: isMock });

    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error("[GmailController] getInboxMessages error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch inbox messages",
      error: error.message
    });
  }
};

/**
 * POST /gmail/replies/classify
 * Analyzes a sponsor's reply text and returns an AI suggested label
 */
const classifyReplyHandler = async (req, res) => {
  try {
    const { replyText, threadId, companyName } = req.body || {};
    const { classifyReplyWithAI, fetchThread } = require("../services/gmailService");
    const { GmailThread } = require("../models/gmailThread");

    let textToClassify = replyText;

    if (!textToClassify && threadId) {
      const thread = await fetchThread(threadId, req.body.mock === true);
      const sponsorMsg = [...thread.messages].reverse().find((m) => m.isFromSponsor);
      textToClassify = sponsorMsg ? (sponsorMsg.body || sponsorMsg.snippet) : "";
    }

    if (!textToClassify) {
      return res.status(400).json({
        success: false,
        message: "Either replyText or a valid threadId with sponsor message is required"
      });
    }

    const classification = await classifyReplyWithAI(textToClassify, companyName);

    if (threadId) {
      await GmailThread.findOneAndUpdate(
        { threadId },
        {
          suggestedLabel: classification.suggestedLabel,
          confidence: classification.confidence,
          classificationReason: classification.reason
        }
      );
    }

    return res.status(200).json({
      success: true,
      data: classification
    });
  } catch (error) {
    console.error("[GmailController] classifyReplyHandler error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to classify reply",
      error: error.message
    });
  }
};

/**
 * POST /gmail/replies/confirm
 * Human confirms the outcome of a reply -> Updates Outreach CRM
 * Valid labels: INTERESTED, DECLINED, NO_REPLY, OTHER
 */
const confirmReplyHandler = async (req, res) => {
  try {
    const {
      threadId,
      outreachId,
      label,
      confirmedBy = "Human Reviewer",
      notes = "",
      meetingLink = "",
      meetingScheduledAt = null
    } = req.body || {};

    const validLabels = ["INTERESTED", "DECLINED", "NO_REPLY", "OTHER"];
    if (!label || !validLabels.includes(label)) {
      return res.status(400).json({
        success: false,
        message: `Invalid label '${label}'. Allowed: ${validLabels.join(", ")}`
      });
    }

    const { GmailThread } = require("../models/gmailThread");
    const { Outreach } = require("../models/outreach");
    const { updateOutreachStatus } = require("../services/outreachService");

    // 1. Update GmailThread record
    let threadDoc = null;
    if (threadId) {
      threadDoc = await GmailThread.findOneAndUpdate(
        { threadId },
        {
          confirmedLabel: label,
          confirmedBy,
          confirmedAt: new Date()
        },
        { new: true }
      );
    }

    // 2. Find and update Outreach record
    let outreach = null;
    if (outreachId) {
      outreach = await Outreach.findById(outreachId);
    }
    if (!outreach && threadId) {
      outreach = await Outreach.findOne({ threadId });
    }

    if (outreach) {
      let targetStatus = "WAITING FOR REPLY";
      if (label === "INTERESTED") {
        targetStatus = meetingLink || meetingScheduledAt ? "MEETING" : "INTERESTED";
      } else if (label === "DECLINED") {
        targetStatus = "DECLINED";
      } else if (label === "NO_REPLY") {
        targetStatus = "NO REPLY";
      }

      await updateOutreachStatus(outreach, targetStatus, {
        threadId: threadId || outreach.threadId,
        reason: notes || `Sponsor reply confirmed as: ${label}`,
        meetingLink,
        meetingScheduledAt,
        metadata: {
          confirmedBy,
          label,
          notes
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Reply outcome '${label}' confirmed successfully. Outreach updated.`,
      data: {
        thread: threadDoc,
        outreach: outreach
          ? {
              id: outreach._id,
              status: outreach.status,
              followUpCount: outreach.followUpCount,
              closedReason: outreach.closedReason,
              meetingLink: outreach.meetingLink
            }
          : null
      }
    });
  } catch (error) {
    console.error("[GmailController] confirmReplyHandler error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to confirm reply outcome",
      error: error.message
    });
  }
};

/**
 * GET /gmail/stats
 * Aggregates dashboard statistics across all 4 modules (Sponsors, Emails, Outreach, Gmail)
 */
const getSystemStats = async (req, res) => {
  try {
    const Company = require("../models/company");
    const { Email } = require("../models/email");
    const { Outreach } = require("../models/outreach");
    const { ApprovalLog } = require("../models/approvalLog");
    const { GmailThread } = require("../models/gmailThread");
    const { getStats } = require("../services/outreachService");

    let totalCompanies = 0;
    let pendingApprovals = 0;
    let totalEmailsSent = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalThreads = 0;
    let outreachMetrics = {};

    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      [
        totalCompanies,
        pendingApprovals,
        totalEmailsSent,
        totalApproved,
        totalRejected,
        totalThreads,
        outreachMetrics
      ] = await Promise.all([
        Company.countDocuments(),
        Email.countDocuments({ status: "PENDING_APPROVAL" }),
        Email.countDocuments({ status: "SENT" }),
        ApprovalLog.countDocuments({ decision: "APPROVED" }),
        ApprovalLog.countDocuments({ decision: "REJECTED" }),
        GmailThread.countDocuments(),
        getStats()
      ]);
    } else {
      outreachMetrics = await getStats();
    }

    return res.status(200).json({
      success: true,
      data: {
        sponsors: {
          total: totalCompanies
        },
        emails: {
          pendingApproval: pendingApprovals,
          totalSent: totalEmailsSent,
          approvalsGiven: totalApproved,
          rejectionsGiven: totalRejected
        },
        gmail: {
          trackedThreads: totalThreads
        },
        outreach: outreachMetrics
      }
    });
  } catch (error) {
    console.error("[GmailController] getSystemStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to compile system stats",
      error: error.message
    });
  }
};

/**
 * POST /gmail/demo/simulate-flow
 * Runs a 12-step end-to-end simulation of the complete SponcyBot lifecycle
 */
const runSimulationHandler = async (req, res) => {
  try {
    const { runSimulationFlow } = require("../services/orchestrationService");
    const result = await runSimulationFlow(req.body);

    return res.status(200).json({
      success: true,
      message: "End-to-end simulation completed successfully",
      data: result
    });
  } catch (error) {
    console.error("[GmailController] runSimulationHandler error:", error);
    return res.status(500).json({
      success: false,
      message: "Simulation failed",
      error: error.message
    });
  }
};

module.exports = {
  startOAuth,
  oAuthCallback,
  getOAuthStatus,
  sendEmail,
  getThreadById,
  getInboxMessages,
  classifyReplyHandler,
  confirmReplyHandler,
  getSystemStats,
  runSimulationHandler
};
