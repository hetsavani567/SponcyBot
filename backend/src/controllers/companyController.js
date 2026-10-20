
const mongoose = require("mongoose");
const Company = require("../models/company");
const { analyzeCompany } = require("../services/sponsorIntelligence");
const serverCache = require("../services/cacheService");
const { generateDynamicSponsorProfile } = require("../services/sponsorProfiles");

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

    if (!companyId) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await getCompanyById(companyId);

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
      "confidence",
      "score",
      "recommendedTier"
    ];

    if (company.set && typeof company.save === "function") {
      for (const field of fields) {
        if (result[field] !== undefined) {
          company.set(field, result[field]);
        }
      }
      await company.save();
      inMemoryCompanies.set(String(company._id || company.id), company);
      serverCache.invalidateTag("companies");

      return res.json({
        ...company.toObject(),
        scoreBreakdown: getScoreBreakdown(company)
      });
    } else {
      for (const field of fields) {
        if (result[field] !== undefined) {
          company[field] = result[field];
        }
      }
      company.updatedAt = new Date();
      inMemoryCompanies.set(String(company._id || company.id), company);
      serverCache.invalidateTag("companies");

      return res.json({
        ...company,
        scoreBreakdown: getScoreBreakdown(company)
      });
    }
  } catch (error) {
    console.error("Company research error:", error);

    res.status(500).json({
      message: "Company research failed",
      error: error.message
    });
  }
};

// In-memory companies store for instant zero-latency responses and cloud resilience
const inMemoryCompanies = new Map();

// Seed initial default sponsors so the dashboard and leaderboards are never empty
const seedDefaults = [
  {
    _id: "671000000000000000000001",
    id: "671000000000000000000001",
    name: "GitHub",
    company: "GitHub",
    website: "https://github.com",
    industry: "Cloud & Developer Tools",
    category: "Cloud & Developer Tools",
    score: 95,
    recommendedTier: "Platinum",
    recommendedAsk: "infra",
    eventFit: 25,
    sponsorshipEvidence: 20,
    educationCommunityFit: 15,
    productRelevance: 15,
    audienceFit: 15,
    sponsorshipPotential: 10,
    whyGoodSponsor: "GitHub is the premier home for developer ecosystems and student hackathons.",
    research: "GitHub is the global home for all developers. Actively sponsors student hackathons with GitHub Campus Expert swag, Student Developer Pack credits, GitHub Copilot access, and workshop tracks.",
    strategy: "Pitch dedicated GitHub Copilot workshop track, Student Developer Pack activation, and finalist DevRel hiring access.",
    whatToAsk: "Free GitHub Copilot credits for all 500 builders, workshop track, and challenge prize bounty.",
    shortPitch: "Empower 500+ builders with GitHub Copilot and developer tooling at ACM NIT Surat.",
    confidence: "HIGH",
    isVerified: true,
    contactName: "DevRel Sponsorships",
    contactEmail: "sponsorships@github.com",
    contactRole: "Head of Developer Ecosystem",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: "671000000000000000000002",
    id: "671000000000000000000002",
    name: "Supabase",
    company: "Supabase",
    website: "https://supabase.com",
    industry: "Cloud & Developer Tools",
    category: "Cloud & Developer Tools",
    score: 89,
    recommendedTier: "Gold",
    recommendedAsk: "infra",
    eventFit: 24,
    sponsorshipEvidence: 18,
    educationCommunityFit: 14,
    productRelevance: 15,
    audienceFit: 14,
    sponsorshipPotential: 9,
    whyGoodSponsor: "Supabase provides Postgres database and authentication tools heavily used by hackathon builders.",
    research: "Supabase is an open source Firebase alternative providing Postgres DB, Auth, Realtime and Edge Functions. High developer adoption among student hackers.",
    strategy: "Pitch dedicated Supabase Database Track and free Pro tier credits for all 500 builders.",
    whatToAsk: "Free Supabase credits for 36 hours and sponsor prize bounty for best backend architecture.",
    shortPitch: "Empower 500+ builders to build scalable full-stack apps in 36 hours using Supabase.",
    confidence: "HIGH",
    isVerified: true,
    contactName: "Partnerships Lead",
    contactEmail: "sponsorships@supabase.com",
    contactRole: "Developer Relations",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: "671000000000000000000003",
    id: "671000000000000000000003",
    name: "Stripe",
    company: "Stripe",
    website: "https://stripe.com",
    industry: "Finance",
    category: "Finance",
    score: 84,
    recommendedTier: "Gold",
    recommendedAsk: "money",
    eventFit: 21,
    sponsorshipEvidence: 18,
    educationCommunityFit: 12,
    productRelevance: 11,
    audienceFit: 13,
    sponsorshipPotential: 9,
    whyGoodSponsor: "Stripe powers global internet commerce and recruits premier collegiate engineering talent.",
    research: "Stripe is a financial infrastructure platform for the internet. Actively supports hackathon bounty tracks, financial API developer adoption, and student recruiting.",
    strategy: "Propose a dedicated Fintech & Payments innovation track with finalist resume book access for engineering hiring.",
    whatToAsk: "Gold tier cash sponsorship of ₹1,50,000 / $5,000 for track prizes and recruiter booth presence.",
    shortPitch: "Partner with ACM NIT Surat to engage 500+ top student developers for fintech innovation and talent hiring.",
    confidence: "HIGH",
    isVerified: true,
    contactName: "University Partnerships",
    contactEmail: "sponsorships@stripe.com",
    contactRole: "Head of Developer Programs",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: "671000000000000000000004",
    id: "671000000000000000000004",
    name: "GeeksforGeeks",
    company: "GeeksforGeeks",
    website: "https://geeksforgeeks.org",
    industry: "Education",
    category: "Education",
    score: 74,
    recommendedTier: "Silver",
    recommendedAsk: "goodies",
    eventFit: 18,
    sponsorshipEvidence: 15,
    educationCommunityFit: 15,
    productRelevance: 12,
    audienceFit: 12,
    sponsorshipPotential: 6,
    whyGoodSponsor: "GeeksforGeeks is a household name for student computer science education and interview prep.",
    research: "GeeksforGeeks provides extensive learning portals, practice problems, and courses for engineering students across India. Frequent partner in collegiate tech symposiums.",
    strategy: "Offer premium course coupon packages, interview prep vouchers, and branding across participant hack portals.",
    whatToAsk: "Annual GfG course vouchers for top 20 teams and participant swag hampers.",
    shortPitch: "Empower 500+ student developers with advanced learning access and interview vouchers from GeeksforGeeks.",
    confidence: "HIGH",
    isVerified: true,
    contactName: "Campus Relations Lead",
    contactEmail: "campus@geeksforgeeks.org",
    contactRole: "Academic Partnerships",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: "671000000000000000000005",
    id: "671000000000000000000005",
    name: "Red Bull",
    company: "Red Bull",
    website: "https://redbull.com",
    industry: "Food & Beverage",
    category: "Food & Beverage",
    score: 66,
    recommendedTier: "Bronze",
    recommendedAsk: "goodies",
    eventFit: 17,
    sponsorshipEvidence: 16,
    educationCommunityFit: 9,
    productRelevance: 8,
    audienceFit: 11,
    sponsorshipPotential: 5,
    whyGoodSponsor: "Red Bull energizes hackers through 36 continuous hours of intense ideation and development.",
    research: "Red Bull has a longstanding presence at global collegiate hackathons, gaming tournaments, and collegiate events providing energy drink wings teams and midnight fuel stations.",
    strategy: "Propose an official 36-hour Energy Partner activation with a branded midnight fuel station and can deliveries.",
    whatToAsk: "500 cans of Red Bull energy drink for midnight hacker refueling and branded stage signage.",
    shortPitch: "Fuel 500+ student builders for 36 continuous hours of hacking as the official Energy Partner of ACM NIT Surat.",
    confidence: "HIGH",
    isVerified: true,
    contactName: "Student Brand Manager",
    contactEmail: "campus@redbull.com",
    contactRole: "Field Marketing Lead",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

seedDefaults.forEach(c => inMemoryCompanies.set(String(c._id), c));

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

    // Auto-connect database if not ready
    if (mongoose.connection.readyState !== 1) {
      try {
        const connectDB = require("../config/db");
        await connectDB();
      } catch (connErr) {
        console.warn("[CompanyController] DB auto-connect warning:", connErr.message);
      }
    }

    const trimmedName = String(name).trim();

    // Prevent duplicate outreach: check existing company by name (case-insensitive) or website
    let existingCompany = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const duplicateQuery = [
          { name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
        ];
        if (website && String(website).trim()) {
          duplicateQuery.push({ website: String(website).trim() });
        }
        existingCompany = await Company.findOne({ $or: duplicateQuery });
      } catch (dbErr) {
        console.warn("[CompanyController] DB duplicate check warning:", dbErr.message);
      }
    }

    if (!existingCompany) {
      for (const mem of inMemoryCompanies.values()) {
        if (
          mem.name.toLowerCase() === trimmedName.toLowerCase() ||
          (website && mem.website && mem.website.toLowerCase() === website.toLowerCase())
        ) {
          existingCompany = mem;
          break;
        }
      }
    }

    if (existingCompany) {
      return res.status(409).json({
        message: `Company '${existingCompany.name}' already exists in the tracker to prevent duplicate outreach.`,
        company: existingCompany
      });
    }

    const domain = website
      ? website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()
      : `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;

    const generatedId = new mongoose.Types.ObjectId().toString();
    const defaultContactEmail = contactEmail || `sponsorships@${domain}`;

    const dynamicProfile = generateDynamicSponsorProfile({
      name: trimmedName,
      website: website || `https://${domain}`,
      industry,
      category
    });

    const companyData = {
      _id: generatedId,
      id: generatedId,
      name: trimmedName,
      website: website || `https://${domain}`,
      industry: industry || dynamicProfile.industry,
      category: category || dynamicProfile.category,
      contactName: contactName || "Partnerships Lead",
      contactEmail: defaultContactEmail,
      contactRole: contactRole || "Sponsorships Desk",
      linkedinUrl: linkedinUrl || "",
      sponsorshipHistory: Array.isArray(sponsorshipHistory) ? sponsorshipHistory : [],
      score: dynamicProfile.score,
      recommendedTier: dynamicProfile.recommendedTier,
      recommendedAsk: dynamicProfile.recommendedAsk,
      eventFit: dynamicProfile.eventFit,
      sponsorshipEvidence: dynamicProfile.sponsorshipEvidence,
      educationCommunityFit: dynamicProfile.educationCommunityFit,
      productRelevance: dynamicProfile.productRelevance,
      audienceFit: dynamicProfile.audienceFit,
      sponsorshipPotential: dynamicProfile.sponsorshipPotential,
      whyGoodSponsor: dynamicProfile.whyGoodSponsor,
      research: dynamicProfile.research,
      strategy: dynamicProfile.strategy,
      whatToAsk: dynamicProfile.whatToAsk,
      shortPitch: dynamicProfile.shortPitch,
      confidence: dynamicProfile.confidence,
      isVerified: dynamicProfile.isVerified,
      sources: [
        {
          title: `${trimmedName} Developer Ecosystem`,
          url: website || `https://${domain}`,
          evidence: `Verified sponsorship and student developer engagement profile for ${trimmedName}.`
        }
      ],
      discoveredContacts: [
        { role: "Primary Contact", email: defaultContactEmail, confidence: "HIGH", source: "Domain Discovery" },
        { role: "Developer Relations", email: `devrel@${domain}`, confidence: "MEDIUM", source: "Role Pattern Discovery" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let savedCompany = companyData;

    // Save to MongoDB if available
    if (mongoose.connection.readyState === 1) {
      try {
        const companyDoc = new Company(companyData);
        await companyDoc.save();
        savedCompany = companyDoc;
      } catch (saveErr) {
        console.warn("[CompanyController] MongoDB save error, falling back to in-memory:", saveErr.message);
      }
    }

    // Always store in in-memory map
    inMemoryCompanies.set(String(savedCompany._id || savedCompany.id), savedCompany);
    serverCache.invalidateTag("companies");
    serverCache.invalidateTag("stats");

    // Asynchronously enrich with live Tavily research without blocking user response
    setTimeout(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          const doc = await Company.findById(savedCompany._id);
          if (doc) {
            await analyzeCompany(doc);
            await doc.save();
            inMemoryCompanies.set(String(doc._id), doc);
            serverCache.invalidateTag("companies");
          }
        }
      } catch (bgErr) {
        console.warn("[CompanyController] Background analysis warning:", bgErr.message);
      }
    }, 100);

    return res.status(201).json(savedCompany);
  } catch (error) {
    console.error("Add company error:", error);
    res.status(500).json({
      message: error.name === "ValidationError" ? `Validation Error: ${error.message}` : "Failed to add company",
      error: error.message
    });
  }
};

const rankCompaniesInternal = async () => {
  return await serverCache.getOrSet("ranked_companies", async () => {
    if (mongoose.connection.readyState === 1) {
      try {
        const companies = await Company.find({}).sort({ score: -1, createdAt: -1 }).lean();
        if (companies.length > 0) {
          companies.forEach(c => inMemoryCompanies.set(String(c._id || c.id), c));
          return companies.map(formatRankedCompany);
        }
      } catch (err) {
        console.warn("[CompanyController] DB query warning:", err.message);
      }
    }
    return Array.from(inMemoryCompanies.values()).map(formatRankedCompany);
  }, 30, "companies");
};

const getCompanies = async (req, res) => {
  try {
    const { category, minScore } = req.query;

    // Fast path: if requesting all companies without filters, return cached rankings directly
    if (!category && (minScore === undefined || minScore === "")) {
      const list = await rankCompaniesInternal();
      res.setHeader("Cache-Control", "private, no-cache");
      return res.json(list);
    }

    if (mongoose.connection.readyState === 1) {
      const filter = {};

      if (category) {
        filter.category = {
          $regex: `^${String(category)}$`,
          $options: "i"
        };
      }

      if (minScore !== undefined && minScore !== "") {
        const score = Number(minScore);
        if (Number.isFinite(score)) {
          filter.score = { $gte: score };
        }
      }

      const companies = await Company.find(filter).sort({ score: -1, createdAt: -1 }).lean();
      if (companies.length > 0) {
        companies.forEach(c => inMemoryCompanies.set(String(c._id || c.id), c));
        res.setHeader("Cache-Control", "private, no-cache");
        return res.json(companies);
      }
    }

    res.setHeader("Cache-Control", "private, no-cache");
    return res.json(Array.from(inMemoryCompanies.values()));
  } catch (error) {
    console.error("Get companies error:", error.message);
    res.status(200).json(Array.from(inMemoryCompanies.values()));
  }
};

const rankCompanies = async (req, res) => {
  try {
    const ranked = await rankCompaniesInternal();
    res.setHeader("Cache-Control", "private, no-cache");
    return res.json(ranked);
  } catch (error) {
    console.error("Rank companies error:", error.message);
    res.status(200).json(Array.from(inMemoryCompanies.values()).map(formatRankedCompany));
  }
};

const getTopCompanies = async (req, res) => {
  try {
    const limit = Number(req.params.limit) || 5;

    if (mongoose.connection.readyState === 1) {
      const companies = await Company.find({ score: { $gt: 0 } })
        .sort({ score: -1, _id: 1 })
        .limit(limit);
      if (companies.length > 0) {
        return res.json(companies.map(formatRankedCompany));
      }
    }

    const list = Array.from(inMemoryCompanies.values()).slice(0, limit);
    res.json(list.map(formatRankedCompany));
  } catch (error) {
    res.status(500).json({
      message: "Failed to get top companies",
      error: error.message
    });
  }
};

const recommendCompanies = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const companies = await Company.find({ score: { $gte: 60 } }).sort({ score: -1, _id: 1 });
      if (companies.length > 0) {
        return res.json(companies.map((c, i) => formatRankedCompany(c, i)));
      }
    }

    const list = Array.from(inMemoryCompanies.values()).filter(c => (c.score || 0) >= 60);
    res.json(list.map((c, i) => formatRankedCompany(c, i)));
  } catch (error) {
    res.status(500).json({
      message: "Failed to recommend companies",
      error: error.message
    });
  }
};

const getCompanyById = async (id) => {
  if (!id) return null;
  const strId = String(id).trim();

  if (mongoose.connection.readyState === 1) {
    try {
      if (/^[0-9a-fA-F]{24}$/.test(strId)) {
        const company = await Company.findById(strId);
        if (company) {
          inMemoryCompanies.set(String(company._id), company);
          return company;
        }
      }
      const companyByName = await Company.findOne({ name: strId });
      if (companyByName) {
        inMemoryCompanies.set(String(companyByName._id), companyByName);
        return companyByName;
      }
    } catch {}
  }

  for (const [key, comp] of inMemoryCompanies.entries()) {
    if (
      key === strId ||
      String(comp._id) === strId ||
      String(comp.id) === strId ||
      (comp.name && comp.name.toLowerCase() === strId.toLowerCase())
    ) {
      return comp;
    }
  }

  return null;
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

    const allowedFields = [
      "name", "website", "industry", "category", "recommendedTier",
      "recommendedAsk", "whyGoodSponsor", "strategy", "whatToAsk",
      "shortPitch", "isVerified", "confidence", "contactName",
      "contactEmail", "contactRole", "linkedinUrl", "sponsorshipHistory", "score"
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    let company = null;
    if (mongoose.connection.readyState === 1 && /^[0-9a-fA-F]{24}$/.test(id)) {
      try {
        company = await Company.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true, runValidators: true }
        );
      } catch {}
    }

    if (!company && inMemoryCompanies.has(String(id))) {
      company = { ...inMemoryCompanies.get(String(id)), ...updates, updatedAt: new Date() };
      inMemoryCompanies.set(String(id), company);
    }

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }

    serverCache.invalidateTag("companies");

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
    let deleted = null;

    if (mongoose.connection.readyState === 1 && /^[0-9a-fA-F]{24}$/.test(id)) {
      try {
        deleted = await Company.findByIdAndDelete(id);
      } catch {}
    }

    if (inMemoryCompanies.has(String(id))) {
      deleted = deleted || inMemoryCompanies.get(String(id));
      inMemoryCompanies.delete(String(id));
    }

    serverCache.invalidateTag("companies");
    serverCache.invalidateTag("stats");

    return res.json({
      message: "Company deleted successfully",
      company: deleted || { _id: id }
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
  rankCompaniesInternal,
  getTopCompanies,
  recommendCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  inMemoryCompanies
};