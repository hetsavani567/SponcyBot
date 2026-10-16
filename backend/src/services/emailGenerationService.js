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
      return {
        ...validated,
        promptUsed: prompt,
        attempts: attempt
      };
    } catch (err) {
      lastError = err;
      console.warn(`[emailGenerationService] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed to generate valid email after ${maxAttempts} attempts. Last error: ${lastError.message}`
        );
      }
      // Wait with backoff before next attempt to allow demand spikes to pass
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
}

module.exports = {
  generateEmailDraft,
  parseAndValidateEmailResponse
};
