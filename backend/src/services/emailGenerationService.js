const { generate } = require("../lib/aiClient");
const { buildEmailPrompt } = require("./emailPrompts");

const PLACEHOLDER_REGEX = /\[[a-zA-Z0-9_\s-]{2,40}\]/;

function parseAndValidateEmailResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty or non-string response from AI model");
  }

  // 1. Strip code fences
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  // 2. Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // Fallback if LLM generated raw unescaped newlines inside string literals
    try {
      const subjectMatch = cleaned.match(/"subject"\s*:\s*"([^"]+)"/i);
      const bodyKeyMatch = cleaned.match(/"body"\s*:\s*"/i);
      if (subjectMatch && bodyKeyMatch) {
        const bodyStart = cleaned.indexOf('"', cleaned.indexOf(bodyKeyMatch[0]) + bodyKeyMatch[0].length - 1) + 1;
        const bodyEnd = cleaned.lastIndexOf('"');
        if (bodyStart > 0 && bodyEnd > bodyStart) {
          parsed = {
            subject: subjectMatch[1].trim(),
            body: cleaned.slice(bodyStart, bodyEnd).trim()
          };
        }
      }
    } catch (_) {}

    if (!parsed) {
      throw new Error(`AI returned invalid JSON: ${err.message}`);
    }
  }

  // 3. Validate subject and body
  if (!parsed.subject || typeof parsed.subject !== "string" || !parsed.subject.trim()) {
    throw new Error("Generated email is missing a valid subject");
  }
  if (!parsed.body || typeof parsed.body !== "string" || !parsed.body.trim()) {
    throw new Error("Generated email is missing a valid body");
  }

  const subject = parsed.subject.trim();
  let body = parsed.body.trim();

  // Strip cliché openings if the LLM hallucinated them
  body = body.replace(/([^\n]+,\s*)(?:I hope (?:this email finds you well|you are doing well)[.,]?\s*)+/i, "$1");

  // 4. Reject bracket placeholders (e.g. [Your Name], [Insert Date], etc.)
  const subjectPlaceholder = subject.match(PLACEHOLDER_REGEX);
  if (subjectPlaceholder) {
    throw new Error(`Subject contains unpopulated placeholder: "${subjectPlaceholder[0]}"`);
  }

  const bodyPlaceholder = body.match(PLACEHOLDER_REGEX);
  if (bodyPlaceholder) {
    throw new Error(`Body contains unpopulated placeholder: "${bodyPlaceholder[0]}"`);
  }

  return { subject, body };
}

function generateFallbackEmail(company, options = {}) {
  const type = options.type || "initial";
  const tier = company.recommendedTier || "Silver";
  const ask = company.recommendedAsk || "money";
  const contact = company.contactName || "Partnerships Team";
  const eventName = options.eventName || process.env.EVENT_NAME || "Hackathon 2026";
  const organizerOrg = options.organizerOrg || process.env.ORGANIZER_ORG || "Partnerships Team";

  const requested = (options.requestedSubject || "").trim();
  const subjectOr = (dflt) => requested || dflt;
  const topicLine = requested ? `Regarding "${requested}": ` : "";

  if (type === "followup1") {
    return {
      subject: subjectOr(`Following up: ${eventName} x ${company.name} Partnership`),
      body: `Hi ${contact},\n\n${topicLine}I wanted to quickly follow up on my previous note regarding partnering with ${eventName}. We are locking in our ${tier} tier partners this week for our student developer hackathon.\n\nWould you have 10 minutes this week for a brief introductory call?\n\nBest regards,\n${organizerOrg}`,
      promptUsed: "Resilient Fallback Engine",
      usedFallback: true,
      attempts: 1
    };
  }
  if (type === "followup2") {
    return {
      subject: subjectOr(`Final follow-up: ${eventName} x ${company.name}`),
      body: `Hi ${contact},\n\n${topicLine}I understand you are busy, so this will be my final follow-up. We are finalizing our partner roster for ${eventName}.\n\nIf you'd like to explore developer engagement or challenge prize tracks with ${company.name}, please let us know. Otherwise, we hope to connect for our next edition!\n\nBest regards,\n${organizerOrg}`,
      promptUsed: "Resilient Fallback Engine",
      usedFallback: true,
      attempts: 1
    };
  }

  const askText = ask === "infra"
    ? `cloud credits and developer tooling access for student builders`
    : ask === "goodies"
    ? `swag, prizes, and developer goodies for our participants`
    : `${tier} tier cash sponsorship to support prizes, mentorship, and workshops`;

  return {
    subject: subjectOr(`${company.name} x ${eventName} - Partnership Proposal`),
    body: `Hi ${contact},\n\n${topicLine}We are organizing ${eventName} bringing together top student developers and designers for our upcoming hackathon.\n\nGiven ${company.name}'s leadership in ${company.category || "technology"} and commitment to developer communities, we would love to invite ${company.name} as a ${tier} partner.\n\nWe are looking to collaborate on ${askText}. In return, we offer dedicated workshop tracks, recruitment access to finalist resumes, and prominent brand visibility.\n\nCould we schedule a 15-minute introductory call this week to share our deck and discuss synergies?\n\nBest regards,\n${organizerOrg}`,
    promptUsed: "Resilient Fallback Engine",
    usedFallback: true,
    attempts: 1
  };
}

/**
 * Generate email with retry logic (up to 3 attempts)
 */
async function generateEmailDraft(company, options = {}) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let prompt = buildEmailPrompt(company, options);

      // If retrying, prepend warning to enforce rules
      if (attempt > 1 && lastError) {
        prompt += `\n\nREMINDER FOR RETRY (Attempt ${attempt}): The previous attempt failed with error: "${lastError.message}". Remember: NO placeholders with brackets like [Name] or [Link], and return valid JSON only.`;
      }

      const rawResponse = await generate(prompt, {
        temperature: attempt === 1 ? 0.7 : 0.4,
        responseMimeType: "application/json"
      });

      const validated = parseAndValidateEmailResponse(rawResponse);
      if (options.requestedSubject && options.requestedSubject.trim()) {
        validated.subject = options.requestedSubject.trim();
      }
      return {
        ...validated,
        promptUsed: prompt,
        attempts: attempt
      };
    } catch (err) {
      lastError = err;
      console.warn(`[emailGenerationService] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt === maxAttempts) {
        console.warn("[emailGenerationService] Reached max attempts or network error. Generating high-quality fallback draft.");
        return generateFallbackEmail(company, options);
      }
      // Wait with backoff before next attempt to allow demand spikes to pass
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }

  return generateFallbackEmail(company, options);
}

module.exports = {
  generateEmailDraft,
  parseAndValidateEmailResponse
};
