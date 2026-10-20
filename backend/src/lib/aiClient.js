const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite"
].filter(Boolean);

async function generate(prompt, options = {}) {
  const modelsToTry = [...new Set(options.model ? [options.model] : DEFAULT_MODELS)];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          maxOutputTokens: options.maxOutputTokens || 2048,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
        }
      });

      const res = await Promise.race([
        generatePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout with ${model} after 30s`)), 30000)
        )
      ]);

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
