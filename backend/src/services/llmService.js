const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const generateSponsorStrategy = async (company) => {
  const prompt = `
You are SponcyBot, an AI sponsorship intelligence assistant.

Analyze this company using ONLY the provided research.

Company: ${company.name}
Website: ${company.website}

Research:
${company.research}

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
  "shortPitch": ""
}

Scoring:

eventFit:
How relevant is the company to a technology/student event?
Maximum 25.

sponsorshipEvidence:
Evidence that the company sponsors events, communities, education,
hackathons or partnerships.
Maximum 20.

educationCommunityFit:
Involvement with students, universities, education or developer communities.
Maximum 15.

productRelevance:
How relevant are the company's products/services to the event?
Maximum 15.

audienceFit:
How well does the event audience match the company's target audience?
Maximum 15.

sponsorshipPotential:
Evidence of ability or willingness to support sponsorships.
Maximum 10.

Important:
- Return only the individual factor scores.
- Do NOT calculate the final score.
- Do not exceed the maximum for each factor.
- Do not invent facts.
- Score conservatively when evidence is weak.

category must be exactly one of:

"Technology"
"Cloud & Developer Tools"
"AI & Data"
"Finance"
"Education"
"Food & Beverage"
"E-commerce"
"Healthcare"
"Automotive"
"Telecom"
"Consumer Electronics"
"Media & Entertainment"
"Other"

recommendedAsk MUST be exactly ONE of these values:

"money"
"goodies"
"infra"

Do not write a sentence.
Do not add explanations.
Do not add multiple values.
Do not return anything except one of the three exact values.

Examples:
"money"
"goodies"
"infra"

Before returning the JSON, verify:
- category is exactly one allowed category
- recommendedAsk is exactly "money", "goodies", or "infra"
- all six scores are numbers
- no score exceeds its maximum
- no extra fields are included

`;

  const response = await client.responses.create({
    model: "gpt-6-luna",
    input: prompt
  });

  const text = response.output_text;

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
