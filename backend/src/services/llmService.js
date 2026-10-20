const { generate } = require("../lib/aiClient");
const { generateDynamicSponsorProfile } = require("./sponsorProfiles");

const generateSponsorStrategy = async (company) => {
  const prompt = `
You are SponcyBot, an AI sponsorship intelligence assistant for a major student hackathon (ACM NIT Surat, 500+ builders, 36 hours).

Analyze this company and return tailored sponsorship recommendations.

Company: ${company.name}
Website: ${company.website || "N/A"}
Category: ${company.category || "Technology"}

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

Scoring criteria:
- eventFit: maximum 25 (how well their domain fits a collegiate developer hackathon)
- sponsorshipEvidence: maximum 20 (evidence of past campus / tech sponsorship or hiring)
- educationCommunityFit: maximum 15 (support for student developers, universities, learning)
- productRelevance: maximum 15 (relevance of their product/APIs to 36-hr hackathon projects)
- audienceFit: maximum 15 (fit with 500+ student developers & engineers)
- sponsorshipPotential: maximum 10 (willingness to partner & provide value)

CRITICAL RULES:
- recommendedAsk MUST be chosen accurately:
  * "money": for Finance, E-commerce, Retail, or companies providing cash grants and cash track prizes.
  * "infra": for Cloud, Developer Tools, AI, Database, and API infrastructure companies providing free developer platform credits.
  * "goodies": for Food & Beverage, Lifestyle, Hardware, EdTech, or companies providing swag, drinks, or course vouchers.
- Score honestly: non-tech/lifestyle sponsors should score lower on productRelevance (e.g. 7-10), while developer platforms score high (e.g. 14-15).
- Do NOT use identical numbers for all companies.
- category must be one of: "Technology", "Cloud & Developer Tools", "AI & Data", "Finance", "Education", "Food & Beverage", "E-commerce", "Consumer Electronics", "Other".
- confidence must be one of: "HIGH", "MEDIUM", "LOW", "UNVERIFIED".
`;

  try {
    const rawText = await generate(prompt, {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 600
    });

    let cleaned = (rawText || "").trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && typeof parsed.eventFit === "number") {
      return parsed;
    }
  } catch (error) {
    console.warn("[llmService] AI generation failed or timed out, using intelligent category profiler:", error.message);
  }

  // Resilient, category-differentiated profiler fallback
  return generateDynamicSponsorProfile(company);
};

module.exports = {
  generateSponsorStrategy
};