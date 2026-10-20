const { generate } = require("../lib/aiClient");
const { buildEmailPrompt } = require("./emailPrompts");

const PLACEHOLDER_REGEX = /\[[a-zA-Z0-9_\s-]{2,40}\]/;

function parseAndValidateEmailResponse(rawText, company = {}, options = {}) {
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

  let subject = parsed.subject.trim();
  let body = parsed.body.trim();

  // Strip cliché openings if the LLM hallucinated them
  body = body.replace(/([^\n]+,\s*)(?:I hope (?:this email finds you well|you are doing well)[.,]?\s*)+/i, "$1");

  // Dynamic placeholder replacer: replaces [Your Name], [Insert Date], etc. with actual event & organizer details
  const organizerName = (options && options.organizerName) || process.env.ORGANIZER_NAME || "Mahathi K.";
  const organizerRole = (options && options.organizerRole) || process.env.ORGANIZER_ROLE || "Lead, Sponsorships & Partnerships";
  const organizerOrg = (options && options.organizerOrg) || process.env.ORGANIZER_ORG || "ACM NIT Surat";
  const organizerEmail = (options && options.organizerEmail) || process.env.ORGANIZER_EMAIL || "partnerships@sponsybot.com";
  const eventName = (options && options.eventName) || process.env.EVENT_NAME || "Hackathon 2026";
  const brandName = (company && company.name ? company.name : "Partner")
    .replace(/\s*(Pvt\.?\s*Ltd\.?|Inc\.?|LLC|Corp\.?|Ltd\.?)$/i, "")
    .trim();

  const replacePlaceholders = (text) => {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/\[(?:Your Name|Organizer Name|Name)\]/gi, organizerName)
      .replace(/\[(?:Your Title|Title|Role|Organizer Role|Job Title)\]/gi, organizerRole)
      .replace(/\[(?:Organization|University|College|Organizer Org|Chapter)\]/gi, organizerOrg)
      .replace(/\[(?:Event Name|Hackathon Name)\]/gi, eventName)
      .replace(/\[(?:Company Name|Sponsor Name)\]/gi, brandName)
      .replace(/\[(?:Email|Organizer Email)\]/gi, organizerEmail)
      .replace(/\[(?:Phone Number|Phone|Contact)\]/gi, "+91 98765 43210")
      .replace(/\[(?:Website\/LinkedIn|LinkedIn|Website|Link)\]/gi, "https://sponsybot.com")
      .replace(/\[(?:Insert Date|Date)\]/gi, "November 14-16, 2026")
      .replace(/\[[a-zA-Z0-9_\s-]{2,40}\]/g, ""); // strip any remaining orphan bracket placeholder
  };

  subject = replacePlaceholders(subject);
  body = replacePlaceholders(body);

  return { subject, body };
}

function generateFallbackEmail(company, options = {}) {
  const type = options.type || "initial";
  const tier = company.recommendedTier || "Silver";
  const ask = company.recommendedAsk || "money";
  const contact = company.contactName ? company.contactName.trim().split(/\s+/)[0] : "Partnerships Team";
  const eventName = options.eventName || process.env.EVENT_NAME || "Hackathon 2026";
  const organizerOrg = options.organizerOrg || process.env.ORGANIZER_ORG || "ACM NIT Surat";
  const organizerName = options.organizerName || process.env.ORGANIZER_NAME || "Sponsorship Team";
  const organizerRole = options.organizerRole || process.env.ORGANIZER_ROLE || "Lead, Partnerships";

  const brandName = (company.name || "Sponsor")
    .replace(/\s*(Pvt\.?\s*Ltd\.?|Inc\.?|LLC|Corp\.?|Ltd\.?)$/i, "")
    .trim();

  // Weave research and intelligence
  const pitchAngle = company.shortPitch
    ? company.shortPitch
    : company.whyGoodSponsor
    ? `${brandName} is a natural partner given your leadership in ${company.category || "developer technology"}.`
    : `We admire ${brandName}'s active support for engineering talent and developer ecosystems.`;

  const askAngle = company.whatToAsk
    ? company.whatToAsk
    : ask === "infra"
    ? `developer platform access, API credits, and a dedicated challenge track`
    : ask === "goodies"
    ? `developer swag, hardware kits, and bounty prizes for participants`
    : `${tier} tier sponsorship contribution (${tier === "Gold" ? "₹1,50,000" : "₹75,000"})`;

  const customRequirementSentence = options.customInstructions && options.customInstructions.trim()
    ? `\n\nSpecific to our conversation: ${options.customInstructions.trim()}`
    : "";

  if (type === "followup1") {
    return {
      subject: `Re: ${brandName} x ${eventName} - Partnership Discussion`,
      body: `Hi ${contact},\n\nI wanted to quickly follow up on our previous note regarding partnering for ${eventName}. We are locking in our ${tier} tier partners this week.\n\n${pitchAngle}\n\nWe would love to collaborate on ${askAngle}.${customRequirementSentence}\n\nWould you have 10 minutes this Thursday for a brief introductory call?\n\nBest regards,\n${organizerName}\n${organizerRole}, ${organizerOrg}`,
      promptUsed: "Resilient Fallback Engine",
      attempts: 1
    };
  }
  if (type === "followup2") {
    return {
      subject: `Final follow-up: ${brandName} x ${eventName}`,
      body: `Hi ${contact},\n\nI understand you are busy, so this will be my final follow-up. We are finalizing our partner roster for ${eventName}.\n\nIf you'd like to explore student engagement with ${brandName} (${askAngle}), please let us know.${customRequirementSentence}\n\nOtherwise, we hope to stay in touch for future editions!\n\nBest regards,\n${organizerName}\n${organizerRole}, ${organizerOrg}`,
      promptUsed: "Resilient Fallback Engine",
      attempts: 1
    };
  }

  return {
    subject: `${brandName} x ${eventName} - ${tier} Partnership Proposal`,
    body: `Hello ${contact},\n\n${pitchAngle}\n\nWe are organizing ${eventName} with ${organizerOrg}, convening 500+ top student developers, engineers, and designers for 36 hours of high-impact building.\n\nWe would love to welcome ${brandName} as a ${tier} Partner. Specifically, we are proposing collaboration on:\n• ${askAngle}\n• 45-minute hands-on workshop track and challenge bounty\n• Opt-in access to finalist resume database for engineering and DevRel hiring\n• Prime brand visibility across digital channels, stage, and our 1,500+ builder community${customRequirementSentence}\n\nCould we schedule a 15-minute introductory call this week to share our deck and discuss synergies?\n\nBest regards,\n${organizerName}\n${organizerRole}, ${organizerOrg}`,
    promptUsed: "Resilient Fallback Engine",
    attempts: 1
  };
}

/**
 * Generate email with retry logic (up to 3 attempts)
 */
async function generateEmailDraft(company, options = {}) {
  const maxAttempts = 2;
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
        responseMimeType: "application/json",
        maxOutputTokens: 500
      });

      const validated = parseAndValidateEmailResponse(rawResponse, company, options);
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
      // Brief pause before retry
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  return generateFallbackEmail(company, options);
}

module.exports = {
  generateEmailDraft,
  parseAndValidateEmailResponse
};
