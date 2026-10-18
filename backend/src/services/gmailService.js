const { google } = require("googleapis");
const GmailToken = require("../models/gmailToken");

// ─── OAuth2 Client ─────────────────────────────────────────────────────────
const createOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
};

// Scopes needed: send email + read inbox threads
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
];

// ─── Generate OAuth Consent URL ─────────────────────────────────────────────
const getAuthUrl = () => {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return null;
  }
  const oAuth2Client = createOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",   // offline = we get a refresh_token
    prompt: "consent",        // force consent so refresh_token is always returned
    scope: SCOPES
  });
};

// ─── Demo / Simulated Account Authorization ─────────────────────────────────
const connectDemoAccount = async ({ email = "sponsorships@hackathon.club" } = {}) => {
  const senderEmail = email || process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club";
  const tokenDoc = await GmailToken.findOneAndUpdate(
    { email: senderEmail },
    {
      email: senderEmail,
      accessToken: `demo_token_${Date.now()}`,
      refreshToken: `demo_refresh_${Date.now()}`,
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      scope: SCOPES.join(" ")
    },
    { upsert: true, new: true }
  );
  return tokenDoc;
};

const disconnectAccount = async () => {
  await GmailToken.deleteMany({});
  return { success: true };
};

// ─── Exchange Auth Code for Tokens ──────────────────────────────────────────
const exchangeCodeForTokens = async (code) => {
  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Get the authenticated Gmail account email
  const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email;

  // Persist tokens in DB (upsert by email)
  await GmailToken.findOneAndUpdate(
    { email },
    {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope || SCOPES.join(" ")
    },
    { upsert: true, new: true }
  );

  return { email, tokens };
};

// ─── Load a Fresh Authenticated OAuth Client from DB ────────────────────────
const getAuthenticatedClient = async () => {
  let tokenDoc = await GmailToken.findOne().sort({ updatedAt: -1 });

  // If no token exists and no Google OAuth credentials are set, auto-connect demo
  if (!tokenDoc) {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
      tokenDoc = await connectDemoAccount();
    } else {
      const error = new Error(
        "Gmail not authorized. Please complete OAuth flow at GET /gmail/oauth/start"
      );
      error.statusCode = 401;
      throw error;
    }
  }

  const isDemo = Boolean(tokenDoc.accessToken && tokenDoc.accessToken.startsWith("demo_"));
  if (isDemo || !process.env.GMAIL_CLIENT_ID) {
    return { oAuth2Client: null, senderEmail: tokenDoc.email, isDemo: true };
  }

  const oAuth2Client = createOAuthClient();
  oAuth2Client.setCredentials({
    access_token: tokenDoc.accessToken,
    refresh_token: tokenDoc.refreshToken,
    expiry_date: tokenDoc.expiryDate ? tokenDoc.expiryDate.getTime() : null
  });

  // Auto-refresh: if access token expired, googleapis refreshes it automatically.
  // We hook into the token refresh event to persist the new token to DB.
  oAuth2Client.on("tokens", async (newTokens) => {
    const updates = {};
    if (newTokens.access_token) updates.accessToken = newTokens.access_token;
    if (newTokens.expiry_date) updates.expiryDate = new Date(newTokens.expiry_date);
    if (newTokens.refresh_token) updates.refreshToken = newTokens.refresh_token;

    await GmailToken.findOneAndUpdate(
      { email: tokenDoc.email },
      updates
    );
    console.log(`[GmailService] Tokens auto-refreshed for ${tokenDoc.email}`);
  });

  return { oAuth2Client, senderEmail: tokenDoc.email, isDemo: false };
};

// ─── Check Auth Status ───────────────────────────────────────────────────────
const getAuthStatus = async () => {
  const tokenDoc = await GmailToken.findOne().sort({ updatedAt: -1 });
  const hasGoogleCredentials = Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
  if (!tokenDoc) {
    return {
      authorized: false,
      email: null,
      isDemo: false,
      hasGoogleCredentials,
      expiryDate: null
    };
  }
  const isDemo = Boolean(tokenDoc.accessToken && tokenDoc.accessToken.startsWith("demo_"));
  return {
    authorized: true,
    email: tokenDoc.email,
    isDemo,
    hasGoogleCredentials,
    expiryDate: tokenDoc.expiryDate,
    updatedAt: tokenDoc.updatedAt
  };
};

// ─── Create RFC 2822 MIME Message ──────────────────────────────────────────
const makeEmailRaw = ({ to, from, subject, body, inReplyTo = null }) => {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject || "").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit"
  ];

  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${inReplyTo}`);
  }

  lines.push("");
  lines.push(body || "");

  const rawMime = lines.join("\r\n");
  return Buffer.from(rawMime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// ─── Send Email via Gmail API (Phase 3) ────────────────────────────────────
const sendEmailViaGmail = async ({
  to,
  subject,
  body,
  threadId = null,
  inReplyTo = null,
  mock = false
}) => {
  if (!to) {
    const error = new Error("Recipient address 'to' is required");
    error.statusCode = 400;
    throw error;
  }

  // If mock mode, or test env, or demo token, or live Google credentials not set
  if (mock || process.env.NODE_ENV === "test" || process.env.GMAIL_MOCK === "true" || !process.env.GMAIL_CLIENT_ID) {
    const mockId = `msg_${Date.now()}`;
    const mockThreadId = threadId || `thread_${Date.now()}`;
    return {
      messageId: mockId,
      threadId: mockThreadId,
      senderEmail: process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club",
      isMock: true
    };
  }

  const authResult = await getAuthenticatedClient();
  if (authResult.isDemo || !authResult.oAuth2Client) {
    const mockId = `msg_${Date.now()}`;
    const mockThreadId = threadId || `thread_${Date.now()}`;
    return {
      messageId: mockId,
      threadId: mockThreadId,
      senderEmail: authResult.senderEmail || process.env.GMAIL_SENDER_EMAIL || "sponsorships@hackathon.club",
      isMock: true
    };
  }

  const { oAuth2Client, senderEmail } = authResult;
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const raw = makeEmailRaw({
    to,
    from: senderEmail,
    subject,
    body,
    inReplyTo
  });

  const requestBody = { raw };
  if (threadId) {
    requestBody.threadId = threadId;
  }

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody
  });

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
    senderEmail
  };
};

// ─── Extract plain text body from Gmail message payload ─────────────────────
const extractBodyFromPayload = (payload) => {
  if (!payload) return "";
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    if (payload.parts[0]?.body?.data) {
      return Buffer.from(payload.parts[0].body.data, "base64").toString("utf-8");
    }
  }
  return "";
};

// ─── Fetch Thread Details (Phase 4) ─────────────────────────────────────────
const fetchThread = async (threadId, mock = false) => {
  if (!threadId) {
    const error = new Error("threadId parameter is required");
    error.statusCode = 400;
    throw error;
  }

  const { GmailThread } = require("../models/gmailThread");
  const threadDoc = await GmailThread.findOne({ threadId });

  // If live Google Cloud credentials exist and mock is not forced, try live Gmail API
  if (process.env.GMAIL_CLIENT_ID && !mock) {
    try {
      const authResult = await getAuthenticatedClient();
      if (!authResult.isDemo && authResult.oAuth2Client) {
        const { oAuth2Client, senderEmail } = authResult;
        const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

        const response = await gmail.users.threads.get({
          userId: "me",
          id: threadId,
          format: "full"
        });

        const rawMessages = response.data.messages || [];
        let subject = "";
        let snippet = response.data.snippet || "";

        const parsedMessages = rawMessages.map((msg) => {
          const headers = msg.payload?.headers || [];
          const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          const msgSubject = getHeader("Subject");
          if (msgSubject && !subject) subject = msgSubject;

          const from = getHeader("From");
          const to = getHeader("To");
          const dateStr = getHeader("Date");
          const body = extractBodyFromPayload(msg.payload);

          const isFromSponsor =
            from.toLowerCase().indexOf(senderEmail.toLowerCase()) === -1;

          return {
            messageId: msg.id,
            from,
            to,
            date: dateStr ? new Date(dateStr) : new Date(parseInt(msg.internalDate, 10)),
            snippet: msg.snippet || "",
            body,
            isFromSponsor
          };
        });

        const lastMsg = parsedMessages[parsedMessages.length - 1];

        return {
          threadId: response.data.id,
          subject: subject || snippet,
          snippet,
          lastMessageAt: lastMsg ? lastMsg.date : new Date(),
          messages: parsedMessages
        };
      }
    } catch (apiErr) {
      console.warn("[GmailService] Live thread fetch failed:", apiErr.message);
    }
  }

  // If thread exists in DB cache
  if (threadDoc) {
    return {
      threadId,
      subject: threadDoc.subject || "Outreach Thread",
      snippet: threadDoc.snippet || "",
      lastMessageAt: threadDoc.lastMessageAt || threadDoc.updatedAt || new Date(),
      messages: threadDoc.messages || []
    };
  }

  // Clean empty state if thread does not exist yet
  return {
    threadId,
    subject: "Outreach Thread",
    snippet: "No messages recorded yet.",
    lastMessageAt: new Date(),
    messages: []
  };
};

// ─── List Inbox Messages / Threads (Phase 4) ────────────────────────────────
const listInboxMessages = async ({ q = "", maxResults = 20, mock = false } = {}) => {
  if (process.env.GMAIL_CLIENT_ID && !mock) {
    try {
      const authResult = await getAuthenticatedClient();
      if (!authResult.isDemo && authResult.oAuth2Client) {
        const { oAuth2Client } = authResult;
        const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

        const res = await gmail.users.threads.list({
          userId: "me",
          q: q || "in:inbox",
          maxResults
        });

        const threads = res.data.threads || [];
        return threads.map((t) => ({
          id: t.id,
          threadId: t.id,
          snippet: t.snippet || "",
          historyId: t.historyId
        }));
      }
    } catch (apiErr) {
      console.warn("[GmailService] Live list messages failed:", apiErr.message);
    }
  }

  // Return tracked threads from DB
  const { GmailThread } = require("../models/gmailThread");
  const threads = await GmailThread.find({}).sort({ updatedAt: -1 }).limit(maxResults);
  return threads.map((t) => ({
    id: t.threadId,
    threadId: t.threadId,
    snippet: t.snippet || t.subject || "",
    subject: t.subject,
    date: t.lastMessageAt || t.updatedAt
  }));
};

// ─── AI-Assisted Reply Classifier (Phase 4) ─────────────────────────────────
const classifyReplyWithAI = async (replyText, companyContext = "") => {
  if (!replyText || !replyText.trim()) {
    return {
      suggestedLabel: "NO_REPLY",
      confidence: "HIGH",
      reason: "No reply content detected"
    };
  }

  const text = replyText.toLowerCase();

  // Try live Gemini classification if GEMINI_API_KEY is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = require("@google/genai");
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

      const prompt = `
You are SponcyBot's Reply Classifier for hackathon sponsorship outreach.
Analyze this sponsor reply and classify it into exactly ONE category:
- "INTERESTED": Sponsor wants to talk, asks for a deck/call, agrees to sponsor, offers credits/goodies, or forwards to decision maker.
- "DECLINED": Sponsor says no, budget full, passes, unable to participate, or not interested.
- "OTHER": Ambiguous response, out-of-office autoreply, or asks unrelated questions.

Reply text:
"""
${replyText.slice(0, 1500)}
"""

Return ONLY raw JSON with no markdown:
{
  "suggestedLabel": "INTERESTED" | "DECLINED" | "OTHER",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reason": "Brief one sentence rationale"
}
`.trim();

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const parsed = JSON.parse(response.text.replace(/```json/g, "").replace(/```/g, "").trim());
      if (parsed && ["INTERESTED", "DECLINED", "OTHER"].includes(parsed.suggestedLabel)) {
        return parsed;
      }
    } catch (llmErr) {
      console.warn("[classifyReplyWithAI] LLM classification error, using heuristic fallback:", llmErr.message);
    }
  }

  // Robust Heuristic Engine fallback
  const positiveKeywords = [
    "interest", "happy to", "love to", "call", "meet", "schedule",
    "zoom", "discuss", "deck", "presentation", "tier", "support",
    "forward", "partner", "connect", "credits", "swag", "goodies"
  ];
  const negativeKeywords = [
    "decline", "unfortunately", "pass", "no budget", "cannot sponsor",
    "unable to", "not at this time", "not interested", "budget exhausted",
    "not possible", "sorry"
  ];
  const oooKeywords = [
    "out of office", "automatic reply", "on leave", "vacation", "autoreply"
  ];

  if (oooKeywords.some((w) => text.includes(w))) {
    return {
      suggestedLabel: "OTHER",
      confidence: "HIGH",
      reason: "Automated out-of-office message detected"
    };
  }

  const positiveScore = positiveKeywords.reduce((count, w) => (text.includes(w) ? count + 1 : count), 0);
  const negativeScore = negativeKeywords.reduce((count, w) => (text.includes(w) ? count + 1 : count), 0);

  if (positiveScore > negativeScore) {
    return {
      suggestedLabel: "INTERESTED",
      confidence: positiveScore >= 2 ? "HIGH" : "MEDIUM",
      reason: "Sponsor indicated positive interest with intent to connect or explore tiers."
    };
  }

  if (negativeScore > positiveScore) {
    return {
      suggestedLabel: "DECLINED",
      confidence: negativeScore >= 2 ? "HIGH" : "MEDIUM",
      reason: "Sponsor declined or indicated budget constraints."
    };
  }

  return {
    suggestedLabel: "OTHER",
    confidence: "LOW",
    reason: "Ambiguous response requiring manual human evaluation."
  };
};

module.exports = {
  getAuthUrl,
  connectDemoAccount,
  disconnectAccount,
  exchangeCodeForTokens,
  getAuthenticatedClient,
  getAuthStatus,
  makeEmailRaw,
  sendEmailViaGmail,
  extractBodyFromPayload,
  fetchThread,
  listInboxMessages,
  classifyReplyWithAI
};
