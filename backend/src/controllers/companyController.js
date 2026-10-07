let companies = [];

const { analyzeCompany } = require("../services/sponsorIntelligence");

const research = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("COMPANIES:", companies);

    const companyId = String(req.body?.companyId);

    const company = companies.find(
      (company) => String(company.id) === companyId
    );

    if (!company) {
      return res.status(404).json({
        message: "Company not found",
        receivedId: companyId
      });
    }

    const result = await analyzeCompany(company);

    res.json({
      ...result,

      scoreBreakdown: {
        eventFit: company.eventFit,
        sponsorshipEvidence: company.sponsorshipEvidence,
        educationCommunityFit: company.educationCommunityFit,
        productRelevance: company.productRelevance,
        audienceFit: company.audienceFit,
        sponsorshipPotential: company.sponsorshipPotential
      }
    });

  } catch (error) {
    console.error("Company research error:", error);

    res.status(500).json({
      message: "Company research failed",
      error: error.message
    });
  }
};

const addCompany = (req, res) => {
  const { name, website } = req.body || {};

  if (!name) {
    return res.status(400).json({
      message: "Company name is required"
    });
  }

  const company = {
  id: String(companies.length + 1),
  name,
  website: website || "",

  industry: "",
  category: "",
  research: "",
  sources: [],
  researchedAt: null,

  score: 0,

  eventFit: 0,
  sponsorshipEvidence: 0,
  educationCommunityFit: 0,
  productRelevance: 0,
  audienceFit: 0,
  sponsorshipPotential: 0,

  recommendedTier: "",
  recommendedAsk: "",

  whyGoodSponsor: "",
  strategy: "",
  whatToAsk: "",
  shortPitch: ""
};

  companies.push(company);

  res.status(201).json(company);
};

const getCompanies = (req, res) => {
  const { category, minScore } = req.query;

  let result = [...companies];

  if (category) {
    result = result.filter(
      (company) =>
        company.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (minScore) {
    const score = Number(minScore);

    if (isNaN(score)) {
      return res.status(400).json({
        message: "minScore must be a number"
      });
    }

    result = result.filter(
      (company) => company.score >= score
    );
  }

  res.json(result);
};

const rankCompanies = (req, res) => {
  const rankedCompanies = [...companies]
    .filter((company) => company.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((company, index) => ({
      rank: index + 1,
      id: company.id,
      company: company.name,
      website: company.website,
      industry: company.industry,
      category: company.category,
      score: company.score,
      recommendedTier: company.recommendedTier,
      recommendedAsk: company.recommendedAsk,

      scoreBreakdown: {
        eventFit: company.eventFit,
        sponsorshipEvidence: company.sponsorshipEvidence,
        educationCommunityFit: company.educationCommunityFit,
        productRelevance: company.productRelevance,
        audienceFit: company.audienceFit,
        sponsorshipPotential: company.sponsorshipPotential
      },

      whyGoodSponsor: company.whyGoodSponsor,
      strategy: company.strategy,
      whatToAsk: company.whatToAsk,
      shortPitch: company.shortPitch
    }));

  res.json(rankedCompanies);
};

const getTopCompanies = (req, res) => {
  const limit = Number(req.params.limit);

  if (!limit || limit < 1) {
    return res.status(400).json({
      message: "Limit must be a positive number"
    });
  }

  const topCompanies = [...companies]
    .filter((company) => company.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((company, index) => ({
      rank: index + 1,
      id: company.id,
      company: company.name,
      website: company.website,
      industry: company.industry,
      category: company.category,
      score: company.score,
      recommendedTier: company.recommendedTier,
      recommendedAsk: company.recommendedAsk,

      scoreBreakdown: {
        eventFit: company.eventFit,
        sponsorshipEvidence: company.sponsorshipEvidence,
        educationCommunityFit: company.educationCommunityFit,
        productRelevance: company.productRelevance,
        audienceFit: company.audienceFit,
        sponsorshipPotential: company.sponsorshipPotential
      },

      whyGoodSponsor: company.whyGoodSponsor,
      strategy: company.strategy,
      whatToAsk: company.whatToAsk,
      shortPitch: company.shortPitch
    }));

  res.json(topCompanies);
};

const recommendCompanies = (req, res) => {
  const recommendedCompanies = [...companies]
    .filter((company) => company.score >= 60)
    .sort((a, b) => b.score - a.score)
    .map((company, index) => ({
      rank: index + 1,
      id: company.id,
      company: company.name,
      industry: company.industry,
      category: company.category,
      score: company.score,
      recommendedTier: company.recommendedTier,
      recommendedAsk: company.recommendedAsk,

      scoreBreakdown: {
        eventFit: company.eventFit,
        sponsorshipEvidence: company.sponsorshipEvidence,
        educationCommunityFit: company.educationCommunityFit,
        productRelevance: company.productRelevance,
        audienceFit: company.audienceFit,
        sponsorshipPotential: company.sponsorshipPotential
      }
    }));

  res.json(recommendedCompanies);
};

const getCompanyById = (id) => {
  return companies.find(
    (company) => String(company.id) === String(id)
  );
};

const getCompany = (req, res) => {
  const company = getCompanyById(req.params.id);

  if (!company) {
    return res.status(404).json({
      message: "Company not found"
    });
  }

  res.json(company);
};

module.exports = {
  addCompany,
  getCompanies,
  research,
  rankCompanies,
  getTopCompanies,
  recommendCompanies,
  getCompanyById,
  getCompany
};