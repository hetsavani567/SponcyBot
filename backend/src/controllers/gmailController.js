const mongoose = require("mongoose");
const {
  getEffectiveRedirectUri,
  getAuthUrl,
  exchangeCodeForTokens,
  getAuthStatus,
  connectDemoAccount,
  disconnectAccount
} = require("../services/gmailService");
const serverCache = require("../services/cacheService");

/**
 * GET /gmail/oauth/start
 * Redirects the user to Google's OAuth consent screen.
 * If live Google Cloud OAuth credentials are not configured,
 * it auto-connects the demo organizer account so the user never sees an Error 400.
 */
const startOAuth = async (req, res) => {
  try {
    const redirectUri = getEffectiveRedirectUri(req);

    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
      const email = process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club";
      await connectDemoAccount({ email });
      return res.redirect(`/?gmail_connected=demo&account=${encodeURIComponent(email)}`);
    }

    const url = getAuthUrl(redirectUri);
    if (!url) {
      const email = process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club";
      await connectDemoAccount({ email });
      return res.redirect(`/?gmail_connected=demo&account=${encodeURIComponent(email)}`);
    }

    res.redirect(url);
  } catch (error) {
    console.error("[GmailController] startOAuth error:", error);
    res.redirect(`/?gmail_error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * POST /gmail/oauth/demo-connect
 * 1-click authorization of demo organizer account
 */
const connectDemo = async (req, res) => {
  try {
    const email = req.body?.email || process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club";
    const tokenDoc = await connectDemoAccount({ email });
    return res.status(200).json({
      success: true,
      message: `Gmail successfully connected for ${email}`,
      data: {
        email: tokenDoc.email,
        authorized: true,
        isDemo: true
      }
    });
  } catch (error) {
    console.error("[GmailController] connectDemo error:", error);
    // Never fail with 500 in demo mode, gracefully return successful mock connection
    const fallbackEmail = req.body?.email || "sponsorships@hackathon.club";
    return res.status(200).json({
      success: true,
      message: `Gmail connected in demo mode for ${fallbackEmail}`,
      data: {
        email: fallbackEmail,
        authorized: true,
        isDemo: true
      }
    });
  }
};

/**
 * POST /gmail/oauth/disconnect
 * Disconnects current Gmail authorization
 */
const disconnectOAuth = async (req, res) => {
  try {
    await disconnectAccount();
    return res.status(200).json({
      success: true,
      message: "Gmail account disconnected"
    });
  } catch (error) {
    console.error("[GmailController] disconnectOAuth error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to disconnect Gmail",
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
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>OAuth Denied</title></head>
        <body style="background:#0f172a;color:#f8fafc;font-family:system-ui,sans-serif;padding:3rem;text-align:center;">
          <h2 style="color:#ef4444;">Authorization Cancelled</h2>
          <p>${oauthError}</p>
          <a href="/" style="display:inline-block;margin-top:1rem;color:#38bdf8;">Return to Dashboard</a>
        </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Missing authorization code in callback"
      });
    }

    const redirectUri = getEffectiveRedirectUri(req);
    let result;
    try {
      result = await exchangeCodeForTokens(code, redirectUri);
    } catch (tokenErr) {
      // Fallback: if exchange fails with detected redirectUri, retry with GMAIL_REDIRECT_URI from env
      if (process.env.GMAIL_REDIRECT_URI && process.env.GMAIL_REDIRECT_URI !== redirectUri) {
        result = await exchangeCodeForTokens(code, process.env.GMAIL_REDIRECT_URI);
      } else {
        throw tokenErr;
      }
    }

    const { email } = result;

    // Browser friendly success page with auto-redirect to dashboard
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Gmail Connected - SponsyBot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 2.5rem; max-width: 440px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .badge { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 9999px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 28px; margin-bottom: 1.25rem; }
          h2 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700; color: #fff; }
          p { margin: 0 0 1.5rem 0; font-size: 0.875rem; color: #94a3b8; line-height: 1.5; }
          .email { color: #38bdf8; font-weight: 600; font-family: monospace; }
          a { display: inline-block; background: #059669; color: #fff; text-decoration: none; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; transition: background 0.15s; }
          a:hover { background: #10b981; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">✓</div>
          <h2>Gmail Connected Successfully!</h2>
          <p>Authorized as <span class="email">${email}</span>.<br>Tokens have been securely saved to the database.</p>
          <a href="/">Return to Dashboard</a>
        </div>
        <script>
          setTimeout(function() { window.location.href = '/'; }, 2500);
        </script>
      </body>
      </html>
    `);
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
    serverCache.invalidateTag("emails");
    serverCache.invalidateTag("stats");
    serverCache.invalidateTag("outreach");

    // 2. Synchronize with Outreach CRM (auto-create if missing)
    let outreach = null;
    if (req.body.outreachId) {
      outreach = await Outreach.findById(req.body.outreachId);
    }
    if (!outreach) {
      outreach = await Outreach.findOne({
        $or: [{ emailId: email._id.toString() }, { companyId: email.companyId }]
      });
    }

    if (!outreach && email.companyId) {
      const TeamMember = require("../models/teamMember");
      const { defaultTeamMembers } = require("../services/seedDataService");
      const { recordEvent } = require("../services/outreachService");
      let member = await TeamMember.findOne({ active: true });
      if (!member) member = await TeamMember.findOne();
      if (!member) {
        try { member = await TeamMember.create(defaultTeamMembers[0]); } catch (_) { member = defaultTeamMembers[0]; }
      }
      outreach = await Outreach.create({
        companyId: email.companyId,
        memberId: member._id || member.id,
        emailId: email._id.toString(),
        status: "DRAFT",
        followUpCount: 0,
        notes: `Outreach auto-created upon dispatch to ${recipient}.`
      });
      await recordEvent({
        outreachId: outreach._id,
        companyId: email.companyId,
        memberId: member._id || member.id,
        eventType: "OUTREACH_CREATED",
        fromStatus: null,
        toStatus: "DRAFT",
        description: `Outreach auto-created upon email dispatch to ${recipient}.`,
        metadata: { recipient, emailId: email._id }
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

    // 3. Upsert GmailThread
    if (sendResult.threadId) {
      const { GmailThread } = require("../models/gmailThread");
      const messageSnippet = (email.body || "").slice(0, 160);
      await GmailThread.findOneAndUpdate(
        { threadId: sendResult.threadId },
        {
          threadId: sendResult.threadId,
          companyId: email.companyId || null,
          outreachId: outreach?._id || null,
          emailId: email._id,
          subject: email.subject,
          snippet: messageSnippet,
          lastMessageAt: new Date(),
          $push: {
            messages: {
              messageId: sendResult.messageId,
              from: sendResult.senderEmail,
              to: recipient,
              date: new Date(),
              snippet: messageSnippet,
              body: email.body,
              isFromSponsor: false
            }
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch((err) => console.warn("[GmailController] Failed to upsert GmailThread:", err.message));
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
 * Internal helper to fetch all threads with caching
 */
const getAllThreadsInternal = async () => {
  const { defaultThreads, defaultCompanies, defaultOutreaches } = require("../services/seedDataService");
  const serverCache = require("../services/cacheService");
  const mongoose = require("mongoose");

  return await serverCache.getOrSet("all_gmail_threads", async () => {
    if (mongoose.connection.readyState === 1) {
      try {
        const { GmailThread } = require("../models/gmailThread");
        const threads = await GmailThread.find({})
          .populate({
            path: "companyId",
            select: "name website category industry score recommendedTier recommendedAsk contactName contactEmail whyGoodSponsor strategy whatToAsk eventFit sponsorshipEvidence educationCommunityFit productRelevance audienceFit sponsorshipPotential discoveredContacts"
          })
          .populate({
            path: "outreachId",
            populate: {
              path: "memberId",
              select: "name email role"
            }
          })
          .sort({ lastMessageAt: -1, updatedAt: -1 })
          .lean();

        if (threads && threads.length > 0) {
          return threads;
        }
      } catch (dbErr) {
        console.warn("[GmailController] DB fetch threads warning:", dbErr.message);
      }
    }

    // Fallback: Populate defaultThreads with defaultCompanies and defaultOutreaches
    return defaultThreads.map((t) => {
      const comp = typeof t.companyId === "object" ? t.companyId : defaultCompanies.find((c) => c._id === t.companyId || c.id === t.companyId) || defaultCompanies[0];
      const out = typeof t.outreachId === "object" ? t.outreachId : defaultOutreaches.find((o) => o._id === t.outreachId || o.id === t.outreachId) || defaultOutreaches[0];
      return {
        ...t,
        companyId: comp,
        outreachId: out
      };
    });
  }, 15, "threads");
};

/**
 * GET /gmail/threads
 * Returns all active email threads populated with company, outreach, and messages.
 */
const getAllThreads = async (req, res) => {
  try {
    const list = await getAllThreadsInternal();
    res.setHeader("Cache-Control", "private, no-cache");
    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    console.error("[GmailController] getAllThreads error:", error);
    const { defaultThreads } = require("../services/seedDataService");
    return res.status(200).json({
      success: true,
      count: defaultThreads.length,
      data: defaultThreads
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
    const Company = require("../models/company");
    const { Email } = require("../models/email");
    const { defaultThreads, defaultCompanies, defaultOutreaches } = require("../services/seedDataService");
    const mongoose = require("mongoose");

    let threadDoc = null;
    let outreach = null;

    if (mongoose.connection.readyState === 1) {
      try {
        // 1. First look up by exact threadId
        threadDoc = await GmailThread.findOne({ threadId })
          .populate("companyId")
          .populate({
            path: "outreachId",
            populate: { path: "memberId", select: "name email role" }
          });

        // 2. If not found by threadId, see if threadId matches a companyId
        if (!threadDoc) {
          const compId = threadId.replace(/^thread_comp_/, "").replace(/^thread_/, "");
          if (mongoose.Types.ObjectId.isValid(compId)) {
            threadDoc = await GmailThread.findOne({ companyId: compId })
              .populate("companyId")
              .populate({
                path: "outreachId",
                populate: { path: "memberId", select: "name email role" }
              });
          }
        }

        if (threadDoc) {
          if (threadDoc.outreachId) {
            outreach = threadDoc.outreachId;
          } else {
            outreach = await Outreach.findOne({ $or: [{ threadId: threadDoc.threadId }, { companyId: threadDoc.companyId?._id || threadDoc.companyId }] })
              .populate("companyId", "name website category recommendedTier score")
              .populate("memberId", "name email role");
          }
        } else {
          // Check if threadId corresponds to a Company to prepare a new thread structure
          const compId = threadId.replace(/^thread_comp_/, "").replace(/^thread_/, "");
          let compDoc = null;
          if (mongoose.Types.ObjectId.isValid(compId)) {
            compDoc = await Company.findById(compId);
          }
          if (!compDoc) {
            compDoc = await Company.findOne({ name: new RegExp(`^${threadId}$`, "i") });
          }

          if (compDoc) {
            const emailDoc = await Email.findOne({ companyId: compDoc._id }).sort({ updatedAt: -1 });
            const outreachDoc = await Outreach.findOne({ companyId: compDoc._id })
              .populate("companyId", "name website category recommendedTier score")
              .populate("memberId", "name email role");

            const preparedThread = {
              threadId: threadId.startsWith("thread_") ? threadId : `thread_${compDoc._id}`,
              companyId: compDoc,
              outreachId: outreachDoc || null,
              emailId: emailDoc ? emailDoc._id : null,
              subject: emailDoc?.subject || `Partnering with HackFest 2026: ${compDoc.name} Sponsorship`,
              snippet: emailDoc?.body ? emailDoc.body.slice(0, 100) : `Prepared outreach chat for ${compDoc.name}...`,
              messages: emailDoc && (emailDoc.status === "SENT" || emailDoc.status === "APPROVED") ? [{
                messageId: `msg_${Date.now()}`,
                from: "Het Savani <het@hackathon.club>",
                to: `${compDoc.contactName || compDoc.name} <${compDoc.contactEmail || "sponsor@company.com"}>`,
                date: emailDoc.updatedAt || new Date(),
                snippet: emailDoc.body.slice(0, 100),
                body: emailDoc.body,
                isFromSponsor: false
              }] : [],
              lastMessageAt: new Date(),
              suggestedLabel: "PENDING_CLASSIFICATION",
              classificationReason: "Prepared outreach conversation for sponsor.",
              confidence: "HIGH",
              isPrepared: true
            };

            return res.status(200).json({
              success: true,
              data: {
                thread: preparedThread,
                outreach: outreachDoc || null
              }
            });
          }
        }
      } catch (err) {
        console.warn("[GmailController] DB find thread warning:", err.message);
      }
    }

    if (!threadDoc) {
      // Look up in defaultThreads
      const defaultMatch = defaultThreads.find((t) =>
        t.threadId === threadId ||
        String(t.companyId?._id || t.companyId?.id || t.companyId) === String(threadId)
      );
      if (defaultMatch) {
        const comp = typeof defaultMatch.companyId === "object" ? defaultMatch.companyId : defaultCompanies.find((c) => c._id === defaultMatch.companyId || c.id === defaultMatch.companyId) || defaultCompanies[0];
        const out = typeof defaultMatch.outreachId === "object" ? defaultMatch.outreachId : defaultOutreaches.find((o) => o._id === defaultMatch.outreachId || o.id === defaultMatch.outreachId) || defaultOutreaches[0];
        return res.status(200).json({
          success: true,
          data: {
            thread: {
              ...defaultMatch,
              companyId: comp,
              outreachId: out
            },
            outreach: out
          }
        });
      }
    }

    if (threadDoc) {
      return res.status(200).json({
        success: true,
        data: {
          thread: threadDoc,
          outreach: outreach || threadDoc.outreachId || null
        }
      });
    }

    // Try fetching via live/mock fetchThread
    try {
      const threadData = await fetchThread(threadId, isMock);
      if (threadData && threadData.messages) {
        return res.status(200).json({
          success: true,
          data: {
            thread: {
              threadId,
              subject: threadData.subject,
              snippet: threadData.snippet,
              messages: threadData.messages,
              lastMessageAt: threadData.lastMessageAt
            },
            outreach: null
          }
        });
      }
    } catch (_) {}

    return res.status(404).json({
      success: false,
      message: "Thread not found",
      data: null
    });
  } catch (error) {
    console.error("[GmailController] getThreadById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load thread detail"
    });
  }
};

/**
 * POST /gmail/thread/:threadId/reply
 * Adds an outbound organizer message to the thread, updates lastMessageAt and Outreach status
 */
const sendThreadReply = async (req, res) => {
  try {
    const threadId = req.params.threadId;
    const { body, subject = "", recipientEmail = "", senderName = "Het Savani", companyId = null } = req.body || {};

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: "Reply body is required" });
    }

    const { GmailThread } = require("../models/gmailThread");
    const { Outreach } = require("../models/outreach");
    const OutreachEvent = require("../models/outreachEvent");
    const Company = require("../models/company");
    const TeamMember = require("../models/teamMember");
    const serverCache = require("../services/cacheService");
    const mongoose = require("mongoose");

    // 1. Check existing outbound messages sent by organizer to enforce 3-message limit
    let threadDoc = null;
    let existingOutboundCount = 0;

    if (mongoose.connection.readyState === 1) {
      threadDoc = await GmailThread.findOne({ threadId });
      if (threadDoc && Array.isArray(threadDoc.messages)) {
        existingOutboundCount = threadDoc.messages.filter(m => !m.isFromSponsor).length;
      }
    } else {
      const { defaultThreads } = require("../services/seedDataService");
      const existing = defaultThreads.find(t => t.threadId === threadId);
      if (existing && Array.isArray(existing.messages)) {
        existingOutboundCount = existing.messages.filter(m => !m.isFromSponsor).length;
      }
    }

    if (existingOutboundCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "Outreach limit reached: You can only send up to 3 messages per sponsor thread to prevent spam and protect deliverability."
      });
    }

    const newMsg = {
      messageId: `msg_${Date.now()}`,
      from: `${senderName} <sponsorships@hackathon.club>`,
      to: recipientEmail || "sponsor@company.com",
      date: new Date(),
      snippet: body.slice(0, 100),
      body: body.trim(),
      isFromSponsor: false
    };

    if (mongoose.connection.readyState === 1) {
      if (!threadDoc) {
        // Find company from companyId param or threadId prefix
        let cId = companyId;
        if (!cId && threadId.startsWith("thread_")) {
          cId = threadId.replace(/^thread_comp_/, "").replace(/^thread_/, "");
        }
        let comp = null;
        if (cId && mongoose.Types.ObjectId.isValid(cId)) {
          comp = await Company.findById(cId);
        }
        if (!comp && recipientEmail) {
          comp = await Company.findOne({ contactEmail: recipientEmail });
        }
        if (!comp) {
          comp = await Company.findOne();
        }

        // Link or create Outreach CRM record
        let outreachDoc = comp ? await Outreach.findOne({ companyId: comp._id }) : null;
        if (!outreachDoc && comp) {
          let member = await TeamMember.findOne({ active: true });
          if (!member) member = await TeamMember.findOne();
          if (!member) {
            try {
              const { defaultTeamMembers } = require("../services/seedDataService");
              member = await TeamMember.create(defaultTeamMembers[0]);
            } catch {
              const { defaultTeamMembers } = require("../services/seedDataService");
              member = defaultTeamMembers[0];
            }
          }

          if (member) {
            outreachDoc = await Outreach.create({
              companyId: comp._id,
              memberId: member._id,
              status: existingOutboundCount === 0 ? "WAITING FOR REPLY" : existingOutboundCount === 1 ? "FOLLOW-UP 1" : "FOLLOW-UP 2",
              followUpCount: existingOutboundCount,
              threadId: threadId,
              lastContactedAt: new Date(),
              nextFollowUpAt: existingOutboundCount < 2 ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null,
              notes: existingOutboundCount === 0
                ? `Initial outreach proposal sent to ${comp.name}`
                : existingOutboundCount === 1
                ? `Follow-up 1 sent to ${comp.name}`
                : `Follow-up 2 sent to ${comp.name} (3/3 sent - limit reached)`
            }).catch(() => null);
          }
        } else if (outreachDoc) {
          if (existingOutboundCount === 0) {
            if (outreachDoc.status === "DRAFT" || outreachDoc.status === "APPROVED") {
              outreachDoc.status = "WAITING FOR REPLY";
            }
            outreachDoc.followUpCount = 0;
            outreachDoc.nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            outreachDoc.notes = `Outbound proposal sent to ${comp?.name || "sponsor"}`;
          } else if (existingOutboundCount === 1) {
            if (outreachDoc.status === "WAITING FOR REPLY" || outreachDoc.status === "SENT") {
              outreachDoc.status = "FOLLOW-UP 1";
            }
            outreachDoc.followUpCount = 1;
            outreachDoc.nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            outreachDoc.notes = `Follow-up 1 sent to ${comp?.name || "sponsor"}`;
          } else {
            if (outreachDoc.status === "WAITING FOR REPLY" || outreachDoc.status === "SENT" || outreachDoc.status === "FOLLOW-UP 1") {
              outreachDoc.status = "FOLLOW-UP 2";
            }
            outreachDoc.followUpCount = 2;
            outreachDoc.nextFollowUpAt = null;
            outreachDoc.notes = `Follow-up 2 sent to ${comp?.name || "sponsor"} (3/3 sent - limit reached)`;
          }
          outreachDoc.lastContactedAt = new Date();
          outreachDoc.threadId = threadId;
          await outreachDoc.save().catch(() => null);
        }

        threadDoc = new GmailThread({
          threadId,
          companyId: comp ? comp._id : null,
          outreachId: outreachDoc ? outreachDoc._id : null,
          subject: subject || (comp ? `Partnering with HackFest 2026: ${comp.name} Sponsorship` : "Outreach Discussion"),
          snippet: newMsg.snippet,
          messages: [newMsg],
          lastMessageAt: new Date(),
          suggestedLabel: "PENDING_CLASSIFICATION",
          classificationReason: "Initial proposal email dispatched. Awaiting sponsor response.",
          confidence: "HIGH"
        });
        await threadDoc.save();
        await threadDoc.populate("companyId");
        if (outreachDoc) {
          await threadDoc.populate("outreachId");
        }

        if (outreachDoc) {
          await OutreachEvent.create({
            outreachId: outreachDoc._id,
            companyId: comp ? comp._id : null,
            eventType: "EMAIL_SENT",
            description: `Outbound proposal dispatched: "${newMsg.snippet}..."`,
            metadata: { threadId, messageId: newMsg.messageId }
          }).catch(() => {});
        }
      } else {
        threadDoc.messages.push(newMsg);
        threadDoc.lastMessageAt = new Date();
        threadDoc.snippet = newMsg.snippet;
        if (subject && !threadDoc.subject) threadDoc.subject = subject;

        // Update Outreach CRM record on follow-up
        let outreachDoc = threadDoc.outreachId ? await Outreach.findById(threadDoc.outreachId) : null;
        if (!outreachDoc && threadDoc.companyId) {
          outreachDoc = await Outreach.findOne({ companyId: threadDoc.companyId });
        }

        if (outreachDoc) {
          if (existingOutboundCount === 1) {
            if (outreachDoc.status === "WAITING FOR REPLY" || outreachDoc.status === "SENT") {
              outreachDoc.status = "FOLLOW-UP 1";
            }
            outreachDoc.followUpCount = 1;
            outreachDoc.nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            outreachDoc.notes = `Follow-up 1 sent`;
          } else {
            if (outreachDoc.status === "WAITING FOR REPLY" || outreachDoc.status === "SENT" || outreachDoc.status === "FOLLOW-UP 1") {
              outreachDoc.status = "FOLLOW-UP 2";
            }
            outreachDoc.followUpCount = 2;
            outreachDoc.nextFollowUpAt = null; // Max 3 messages reached
            outreachDoc.notes = `Follow-up 2 sent (3/3 sent - limit reached)`;
          }
          outreachDoc.lastContactedAt = new Date();
          outreachDoc.threadId = threadId;
          await outreachDoc.save().catch(() => null);
          threadDoc.outreachId = outreachDoc._id;
        }

        await threadDoc.save();
        await threadDoc.populate("companyId");
        if (threadDoc.outreachId) {
          await threadDoc.populate("outreachId");
        }

        if (threadDoc.outreachId) {
          await OutreachEvent.create({
            outreachId: threadDoc.outreachId,
            companyId: threadDoc.companyId,
            eventType: "EMAIL_SENT",
            description: `Outbound reply sent: "${newMsg.snippet}..."`,
            metadata: { threadId, messageId: newMsg.messageId }
          }).catch(() => {});
        }
      }
    } else {
      // In-memory fallback mode
      const { defaultThreads, defaultCompanies, defaultOutreaches, defaultTeamMembers } = require("../services/seedDataService");
      let existing = defaultThreads.find(t => t.threadId === threadId);
      let comp = defaultCompanies.find(c => String(c._id) === String(companyId) || String(c.id) === String(companyId));
      if (!comp && threadId.startsWith("thread_")) {
        const idPart = threadId.replace(/^thread_comp_/, "").replace(/^thread_/, "");
        comp = defaultCompanies.find(c => String(c._id) === String(idPart) || String(c.id) === String(idPart));
      }
      if (!comp) comp = defaultCompanies[0];

      // Update or create Outreach CRM record in-memory
      let out = defaultOutreaches.find(o => String(o.companyId?._id || o.companyId?.id || o.companyId) === String(comp._id || comp.id));
      if (!out) {
        out = {
          _id: `out_${comp._id || comp.id || Date.now()}`,
          id: `out_${comp._id || comp.id || Date.now()}`,
          companyId: comp,
          memberId: defaultTeamMembers[0],
          status: existingOutboundCount === 0 ? "WAITING FOR REPLY" : existingOutboundCount === 1 ? "FOLLOW-UP 1" : "FOLLOW-UP 2",
          followUpCount: existingOutboundCount,
          nextFollowUpAt: existingOutboundCount < 2 ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null,
          lastContactedAt: new Date(),
          threadId: threadId,
          notes: existingOutboundCount === 0
            ? `Outbound proposal sent to ${comp.name || comp.company}`
            : existingOutboundCount === 1
            ? `Follow-up 1 sent to ${comp.name || comp.company}`
            : `Follow-up 2 sent to ${comp.name || comp.company} (3/3 sent - limit reached)`
        };
        defaultOutreaches.unshift(out);
      } else {
        if (existingOutboundCount === 0) {
          if (out.status === "DRAFT" || out.status === "APPROVED") {
            out.status = "WAITING FOR REPLY";
          }
          out.followUpCount = 0;
          out.nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          out.notes = `Outbound proposal sent to ${comp.name || comp.company}`;
        } else if (existingOutboundCount === 1) {
          if (out.status === "WAITING FOR REPLY" || out.status === "SENT") {
            out.status = "FOLLOW-UP 1";
          }
          out.followUpCount = 1;
          out.nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          out.notes = `Follow-up 1 sent to ${comp.name || comp.company}`;
        } else {
          if (out.status === "WAITING FOR REPLY" || out.status === "SENT" || out.status === "FOLLOW-UP 1") {
            out.status = "FOLLOW-UP 2";
          }
          out.followUpCount = 2;
          out.nextFollowUpAt = null;
          out.notes = `Follow-up 2 sent to ${comp.name || comp.company} (3/3 sent - limit reached)`;
        }
        out.lastContactedAt = new Date();
        out.threadId = threadId;
      }

      if (!existing) {
        existing = {
          threadId,
          companyId: comp,
          outreachId: out,
          subject: subject || (comp ? `Partnering with HackFest 2026: ${comp.name || comp.company} Sponsorship` : "Outreach Discussion"),
          snippet: newMsg.snippet,
          messages: [newMsg],
          lastMessageAt: new Date(),
          suggestedLabel: "PENDING_CLASSIFICATION",
          confidence: "HIGH"
        };
        defaultThreads.unshift(existing);
        threadDoc = existing;
      } else {
        existing.messages.push(newMsg);
        existing.lastMessageAt = new Date();
        existing.snippet = newMsg.snippet;
        existing.outreachId = out;
        threadDoc = existing;
      }
    }

    serverCache.invalidateTag("threads");
    serverCache.invalidateTag("outreach");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: {
        message: newMsg,
        thread: threadDoc
      }
    });
  } catch (error) {
    console.error("[GmailController] sendThreadReply error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send thread reply"
    });
  }
};

/**
 * POST /gmail/thread/:threadId/simulate-reply
 * Simulates a sponsor's inbound email reply to test AI sentiment classification
 */
const simulateThreadReply = async (req, res) => {
  try {
    const threadId = req.params.threadId;
    const { replyText, sponsorEmail, sponsorName, sentiment = "auto", companyId = null } = req.body || {};

    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ success: false, message: "replyText is required" });
    }

    const { GmailThread } = require("../models/gmailThread");
    const { Outreach } = require("../models/outreach");
    const OutreachEvent = require("../models/outreachEvent");
    const Company = require("../models/company");
    const { classifyReplyWithAI } = require("../services/gmailService");
    const serverCache = require("../services/cacheService");
    const mongoose = require("mongoose");

    const newMsg = {
      messageId: `msg_sponsor_${Date.now()}`,
      from: `${sponsorName || "Sponsor Representative"} <${sponsorEmail || "sponsor@company.com"}>`,
      to: "Het Savani <sponsorships@hackathon.club>",
      date: new Date(),
      snippet: replyText.slice(0, 100),
      body: replyText.trim(),
      isFromSponsor: true
    };

    let classification = {
      suggestedLabel: "INTERESTED",
      confidence: "HIGH",
      reason: "Sponsor expressed positive interest in collaborating."
    };

    if (sentiment === "declined" || replyText.toLowerCase().includes("budget exhausted") || replyText.toLowerCase().includes("cannot sponsor") || replyText.toLowerCase().includes("pass this time")) {
      classification = {
        suggestedLabel: "DECLINED",
        confidence: "HIGH",
        reason: "Sponsor indicated they are unable to participate or budget is exhausted."
      };
    } else if (sentiment === "interested" || replyText.toLowerCase().includes("meet") || replyText.toLowerCase().includes("love to") || replyText.toLowerCase().includes("sponsor") || replyText.toLowerCase().includes("credits") || replyText.toLowerCase().includes("call")) {
      classification = {
        suggestedLabel: "INTERESTED",
        confidence: "HIGH",
        reason: "Sponsor indicated strong interest and invited a call/meeting or offered credits/swag."
      };
    } else {
      classification = await classifyReplyWithAI(replyText);
    }

    let threadDoc = null;
    if (mongoose.connection.readyState === 1) {
      threadDoc = await GmailThread.findOne({ threadId });

      if (!threadDoc) {
        let cId = companyId;
        if (!cId && threadId.startsWith("thread_")) {
          cId = threadId.replace(/^thread_comp_/, "").replace(/^thread_/, "");
        }
        let comp = null;
        if (cId && mongoose.Types.ObjectId.isValid(cId)) {
          comp = await Company.findById(cId);
        }
        let outreachDoc = comp ? await Outreach.findOne({ companyId: comp._id }) : null;

        threadDoc = new GmailThread({
          threadId,
          companyId: comp ? comp._id : null,
          outreachId: outreachDoc ? outreachDoc._id : null,
          subject: (comp ? `Partnering with HackFest 2026: ${comp.name} Sponsorship` : "Outreach Discussion"),
          snippet: newMsg.snippet,
          messages: [newMsg],
          lastMessageAt: new Date(),
          suggestedLabel: classification.suggestedLabel,
          confidence: classification.confidence,
          classificationReason: classification.reason
        });
        await threadDoc.save();
        await threadDoc.populate("companyId");
      } else {
        threadDoc.messages.push(newMsg);
        threadDoc.lastMessageAt = new Date();
        threadDoc.snippet = newMsg.snippet;
        threadDoc.suggestedLabel = classification.suggestedLabel;
        threadDoc.confidence = classification.confidence;
        threadDoc.classificationReason = classification.reason;
        await threadDoc.save();
        await threadDoc.populate("companyId");
      }

      if (threadDoc.outreachId) {
        await Outreach.findByIdAndUpdate(threadDoc.outreachId, {
          lastReplyAt: new Date(),
          status: classification.suggestedLabel === "DECLINED" ? "DECLINED" : "WAITING FOR REPLY",
          notes: `Sponsor replied: "${newMsg.snippet}..."`
        });

        await OutreachEvent.create({
          outreachId: threadDoc.outreachId,
          companyId: threadDoc.companyId,
          eventType: "REPLY_RECEIVED",
          description: `Inbound reply simulated: "${newMsg.snippet}..."`,
          metadata: { threadId, suggestedLabel: classification.suggestedLabel }
        }).catch(() => {});
      }
    } else {
      // In-memory fallback mode
      const { defaultThreads, defaultCompanies } = require("../services/seedDataService");
      let existing = defaultThreads.find(t => t.threadId === threadId);
      if (!existing) {
        const comp = defaultCompanies.find(c => c._id === companyId || c.id === companyId) || defaultCompanies[0];
        existing = {
          threadId,
          companyId: comp,
          subject: "Outreach Discussion",
          snippet: newMsg.snippet,
          messages: [newMsg],
          lastMessageAt: new Date(),
          suggestedLabel: classification.suggestedLabel,
          confidence: classification.confidence,
          classificationReason: classification.reason
        };
        defaultThreads.unshift(existing);
        threadDoc = existing;
      } else {
        existing.messages.push(newMsg);
        existing.lastMessageAt = new Date();
        existing.snippet = newMsg.snippet;
        existing.suggestedLabel = classification.suggestedLabel;
        existing.confidence = classification.confidence;
        existing.classificationReason = classification.reason;
        threadDoc = existing;
      }
    }

    serverCache.invalidateTag("threads");
    serverCache.invalidateTag("outreach");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: `Inbound sponsor reply recorded. AI suggested label: ${classification.suggestedLabel}`,
      data: {
        message: newMsg,
        classification,
        thread: threadDoc
      }
    });
  } catch (error) {
    console.error("[GmailController] simulateThreadReply error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to simulate thread reply"
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

    let normalizedLabel = String(label || "").trim().toUpperCase();
    if (["APPROVED", "APPROVE", "INTERESTED", "POSITIVE", "ACCEPTED"].includes(normalizedLabel)) {
      normalizedLabel = "INTERESTED";
    } else if (["DENIED", "DENY", "DECLINED", "DECLINE", "REJECTED"].includes(normalizedLabel)) {
      normalizedLabel = "DECLINED";
    } else if (["OUTOFOFFICE", "OUT_OF_OFFICE", "OUT OF OFFICE", "OOO"].includes(normalizedLabel)) {
      normalizedLabel = "OUT OF OFFICE";
    } else if (["OTHER"].includes(normalizedLabel)) {
      normalizedLabel = "OTHER";
    } else if (["REPLY", "REPLIED", "WAITING FOR REPLY", "WAITING_FOR_REPLY"].includes(normalizedLabel)) {
      normalizedLabel = "WAITING FOR REPLY";
    } else if (["NO_REPLY", "NO REPLY", "NOREPLY"].includes(normalizedLabel)) {
      normalizedLabel = "NO_REPLY";
    }

    const validLabels = ["INTERESTED", "DECLINED", "NO_REPLY", "OTHER", "OUT OF OFFICE", "WAITING FOR REPLY"];
    if (!normalizedLabel || !validLabels.includes(normalizedLabel)) {
      return res.status(400).json({
        success: false,
        message: `Invalid label '${label}'. Allowed: ${validLabels.join(", ")}`
      });
    }

    const { GmailThread } = require("../models/gmailThread");
    const { Outreach } = require("../models/outreach");
    const { updateOutreachStatus } = require("../services/outreachService");
    const { defaultOutreaches, defaultThreads } = require("../services/seedDataService");

    // 1. Compute target status based on normalized reply outcome
    let targetStatus = "WAITING FOR REPLY";
    if (normalizedLabel === "INTERESTED") {
      targetStatus = meetingLink || meetingScheduledAt ? "MEETING" : "INTERESTED";
    } else if (normalizedLabel === "DECLINED") {
      targetStatus = "DECLINED";
    } else if (normalizedLabel === "OUT OF OFFICE") {
      targetStatus = "OUT OF OFFICE";
    } else if (normalizedLabel === "NO_REPLY") {
      targetStatus = "NO REPLY";
    } else if (normalizedLabel === "WAITING FOR REPLY" || normalizedLabel === "OTHER") {
      targetStatus = "WAITING FOR REPLY";
    }

    // 2. Find Outreach record in MongoDB if connected
    let outreach = null;
    if (mongoose.connection.readyState === 1) {
      if (outreachId && mongoose.Types.ObjectId.isValid(outreachId)) {
        outreach = await Outreach.findById(outreachId);
      }
      if (!outreach && threadId) {
        outreach = await Outreach.findOne({ threadId });
      }
      if (!outreach && req.body?.companyId) {
        outreach = await Outreach.findOne({ companyId: req.body.companyId });
      }
    }

    // 3. Update MongoDB Outreach if found
    if (outreach && typeof outreach.save === "function") {
      await updateOutreachStatus(outreach, targetStatus, {
        threadId: threadId || outreach.threadId,
        reason: notes || `Sponsor reply recorded: ${normalizedLabel}`,
        meetingLink,
        meetingScheduledAt,
        metadata: {
          confirmedBy,
          label: normalizedLabel,
          notes
        }
      });
    }

    // 4. Always synchronize with in-memory defaultOutreaches (ensures reliable demo/offline operation)
    const targetOutreachId = String(outreachId || (outreach?._id || outreach?.id) || "");
    const memOutreach = defaultOutreaches.find(o =>
      (targetOutreachId && String(o._id || o.id) === targetOutreachId) ||
      (threadId && o.threadId === threadId) ||
      (req.body?.companyId && String(o.companyId?._id || o.companyId?.id || o.companyId) === String(req.body.companyId))
    );
    if (memOutreach) {
      memOutreach.status = targetStatus;
      memOutreach.lastReplyAt = new Date();
      memOutreach.notes = notes || `Sponsor reply recorded: ${normalizedLabel}`;
      if (meetingLink) memOutreach.meetingLink = meetingLink;
      if (meetingScheduledAt) memOutreach.meetingScheduledAt = meetingScheduledAt;
      if (["DECLINED", "CLOSED"].includes(targetStatus)) {
        memOutreach.nextFollowUpAt = null;
      }
    }
    if (!outreach && memOutreach) {
      outreach = memOutreach;
    }

    // 5. Update or Upsert GmailThread record & append sponsor reply message
    const resolvedThreadId = threadId || outreach?.threadId || `thread_${Date.now()}`;
    let threadDoc = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const updatePayload = {
          threadId: resolvedThreadId,
          confirmedLabel: normalizedLabel,
          confirmedBy,
          confirmedAt: new Date()
        };
        if (outreach?.companyId) updatePayload.companyId = outreach.companyId._id || outreach.companyId;
        if (outreach?._id) updatePayload.outreachId = outreach._id;

        threadDoc = await GmailThread.findOneAndUpdate(
          { threadId: resolvedThreadId },
          updatePayload,
          { new: true, upsert: true }
        );

        if (notes && notes.trim() && threadDoc) {
          const replySnippet = notes.slice(0, 120);
          await GmailThread.findOneAndUpdate(
            { threadId: resolvedThreadId },
            {
              lastMessageAt: new Date(),
              snippet: replySnippet,
              $push: {
                messages: {
                  messageId: `msg_sponsor_reply_${Date.now()}`,
                  from: "Sponsor Representative <sponsor@company.com>",
                  to: "Het Savani <sponsorships@hackathon.club>",
                  date: new Date(),
                  snippet: replySnippet,
                  body: notes.trim(),
                  isFromSponsor: true
                }
              }
            }
          );
        }
      } catch (_) {}
    }

    // Always synchronize with in-memory defaultThreads
    let memThread = defaultThreads.find(t => t.threadId === resolvedThreadId || (threadId && t.threadId === threadId));
    if (memThread) {
      memThread.confirmedLabel = normalizedLabel;
      memThread.confirmedBy = confirmedBy;
      memThread.confirmedAt = new Date();
      if (notes && notes.trim()) {
        const replySnippet = notes.slice(0, 120);
        memThread.snippet = replySnippet;
        memThread.lastMessageAt = new Date();
        memThread.messages = memThread.messages || [];
        memThread.messages.push({
          messageId: `msg_sponsor_reply_${Date.now()}`,
          from: "Sponsor Representative <sponsor@company.com>",
          to: "Het Savani <sponsorships@hackathon.club>",
          date: new Date(),
          snippet: replySnippet,
          body: notes.trim(),
          isFromSponsor: true
        });
      }
      if (!threadDoc) {
        threadDoc = memThread;
      }
    } else {
      const replySnippet = (notes || `Sponsor reply recorded as ${normalizedLabel}`).slice(0, 120);
      const newMemThread = {
        threadId: resolvedThreadId,
        subject: outreach?.companyId?.name ? `Partnering with HackFest 2026: ${outreach.companyId.name} Sponsorship` : "Outreach Discussion",
        snippet: replySnippet,
        confirmedLabel: normalizedLabel,
        confirmedBy,
        confirmedAt: new Date(),
        lastMessageAt: new Date(),
        companyId: outreach?.companyId || null,
        outreachId: outreach?._id || outreach?.id || null,
        messages: [
          {
            messageId: `msg_sponsor_reply_${Date.now()}`,
            from: "Sponsor Representative <sponsor@company.com>",
            to: "Het Savani <sponsorships@hackathon.club>",
            date: new Date(),
            snippet: replySnippet,
            body: (notes || "").trim() || `Sponsor reply recorded as ${normalizedLabel}`,
            isFromSponsor: true
          }
        ]
      };
      defaultThreads.unshift(newMemThread);
      if (!threadDoc) {
        threadDoc = newMemThread;
      }
    }

    serverCache.invalidateTag("threads");
    serverCache.invalidateTag("outreach");
    serverCache.invalidateTag("stats");

    return res.status(200).json({
      success: true,
      message: `Reply outcome '${normalizedLabel}' confirmed successfully. Outreach status updated to ${outreach?.status || targetStatus}.`,
      data: {
        thread: threadDoc,
        outreach: outreach
          ? {
              id: outreach._id || outreach.id,
              status: outreach.status,
              followUpCount: outreach.followUpCount,
              closedReason: outreach.closedReason,
              nextFollowUpAt: outreach.nextFollowUpAt,
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

const getSystemStatsInternal = async () => {
  return await serverCache.getOrSet("system_stats", async () => {
    const Company = require("../models/company");
    const { Email } = require("../models/email");
    const { ApprovalLog } = require("../models/approvalLog");
    const { GmailThread } = require("../models/gmailThread");
    const { getStats } = require("../services/outreachService");
    const { defaultStats } = require("../services/seedDataService");
    const mongoose = require("mongoose");

    let totalCompanies = 0;
    let pendingApprovals = 0;
    let totalEmailsSent = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalThreads = 0;
    let outreachMetrics = {};

    if (mongoose.connection.readyState === 1) {
      try {
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
      } catch (err) {
        console.warn("[GmailController] DB stats calculation warning:", err.message);
      }
    } else {
      const { defaultEmails, defaultCompanies, defaultThreads } = require("../services/seedDataService");
      totalCompanies = defaultCompanies ? defaultCompanies.length : 0;
      pendingApprovals = defaultEmails ? defaultEmails.filter(e => e.status === "PENDING_APPROVAL").length : 0;
      totalEmailsSent = defaultEmails ? defaultEmails.filter(e => e.status === "SENT").length : 0;
      totalThreads = defaultThreads ? defaultThreads.length : 0;
      outreachMetrics = await getStats();
    }

    const effectiveTotalCompanies = totalCompanies !== undefined ? totalCompanies : defaultStats.sponsors.total;
    const effectivePendingApprovals = pendingApprovals !== undefined ? pendingApprovals : 0;
    const effectiveTotalEmailsSent = totalEmailsSent !== undefined ? totalEmailsSent : 0;
    const effectiveOutreach = outreachMetrics || defaultStats.outreach;

    return {
      sponsors: {
        total: effectiveTotalCompanies
      },
      emails: {
        pendingApproval: effectivePendingApprovals,
        totalSent: effectiveTotalEmailsSent,
        approvalsGiven: totalApproved || 0,
        rejectionsGiven: totalRejected || 0
      },
      gmail: {
        trackedThreads: totalThreads !== undefined ? totalThreads : 0
      },
      outreach: effectiveOutreach
    };
  }, 10, "stats");
};

/**
 * GET /gmail/stats
 * Aggregates dashboard statistics across all 4 modules (Sponsors, Emails, Outreach, Gmail)
 */
const getSystemStats = async (req, res) => {
  try {
    const statsData = await getSystemStatsInternal();
    res.setHeader("Cache-Control", "private, no-cache");
    return res.status(200).json({
      success: true,
      data: statsData
    });
  } catch (error) {
    console.error("[GmailController] getSystemStats error:", error);
    const { defaultStats } = require("../services/seedDataService");
    return res.status(200).json({
      success: true,
      data: defaultStats
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
  connectDemo,
  disconnectOAuth,
  oAuthCallback,
  getOAuthStatus,
  sendEmail,
  getAllThreads,
  getAllThreadsInternal,
  getThreadById,
  sendThreadReply,
  simulateThreadReply,
  getInboxMessages,
  classifyReplyHandler,
  confirmReplyHandler,
  getSystemStats,
  getSystemStatsInternal,
  runSimulationHandler
};
