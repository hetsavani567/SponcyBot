
const Company = require("../models/company");
const { analyzeCompany } = require("../services/sponsorIntelligence");

const getScoreBreakdown = (company) => ({
  eventFit: company.eventFit,
  sponsorshipEvidence: company.sponsorshipEvidence,
  educationCommunityFit: company.educationCommunityFit,
  productRelevance: company.productRelevance,
  audienceFit: company.audienceFit,
  sponsorshipPotential: company.sponsorshipPotential
});

const formatRankedCompany = (company, index) => ({
  rank: index + 1,
  id: company.id,
  company: company.name,
  website: company.website,
  industry: company.industry,
  category: company.category,
  score: company.score,
  recommendedTier: company.recommendedTier,
  recommendedAsk: company.recommendedAsk,
  scoreBreakdown: getScoreBreakdown(company),
  whyGoodSponsor: company.whyGoodSponsor,
  strategy: company.strategy,
  whatToAsk: company.whatToAsk,
  shortPitch: company.shortPitch
});

const research = async (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "");

    if (!companyId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const result = await analyzeCompany(company);

    const fields = [
      "industry",
      "category",
      "research",
      "sources",
      "researchedAt",
      "eventFit",
      "sponsorshipEvidence",
      "educationCommunityFit",
      "productRelevance",
      "audienceFit",
      "sponsorshipPotential",
      "recommendedAsk",
      "whyGoodSponsor",
      "strategy",
      "whatToAsk",
      "shortPitch"
    ];

    for (const field of fields) {
      if (result[field] !== undefined) {
        company.set(field, result[field]);
      }
    }

    const score =
      Number(company.eventFit || 0) +
      Number(company.sponsorshipEvidence || 0) +
      Number(company.educationCommunityFit || 0) +
      Number(company.productRelevance || 0) +
      Number(company.audienceFit || 0) +
      Number(company.sponsorshipPotential || 0);

    company.score = Math.min(score, 100);

    company.recommendedTier =
      company.score >= 90 ? "Platinum" :
      company.score >= 75 ? "Gold" :
      company.score >= 60 ? "Silver" : "Bronze";
console.log("SCORES BEFORE SAVE:", {
  eventFit: company.eventFit,
  sponsorshipEvidence: company.sponsorshipEvidence,
  educationCommunityFit: company.educationCommunityFit,
  productRelevance: company.productRelevance,
  audienceFit: company.audienceFit,
  sponsorshipPotential: company.sponsorshipPotential
});

console.log("CALCULATED SCORE:", company.score);

await company.save();

console.log("SCORE AFTER SAVE:", company.score);
    await company.save();

    res.json({
      ...company.toObject(),
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

const addCompany = async (req, res) => {
  try {
    const { name, website } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: "Company name is required"
      });
    }

    const company = await Company.create({
      name: String(name).trim(),
      website: website || ""
    });

    res.status(201).json(company);
  } catch (error) {
    console.error("Add company error:", error);

    res.status(500).json({
      message: "Failed to add company",
      error: error.message
    });
  }
};

const getCompanies = async (req, res) => {
  try {
    const { category, minScore } = req.query;
    const filter = {};

    if (category) {
      filter.category = {
        $regex: `^${String(category)}$`,
        $options: "i"
      };
    }

    if (minScore !== undefined && minScore !== "") {
      const score = Number(minScore);

      if (!Number.isFinite(score)) {
        return res.status(400).json({
          message: "minScore must be a number"
        });
      }

      filter.score = { $gte: score };
    }

    const companies = await Company.find(filter).sort({ createdAt: -1 });

    res.json(companies);
  } catch (error) {
    console.error("Get companies error:", error);

    res.status(500).json({
      message: "Failed to get companies",
      error: error.message
    });
  }
};

const rankCompanies = async (req, res) => {
  try {
    const companies = await Company.find({
      score: { $gt: 0 }
    }).sort({ score: -1, _id: 1 });

    res.json(companies.map(formatRankedCompany));
  } catch (error) {
    res.status(500).json({
      message: "Failed to rank companies",
      error: error.message
    });
  }
};

const getTopCompanies = async (req, res) => {
  try {
    const limit = Number(req.params.limit);

    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({
        message: "Limit must be a positive integer"
      });
    }

    const companies = await Company.find({
      score: { $gt: 0 }
    })
      .sort({ score: -1, _id: 1 })
      .limit(limit);

    res.json(companies.map(formatRankedCompany));
  } catch (error) {
    res.status(500).json({
      message: "Failed to get top companies",
      error: error.message
    });
  }
};

const recommendCompanies = async (req, res) => {
  try {
    const companies = await Company.find({
      score: { $gte: 60 }
    }).sort({ score: -1, _id: 1 });

    res.json(companies.map((company, index) => {
      const result = formatRankedCompany(company, index);

      return {
        rank: result.rank,
        id: result.id,
        company: result.company,
        industry: result.industry,
        category: result.category,
        score: result.score,
        recommendedTier: result.recommendedTier,
        recommendedAsk: result.recommendedAsk,
        scoreBreakdown: result.scoreBreakdown
      };
    }));
  } catch (error) {
    res.status(500).json({
      message: "Failed to recommend companies",
      error: error.message
    });
  }
};

const getCompanyById = async (id) => {
  if (!id || !String(id).match(/^[0-9a-fA-F]{24}$/)) {
    return null;
  }

  return Company.findById(id);
};

const getCompany = async (req, res) => {
  try {
    const company = await getCompanyById(req.params.id);

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get company",
      error: error.message
    });
  }
};

const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid company ID"
      });
    }

    const allowedFields = ["name", "website"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide name or website to update"
      });
    }

    if (
      updates.name !== undefined &&
      (typeof updates.name !== "string" || !updates.name.trim())
    ) {
      return res.status(400).json({
        message: "Name must be a non-empty string"
      });
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    if (
      updates.website !== undefined &&
      typeof updates.website !== "string"
    ) {
      return res.status(400).json({
        message: "Website must be a string"
      });
    }

    const company = await Company.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }

    res.json({
      message: "Company updated successfully",
      company
    });
  } catch (error) {
    console.error("Update company error:", error.message);

    res.status(500).json({
      message: "Failed to update company"
    });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await Company.findByIdAndDelete(id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({
      message: "Company deleted successfully",
      company
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete company",
      error: error.message
    });
  }
};

module.exports = {
  addCompany,
  getCompanies,
  getCompany,
  research,
  rankCompanies,
  getTopCompanies,
  recommendCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany
};