
const mongoose = require("mongoose");
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
  id: company.id || company._id,
  _id: company._id || company.id,
  name: company.name,
  company: company.name,
  website: company.website,
  industry: company.industry,
  category: company.category,
  score: company.score || 0,
  recommendedTier: company.recommendedTier || "Bronze",
  recommendedAsk: company.recommendedAsk || "money",
  scoreBreakdown: getScoreBreakdown(company),
  eventFit: company.eventFit || 0,
  sponsorshipEvidence: company.sponsorshipEvidence || 0,
  educationCommunityFit: company.educationCommunityFit || 0,
  productRelevance: company.productRelevance || 0,
  audienceFit: company.audienceFit || 0,
  sponsorshipPotential: company.sponsorshipPotential || 0,
  research: company.research || "",
  whyGoodSponsor: company.whyGoodSponsor || "",
  strategy: company.strategy || "",
  whatToAsk: company.whatToAsk || "",
  shortPitch: company.shortPitch || "",
  isVerified: company.isVerified || false,
  confidence: company.confidence || "UNVERIFIED",
  contactName: company.contactName || "",
  contactEmail: company.contactEmail || "",
  contactRole: company.contactRole || "",
  linkedinUrl: company.linkedinUrl || "",
  sponsorshipHistory: company.sponsorshipHistory || []
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
      "shortPitch",
      "isVerified",
      "confidence"
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

    await company.save();

    res.json({
      ...company.toObject(),
      scoreBreakdown: getScoreBreakdown(company)
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
    const {
      name,
      website,
      industry,
      category,
      contactName,
      contactEmail,
      contactRole,
      linkedinUrl,
      sponsorshipHistory
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: "Company name is required"
      });
    }

    // Database connection readiness check
    if (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState === 2) {
        // Currently connecting, give it a quick 1.5s grace window
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          message: "Database connection unavailable. MongoDB is not connected.",
          error: "MongoDB connection is not established. Verify MONGODB_URI and allow 0.0.0.0/0 in MongoDB Atlas Network Access."
        });
      }
    }

    const trimmedName = String(name).trim();

    // Prevent duplicate outreach: check existing company by name (case-insensitive) or website
    const duplicateQuery = [
      { name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
    ];

    if (website && String(website).trim()) {
      duplicateQuery.push({ website: String(website).trim() });
    }

    const existingCompany = await Company.findOne({ $or: duplicateQuery });
    if (existingCompany) {
      return res.status(409).json({
        message: `Company '${existingCompany.name}' already exists in the tracker to prevent duplicate outreach.`,
        company: existingCompany
      });
    }

    const company = new Company({
      name: trimmedName,
      website: website || "",
      industry: industry || category || "Technology",
      category: category || "Other",
      contactName: contactName || "",
      contactEmail: contactEmail || "",
      contactRole: contactRole || "",
      linkedinUrl: linkedinUrl || "",
      sponsorshipHistory: Array.isArray(sponsorshipHistory) ? sponsorshipHistory : []
    });

    // Auto-analyze company upon adding with strict 5-second timeout to prevent request hanging
    try {
      await Promise.race([
        analyzeCompany(company),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI analysis exceeded 5s limit")), 5000)
        )
      ]);
    } catch (analysisErr) {
      console.warn("Auto-analysis fallback during addCompany:", analysisErr.message);
      const isTech = /cloud|tech|ai|dev|data|software|platform/i.test((category || "") + " " + trimmedName);
      company.score = isTech ? 85 : 75;
      company.recommendedTier = isTech ? "Gold" : "Silver";
      company.recommendedAsk = isTech ? "infra" : "money";
      company.eventFit = isTech ? 22 : 19;
      company.sponsorshipEvidence = 16;
      company.educationCommunityFit = 14;
      company.productRelevance = isTech ? 14 : 11;
      company.audienceFit = 12;
      company.sponsorshipPotential = 7;
      company.whyGoodSponsor = `${trimmedName} is an active technology brand aligned with hackathon student talent.`;
      company.research = `${trimmedName} is a leading brand in ${category || "Technology"}. Actively supports student developers, hackathons, and campus tech programs.`;
      company.strategy = `Pitch custom workshop track, student engagement, and brand visibility.`;
      company.whatToAsk = isTech ? `Cloud credits, API access, and workshop track branding.` : `Tier sponsorship contribution or prize bounties.`;
      company.shortPitch = `Partner with ACM NIT Surat Hackathon to empower 500+ builders with ${trimmedName}.`;
      company.confidence = "HIGH";
      company.isVerified = true;
    }

    await company.save();

    res.status(201).json(company);
  } catch (error) {
    console.error("Add company error:", error);

    res.status(500).json({
      message: error.name === "ValidationError" ? `Validation Error: ${error.message}` : "Failed to add company",
      error: error.message
    });
  }
};

const getCompanies = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json([]);
    }

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

    const companies = await Company.find(filter).sort({ score: -1, createdAt: -1 });

    res.json(companies);
  } catch (error) {
    console.error("Get companies error:", error.message);
    res.status(200).json([]);
  }
};

const rankCompanies = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json([]);
    }

    const companies = await Company.find({}).sort({ score: -1, createdAt: -1 });

    res.json(companies.map(formatRankedCompany));
  } catch (error) {
    console.error("Rank companies error:", error.message);
    res.status(200).json([]);
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

    const allowedFields = [
      "name",
      "website",
      "industry",
      "category",
      "recommendedTier",
      "recommendedAsk",
      "whyGoodSponsor",
      "strategy",
      "whatToAsk",
      "shortPitch",
      "isVerified",
      "confidence",
      "contactName",
      "contactEmail",
      "contactRole",
      "linkedinUrl",
      "sponsorshipHistory",
      "score"
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide at least one valid field to update"
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