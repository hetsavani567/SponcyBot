require("dotenv").config();
const { generateEmailDraft } = require("../services/emailGenerationService");
const company = {
  name: "Acme Cloud Corp",
  industry: "Cloud & DevTools",
  category: "Cloud & Developer Tools",
  recommendedTier: "Gold",
  recommendedAsk: "infra"
};

async function testGeneration() {
  console.log("Testing live AI Email Generation with Gemini...");
  console.log(`Target Sponsor: ${company.name} (${company.recommendedTier} tier, ${company.recommendedAsk} ask)`);

  try {
    const result = await generateEmailDraft(company, { type: "initial" });
    console.log("\n--- GENERATION SUCCESSFUL ---");
    console.log("Subject:", result.subject);
    console.log("\nBody:\n", result.body);
    console.log("\nAttempts:", result.attempts);
  } catch (err) {
    console.error("\nGeneration failed:", err.message);
  }
}

testGeneration();
