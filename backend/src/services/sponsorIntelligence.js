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
  const research = await researchCompany(company);
  Object.assign(company, research);

  const intelligence = await generateSponsorStrategy(company);
console.log("GEMINI SCORES:", {
  eventFit: intelligence.eventFit,
  sponsorshipEvidence: intelligence.sponsorshipEvidence,
  educationCommunityFit: intelligence.educationCommunityFit,
  productRelevance: intelligence.productRelevance,
  audienceFit: intelligence.audienceFit,
  sponsorshipPotential: intelligence.sponsorshipPotential
});
  Object.assign(company, intelligence);

  if (!validCategories.includes(company.category)) {
    company.category = "Other";
  }

  if (!validAsks.includes(company.recommendedAsk)) {
    company.recommendedAsk = "money";
  }

  company.eventFit = Number(company.eventFit) || 0;
  company.sponsorshipEvidence =
    Number(company.sponsorshipEvidence) || 0;
  company.educationCommunityFit =
    Number(company.educationCommunityFit) || 0;
  company.productRelevance =
    Number(company.productRelevance) || 0;
  company.audienceFit = Number(company.audienceFit) || 0;
  company.sponsorshipPotential =
    Number(company.sponsorshipPotential) || 0;

  company.score = calculateFinalScore(company);
  company.recommendedTier = getTier(company.score);
console.log("FINAL SCORE:", company.score);
  return company;
};

module.exports = {
  analyzeCompany
};
