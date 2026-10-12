const { GoogleGenAI } = require("@google/genai");

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const generateSponsorStrategy = async (company) => {
  const prompt = `
You are SponcyBot, an AI sponsorship intelligence assistant.

Analyze this company using ONLY the provided research.

Company: ${company.name}
Website: ${company.website}

Research:
${(company.research || "").slice(0, 3000)}

Return ONLY valid JSON:

{
  "industry": "",
  "category": "",
  "eventFit": 0,
  "sponsorshipEvidence": 0,
  "educationCommunityFit": 0,
  "productRelevance": 0,
  "audienceFit": 0,
  "sponsorshipPotential": 0,
  "recommendedAsk": "",
  "whyGoodSponsor": "",
  "strategy": "",
  "whatToAsk": "",
  "shortPitch": "",
  "isVerified": false,
  "confidence": "UNVERIFIED"
}

Scoring:
- eventFit: maximum 25
- sponsorshipEvidence: maximum 20
- educationCommunityFit: maximum 15
- productRelevance: maximum 15
- audienceFit: maximum 15
- sponsorshipPotential: maximum 10

Rules:
- Return individual factor scores only.
- Do not calculate the final score.
- Do not exceed the maximum for any factor.
- Do not invent facts.
- Score conservatively when evidence is weak.
- isVerified: true if verified evidence of past sponsorships/hackathons exists in research, false otherwise.
- confidence must be exactly one of: "HIGH", "MEDIUM", "LOW", "UNVERIFIED".

category must be exactly one of:
"Technology", "Cloud & Developer Tools", "AI & Data",
"Finance", "Education", "Food & Beverage", "E-commerce",
"Healthcare", "Automotive", "Telecom", "Consumer Electronics",
"Media & Entertainment", "Other"

recommendedAsk must be exactly one of:
"money", "goodies", "infra"

Return only the specified JSON fields.
All six scores must be numbers.
Do not add explanations or extra fields.

Keep whyGoodSponsor, strategy, whatToAsk, and shortPitch
to one short sentence each.
Return the complete JSON object.
`;

  console.log("Starting Gemini...");
  console.time("Gemini");

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  console.log(`Using model: ${model}`);

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 2100
    }
  });

  console.timeEnd("Gemini");
  console.log("Gemini response received");

  let text = response.text || "";

  console.log("Finish reason:", response.candidates?.[0]?.finishReason);
  console.log("Response length:", text.length);

  text = text.replace(/^```json\s*/, "");
  text = text.replace(/^```\s*/, "");
  text = text.replace(/\s*```$/, "");

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Invalid LLM JSON:", text);
    throw new Error("LLM returned invalid JSON");
  }
};

module.exports = {
  generateSponsorStrategy
};