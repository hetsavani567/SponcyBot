require("dotenv").config();
const { generateEmailDraft } = require("../services/emailGenerationService");
const mockCompanies = require("../mocks/companies.json");

async function testGeneration() {
  console.log("Testing live AI Email Generation with Gemini...");
  const company = mockCompanies[0];
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
