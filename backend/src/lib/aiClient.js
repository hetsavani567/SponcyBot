const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash"
].filter(Boolean);

async function generate(prompt, options = {}) {
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
