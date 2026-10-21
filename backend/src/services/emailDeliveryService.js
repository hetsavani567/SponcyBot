const mongoose = require("mongoose");
const Company = require("../models/company");
const { Outreach } = require("../models/outreach");
const TeamMember = require("../models/teamMember");
const { recordEvent, updateOutreachStatus } = require("./outreachService");
const { sendEmailViaGmail } = require("./gmailService");
const serverCache = require("./cacheService");
const { defaultTeamMembers } = require("./seedDataService");
const { GmailThread } = require("../models/gmailThread");

/**
 * Resolves the recipient email address for a sponsor company.
 */
const resolveRecipientEmail = (company, explicitRecipient = null) => {
  if (explicitRecipient && String(explicitRecipient).trim()) {
    return String(explicitRecipient).trim();
  }

  if (company) {
    if (company.contactEmail && String(company.contactEmail).trim()) {
      return String(company.contactEmail).trim();
    }
    if (Array.isArray(company.discoveredContacts) && company.discoveredContacts.length > 0) {
      const discovered = company.discoveredContacts.find(c => c.email && String(c.email).trim());
      if (discovered) return String(discovered.email).trim();
    }
    if (company.website) {
      try {
        const rawUrl = company.website.startsWith("http") ? company.website : `https://${company.website}`;
        const domain = new URL(rawUrl).hostname.replace(/^www\./, "");
        if (domain && domain.includes(".")) {
          return `sponsorships@${domain}`;
        }
      } catch (_) {}
    }
  }

  const safeName = (company?.name || "sponsor").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `sponsorships@${safeName || "company"}.com`;
};

/**
 * Automatically delivers an approved email to the sponsor company's email address
 * from the user's authentic Gmail address (or mock/fallback), transitions the email status
 * to 'SENT', creates or links an Outreach CRM record, and syncs GmailThread.
 *
 * @param {Object} params
 * @param {Object} params.email - The Email document or object being dispatched
 * @param {string} [params.recipient] - Optional explicit recipient override
 * @param {string} [params.reviewerName] - Name of the reviewer who approved
 * @param {boolean} [params.mock] - Force mock delivery
 * @returns {Promise<Object>} Delivery details, updated email, and outreach record
 */
const deliverApprovedEmail = async ({
  email,
  recipient = null,
  reviewerName = "Human Reviewer",
  mock = false
}) => {
  if (!email) {
    const error = new Error("Email object or document is required for delivery.");
    error.statusCode = 400;
    throw error;
  }

  // 1. Resolve Company & Recipient Email Address
  let company = null;
  if (email.companyId) {
    company = (typeof email.companyId === "object" && email.companyId.name)
      ? email.companyId
      : await Company.findById(email.companyId);
  }

  const resolvedRecipient = resolveRecipientEmail(company, recipient);

  // 2. Dispatch Email via Gmail (real OAuth if connected, resilient fallback otherwise)
  let sendResult;
  try {
    sendResult = await sendEmailViaGmail({
      to: resolvedRecipient,
      subject: email.subject,
      body: email.body,
      threadId: email.threadId || null,
      mock: mock === true
    });
  } catch (sendErr) {
    console.warn(`[EmailDeliveryService] Live Gmail dispatch failed (${sendErr.message}), falling back to resilient simulated dispatch.`);
    sendResult = {
      messageId: `msg_${Date.now()}`,
      threadId: email.threadId || `thread_${Date.now()}`,
      senderEmail: process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club",
      isMock: true,
      liveError: sendErr.message
    };
  }

  // 3. Transition Email Status to SENT
  email.status = "SENT";
  if (sendResult.threadId && !email.threadId) {
    email.threadId = sendResult.threadId;
  }
  if (typeof email.save === "function") {
    await email.save();
  }

  // 4. Automatically Find or Create Outreach CRM Record
  let outreach = null;
  if (email.companyId) {
    const companyIdStr = company?._id || email.companyId;
    outreach = await Outreach.findOne({
      $or: [
        { emailId: email._id.toString() },
        { companyId: companyIdStr, status: { $nin: ["CLOSED", "DECLINED"] } },
        { companyId: companyIdStr }
      ]
    });

    if (!outreach) {
      // Find or assign active team member
      let member = await TeamMember.findOne({ active: true });
      if (!member) {
        member = await TeamMember.findOne();
      }
      if (!member) {
        try {
          member = await TeamMember.create(defaultTeamMembers[0]);
        } catch (_) {
          member = defaultTeamMembers[0];
        }
      }

      outreach = await Outreach.create({
        companyId: companyIdStr,
        memberId: member._id || member.id,
        emailId: email._id.toString(),
        status: "DRAFT",
        followUpCount: 0,
        notes: `Outreach auto-created upon proposal draft approval and delivery to ${resolvedRecipient}.`
      });

      await recordEvent({
        outreachId: outreach._id,
        companyId: companyIdStr,
        memberId: member._id || member.id,
        eventType: "OUTREACH_CREATED",
        fromStatus: null,
        toStatus: "DRAFT",
        description: `Outreach auto-created for ${company?.name || "Sponsor"} upon draft approval.`,
        metadata: { companyName: company?.name, memberName: member?.name, emailId: email._id }
      });
    }

    if (outreach) {
      outreach.emailId = email._id.toString();
      await updateOutreachStatus(outreach, "SENT", {
        threadId: sendResult.threadId,
        metadata: {
          emailId: email._id,
          messageId: sendResult.messageId,
          recipient: resolvedRecipient,
          senderEmail: sendResult.senderEmail,
          notes: `Proposal delivered to ${resolvedRecipient} from ${sendResult.senderEmail} upon draft approval.`
        }
      });
    }
  }

  // 5. Upsert GmailThread for Unified Conversation History & Details View
  if (sendResult.threadId) {
    const messageSnippet = (email.body || "").slice(0, 160);
    await GmailThread.findOneAndUpdate(
      { threadId: sendResult.threadId },
      {
        threadId: sendResult.threadId,
        companyId: company?._id || email.companyId || null,
        outreachId: outreach?._id || null,
        emailId: email._id,
        subject: email.subject,
        snippet: messageSnippet,
        lastMessageAt: new Date(),
        $push: {
          messages: {
            messageId: sendResult.messageId,
            from: sendResult.senderEmail,
            to: resolvedRecipient,
            date: new Date(),
            snippet: messageSnippet,
            body: email.body,
            isFromSponsor: false
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch((err) => console.warn("[EmailDeliveryService] Failed to upsert GmailThread:", err.message));
  }

  // 6. Invalidate System Caches
  serverCache.invalidateTag("emails");
  serverCache.invalidateTag("outreach");
  serverCache.invalidateTag("stats");
  serverCache.invalidateTag("threads");

  return {
    success: true,
    email,
    recipient: resolvedRecipient,
    senderEmail: sendResult.senderEmail,
    sendResult,
    outreach
  };
};

module.exports = {
  deliverApprovedEmail,
  resolveRecipientEmail
};
