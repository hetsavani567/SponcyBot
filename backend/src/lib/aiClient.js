const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
  console.error("[aiClient] GEMINI_API_KEY is not set. Every AI draft will fall back to the generic template.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
].filter(Boolean);

async function generate(prompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const modelsToTry = options.model ? [options.model] : DEFAULT_MODELS;
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          maxOutputTokens: options.maxOutputTokens || 2048,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
        }
      });

      if (res && res.text) {
        return res.text;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[aiClient] Model ${model} failed: ${err.message}. Trying next fallback...`);
    }
  }

  throw lastError || new Error("Failed to generate content with any available model");
}

module.exports = {
  ai,
  generate
};
