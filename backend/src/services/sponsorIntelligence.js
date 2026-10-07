const { researchCompany } = require("./companyResearch");
const { generateSponsorStrategy } = require("./llmService");

const validCategories = [
  "Technology",
  "Cloud & Developer Tools",
  "AI & Data",
  "Finance",
  "Education",
  "Food & Beverage",
  "E-commerce",
  "Healthcare",
  "Automotive",
  "Telecom",
  "Consumer Electronics",
  "Media & Entertainment",
  "Other"
];

const validAsks = [
  "money",
  "goodies",
  "infra"
];

const calculateFinalScore = (data) => {
  const score =
    Number(data.eventFit || 0) +
    Number(data.sponsorshipEvidence || 0) +
    Number(data.educationCommunityFit || 0) +
    Number(data.productRelevance || 0) +
    Number(data.audienceFit || 0) +
    Number(data.sponsorshipPotential || 0);

  return Math.min(score, 100);
};

const getTier = (score) => {
  if (score >= 90) return "Platinum";
  if (score >= 75) return "Gold";
  if (score >= 60) return "Silver";
  return "Bronze";
};

const analyzeCompany = async (company) => {
  // Step 1: Tavily research
  const research = await researchCompany(company);

  Object.assign(company, research);

  // Step 2: LLM analysis
  const intelligence = await generateSponsorStrategy(company);

  Object.assign(company, intelligence);

if (!validCategories.includes(company.category)) {
  company.category = "Other";
}
if (!validAsks.includes(company.recommendedAsk)) {
  company.recommendedAsk = "money";
}
  // Step 3: Backend calculates final score
  company.score = calculateFinalScore(intelligence);

  // Step 4: Backend decides tier
  company.recommendedTier = getTier(company.score);

  return company;
};

module.exports = {
  analyzeCompany
};
