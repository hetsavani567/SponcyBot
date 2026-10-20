/**
 * SeedDataService
 * Provides guaranteed in-memory demo datasets and automatic MongoDB Atlas seeding
 * so that deployed environments (Vercel, Render) display appropriate metrics and records
 * identical to localhost, even before any manual database scripts are run.
 */

const mongoose = require("mongoose");

const defaultCompanies = [
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

const defaultTeamMembers = [
  {
    _id: "672000000000000000000001",
    id: "672000000000000000000001",
    name: "Het Savani",
    email: "het@hackathon.club",
    role: "Sponsorship Lead",
    active: true
  },
  {
    _id: "672000000000000000000002",
    id: "672000000000000000000002",
    name: "Sarah Chen",
    email: "sarah@hackathon.club",
    role: "Outreach Coordinator",
    active: true
  },
  {
    _id: "672000000000000000000003",
    id: "672000000000000000000003",
    name: "Alex Kumar",
    email: "alex@hackathon.club",
    role: "Partnerships Manager",
    active: true
  }
];

const pastFollowUpDate = new Date();
pastFollowUpDate.setDate(pastFollowUpDate.getDate() - 4); // 4 days ago (due now!)

const futureFollowUpDate = new Date();
futureFollowUpDate.setDate(futureFollowUpDate.getDate() + 3); // 3 days in future

const meetingDate = new Date();
meetingDate.setDate(meetingDate.getDate() + 2); // 2 days in future

const defaultOutreaches = [
  {
    _id: "673000000000000000000001",
    id: "673000000000000000000001",
    companyId: defaultCompanies[0],
    memberId: defaultTeamMembers[0],
    emailId: "674000000000000000000001",
    status: "WAITING FOR REPLY",
    followUpCount: 0,
    nextFollowUpAt: futureFollowUpDate,
    lastContactedAt: new Date(),
    threadId: "gmail_thread_github_101",
    notes: "Sent introductory sponsorship proposal via Gmail integration."
  },
  {
    _id: "673000000000000000000002",
    id: "673000000000000000000002",
    companyId: defaultCompanies[1],
    memberId: defaultTeamMembers[1],
    emailId: "674000000000000000000002",
    status: "FOLLOW-UP 1",
    followUpCount: 1,
    nextFollowUpAt: pastFollowUpDate, // Overdue! Shows in follow-ups due badge
    lastContactedAt: pastFollowUpDate,
    threadId: "gmail_thread_supabase_102",
    notes: "Sent follow-up 1 four days ago. No reply yet. Due for second follow-up."
  },
  {
    _id: "673000000000000000000003",
    id: "673000000000000000000003",
    companyId: defaultCompanies[4],
    memberId: defaultTeamMembers[0],
    emailId: "674000000000000000000003",
    status: "MEETING",
    followUpCount: 1,
    nextFollowUpAt: null,
    lastReplyAt: new Date(),
    meetingLink: "https://meet.google.com/abc-defg-hij",
    meetingScheduledAt: meetingDate,
    threadId: "gmail_thread_redbull_103",
    notes: "Sponsor replied positively! Confirmed virtual meeting on Google Meet."
  },
  {
    _id: "673000000000000000000004",
    id: "673000000000000000000004",
    companyId: defaultCompanies[2],
    memberId: defaultTeamMembers[2],
    emailId: null,
    status: "DRAFT",
    followUpCount: 0,
    nextFollowUpAt: null,
    notes: "Assigned to Alex Kumar for initial outreach."
  },
  {
    _id: "673000000000000000000005",
    id: "673000000000000000000005",
    companyId: defaultCompanies[3],
    memberId: defaultTeamMembers[1],
    emailId: null,
    status: "DRAFT",
    followUpCount: 0,
    nextFollowUpAt: null,
    notes: "Assigned to Sarah Chen for goodie hampers."
  }
];

const defaultEmails = [
  {
    _id: "674000000000000000000001",
    id: "674000000000000000000001",
    companyId: defaultCompanies[0],
    type: "initial",
    subject: "Partnering with HackFest 2026: GitHub Developer Tooling Track",
    body: "Hi GitHub DevRel Team,\n\nWe are organizing HackFest 2026 bringing together 500+ builders.\n\nWe would love to feature a dedicated GitHub Copilot workshop track and student developer pack activation.\n\nCould we connect this week for a brief 10-minute sync?\n\nBest regards,\nHet Savani",
    status: "SENT",
    version: 2,
    askType: "infra",
    createdAt: new Date(Date.now() - 3600000 * 24),
    updatedAt: new Date(Date.now() - 3600000 * 24)
  },
  {
    _id: "674000000000000000000002",
    id: "674000000000000000000002",
    companyId: defaultCompanies[1],
    type: "initial",
    subject: "Supabase Database Track & Pro Credits Partnership - HackFest 2026",
    body: "Hi Supabase Partnerships Lead,\n\nWe would love to feature Supabase as our Official Database Partner for HackFest 2026, empowering 500+ builders to build full-stack apps in 36 hours.\n\nWe would love to provide participants with Supabase credits and host a prize bounty for best backend architecture.\n\nWould you be open to a quick 10-minute sync?\n\nBest regards,\nPartnerships Team",
    status: "PENDING_APPROVAL",
    version: 2,
    askType: "infra",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Fallback baseline stats for cloud/deployment cold starts or empty databases
const defaultStats = {
  sponsors: {
    total: defaultCompanies.length
  },
  emails: {
    pendingApproval: 1,
    totalSent: 1,
    approvalsGiven: 1,
    rejectionsGiven: 0
  },
  gmail: {
    trackedThreads: 3
  },
  outreach: {
    totalOutreach: defaultOutreaches.length,
    statusCounts: {
      "WAITING FOR REPLY": 1,
      "FOLLOW-UP 1": 1,
      "MEETING": 1,
      "DRAFT": 2,
      "CLOSED": 0,
      "DECLINED": 0,
      "INTERESTED": 0,
      "APPROVED": 0,
      "SENT": 0,
      "NO REPLY": 0,
      "FOLLOW-UP 2": 0
    },
    pendingFollowUpsDue: 1,
    totalFollowUpsSent: 2,
    repliesReceived: 1,
    responseRatePercent: 40.0,
    conversionsCount: 1,
    conversionRatePercent: 20.0,
    fundsSecuredINR: 150000
  }
};

let seedingInProgress = false;

/**
 * Automatically seeds MongoDB with initial sample data if the collections are empty.
 * Runs non-destructively: only triggers if Company collection has 0 documents.
 */
const autoSeedDatabase = async () => {
  if (mongoose.connection.readyState !== 1 || seedingInProgress) {
    return;
  }

  seedingInProgress = true;
  try {
    const Company = require("../models/company");
    const TeamMember = require("../models/teamMember");
    const { Outreach } = require("../models/outreach");
    const { Email } = require("../models/email");

    const companyCount = await Company.countDocuments();
    if (companyCount > 0) {
      seedingInProgress = false;
      return; // Already populated
    }

    console.log("[AutoSeed] Clean deployment database detected. Seeding default demo data...");

    // 1. Seed Companies
    const savedCompanies = [];
    for (const c of defaultCompanies) {
      const doc = await Company.findOneAndUpdate(
        { name: c.name },
        { $setOnInsert: c },
        { upsert: true, new: true }
      );
      savedCompanies.push(doc);
    }

    // 2. Seed Team Members
    const savedMembers = [];
    for (const m of defaultTeamMembers) {
      const doc = await TeamMember.findOneAndUpdate(
        { email: m.email },
        { $setOnInsert: m },
        { upsert: true, new: true }
      );
      savedMembers.push(doc);
    }

    // 3. Seed Emails
    const savedEmails = [];
    for (let i = 0; i < defaultEmails.length; i++) {
      const e = defaultEmails[i];
      const comp = savedCompanies[i] || savedCompanies[0];
      const doc = await Email.findOneAndUpdate(
        { subject: e.subject },
        { $setOnInsert: { ...e, companyId: comp._id } },
        { upsert: true, new: true }
      );
      savedEmails.push(doc);
    }

    // 4. Seed Outreaches
    for (let i = 0; i < defaultOutreaches.length; i++) {
      const o = defaultOutreaches[i];
      const comp = savedCompanies[i % savedCompanies.length];
      const mem = savedMembers[i % savedMembers.length];
      const email = savedEmails[i] ? savedEmails[i]._id : null;

      await Outreach.findOneAndUpdate(
        { companyId: comp._id, memberId: mem._id },
        {
          $setOnInsert: {
            ...o,
            companyId: comp._id,
            memberId: mem._id,
            emailId: email ? email.toString() : null
          }
        },
        { upsert: true }
      );
    }

    console.log("[AutoSeed] Successfully populated deployment database with sample companies, members, and outreaches.");
  } catch (err) {
    console.warn("[AutoSeed] Warning during initial seed:", err.message);
  } finally {
    seedingInProgress = false;
  }
};

module.exports = {
  defaultCompanies,
  defaultTeamMembers,
  defaultOutreaches,
  defaultEmails,
  defaultStats,
  autoSeedDatabase
};
