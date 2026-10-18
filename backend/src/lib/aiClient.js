const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash"
].filter(Boolean);

const TIMEOUT_MS = 30000;

function withTimeout(promise, ms = TIMEOUT_MS, label = "Gemini API request") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function executeSingleCall(model, prompt, options) {
  const apiCall = ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      maxOutputTokens: options.maxOutputTokens || 4096,
      thinkingConfig: { thinkingBudget: 0 },
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
    }
  });

  const res = await withTimeout(apiCall, options.timeoutMs || TIMEOUT_MS, `Gemini model ${model}`);
  if (!res || !res.text || !res.text.trim()) {
    throw new Error(`Empty response received from Gemini model ${model}`);
  }
  return res.text;
}

async function generate(prompt, options = {}) {
  const modelsToTry = options.model ? [options.model] : DEFAULT_MODELS;
  let lastError = null;

  for (const model of modelsToTry) {
    // 1 initial attempt + 1 retry on failure or empty/invalid output
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const text = await executeSingleCall(model, prompt, options);
        return text;
      } catch (err) {
        lastError = err;
        console.warn(`[aiClient] Model ${model} attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
        if (attempt < maxAttempts) {
          // Pause 1 second before retry
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  throw new Error(`Gemini request failed after retry: ${lastError ? lastError.message : "No response generated"}`);
}

module.exports = {
  ai,
  generate
};
