require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/company");
const TeamMember = require("../models/teamMember");
const { Outreach } = require("../models/outreach");
const OutreachEvent = require("../models/outreachEvent");

const seedData = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI is not set in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // 1. Seed Team Members
    console.log("Seeding Team Members...");
    const membersData = [
      { name: "Het Savani", email: "het@hackathon.club", role: "Sponsorship Lead" },
      { name: "Sarah Chen", email: "sarah@hackathon.club", role: "Outreach Coordinator" },
      { name: "Alex Kumar", email: "alex@hackathon.club", role: "Partnerships Manager" }
    ];

    const members = [];
    for (const m of membersData) {
      let member = await TeamMember.findOne({ email: m.email });
      if (!member) {
        member = await TeamMember.create(m);
      }
      members.push(member);
    }
    console.log(`Seeded ${members.length} team members.`);

    // 2. Ensure Sample Companies exist
    console.log("Ensuring Sample Companies exist...");
    const sampleCompaniesData = [
      {
        name: "GitHub",
        website: "https://github.com",
        industry: "Developer Tools",
        category: "Cloud & Developer Tools",
        score: 95,
        recommendedTier: "Platinum",
        recommendedAsk: "infra",
        whyGoodSponsor: "Active supporter of student hackathons with GitHub Student Developer Pack.",
        isVerified: true,
        confidence: "HIGH"
      },
      {
        name: "Red Bull",
        website: "https://redbull.com",
        industry: "Beverages",
        category: "Food & Beverage",
        score: 82,
        recommendedTier: "Gold",
        recommendedAsk: "goodies",
        whyGoodSponsor: "Provides energy drinks and branded gaming lounges for hackathon participants.",
        isVerified: true,
        confidence: "HIGH"
      },
      {
        name: "Cloudflare",
        website: "https://cloudflare.com",
        industry: "Internet Security",
        category: "Technology",
        score: 88,
        recommendedTier: "Gold",
        recommendedAsk: "infra",
        whyGoodSponsor: "Offers security infrastructure credits and workshop mentors.",
        isVerified: true,
        confidence: "MEDIUM"
      },
      {
        name: "HDFC Bank",
        website: "https://hdfcbank.com",
        industry: "Banking",
        category: "Finance",
        score: 65,
        recommendedTier: "Silver",
        recommendedAsk: "money",
        whyGoodSponsor: "Sponsors fintech challenge tracks with cash prize money.",
        isVerified: false,
        confidence: "LOW"
      },
      {
        name: "Notion",
        website: "https://notion.so",
        industry: "Productivity Software",
        category: "Cloud & Developer Tools",
        score: 91,
        recommendedTier: "Platinum",
        recommendedAsk: "goodies",
        whyGoodSponsor: "Provides Plus plan credits and hackathon project management templates.",
        isVerified: true,
        confidence: "HIGH"
      }
    ];

    const companies = [];
    for (const c of sampleCompaniesData) {
      let company = await Company.findOne({ name: c.name });
      if (!company) {
        company = await Company.create(c);
      }
      companies.push(company);
    }
    console.log(`Ensured ${companies.length} sample companies.`);

    // 3. Clear existing test outreaches for clean demo state
    console.log("Setting up sample Outreach scenarios...");
    await Outreach.deleteMany({ companyId: { $in: companies.map(c => c._id) } });
    await OutreachEvent.deleteMany({ companyId: { $in: companies.map(c => c._id) } });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 4); // 4 days ago (overdue for follow up)

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3); // 3 days in future

    // Scenario A: GitHub -> WAITING FOR REPLY (Initial email sent)
    const outreachGitHub = await Outreach.create({
      companyId: companies[0]._id,
      memberId: members[0]._id,
      emailId: "mock_email_001",
      status: "WAITING FOR REPLY",
      followUpCount: 0,
      nextFollowUpAt: futureDate,
      lastContactedAt: new Date(),
      threadId: "gmail_thread_github_101",
      notes: "Sent introductory sponsorship proposal via Gmail."
    });
    await OutreachEvent.create({
      outreachId: outreachGitHub._id,
      companyId: companies[0]._id,
      memberId: members[0]._id,
      eventType: "OUTREACH_CREATED",
      fromStatus: null,
      toStatus: "DRAFT",
      description: "Outreach record created."
    });
    await OutreachEvent.create({
      outreachId: outreachGitHub._id,
      companyId: companies[0]._id,
      memberId: members[0]._id,
      eventType: "EMAIL_SENT",
      fromStatus: "APPROVED",
      toStatus: "SENT",
      description: "Initial sponsorship proposal email sent.",
      metadata: { emailId: "mock_email_001", threadId: "gmail_thread_github_101" }
    });

    // Scenario B: Cloudflare -> FOLLOW-UP 1 (Due for Follow-Up 2 NOW!)
    const outreachCloudflare = await Outreach.create({
      companyId: companies[2]._id,
      memberId: members[1]._id,
      emailId: "mock_email_002",
      status: "FOLLOW-UP 1",
      followUpCount: 1,
      nextFollowUpAt: pastDate, // Overdue! Will show up in GET /outreach/pending-followups
      lastContactedAt: pastDate,
      threadId: "gmail_thread_cf_102",
      notes: "Sent follow-up 1 four days ago. No reply yet. Due for second follow-up."
    });
    await OutreachEvent.create({
      outreachId: outreachCloudflare._id,
      companyId: companies[2]._id,
      memberId: members[1]._id,
      eventType: "FOLLOWUP_SENT",
      fromStatus: "WAITING FOR REPLY",
      toStatus: "FOLLOW-UP 1",
      description: "Follow-up 1 registered and sent.",
      metadata: { followUpCount: 1 }
    });

    // Scenario C: Red Bull -> INTERESTED & MEETING BOOKED!
    const meetingDate = new Date();
    meetingDate.setDate(meetingDate.getDate() + 2);
    const outreachRedBull = await Outreach.create({
      companyId: companies[1]._id,
      memberId: members[0]._id,
      emailId: "mock_email_003",
      status: "MEETING",
      followUpCount: 1,
      nextFollowUpAt: null,
      lastReplyAt: new Date(),
      meetingLink: "https://meet.google.com/abc-defg-hij",
      meetingScheduledAt: meetingDate,
      threadId: "gmail_thread_redbull_103",
      notes: "Sponsor replied positively! Confirmed virtual meeting to finalize energy drinks delivery."
    });
    await OutreachEvent.create({
      outreachId: outreachRedBull._id,
      companyId: companies[1]._id,
      memberId: members[0]._id,
      eventType: "REPLY_RECEIVED",
      fromStatus: "FOLLOW-UP 1",
      toStatus: "INTERESTED",
      description: "Sponsor replied expressing interest in sponsoring goodies & drinks.",
      metadata: { label: "interested" }
    });
    await OutreachEvent.create({
      outreachId: outreachRedBull._id,
      companyId: companies[1]._id,
      memberId: members[0]._id,
      eventType: "MEETING_BOOKED",
      fromStatus: "INTERESTED",
      toStatus: "MEETING",
      description: "Virtual meeting scheduled on Google Meet.",
      metadata: { meetingLink: "https://meet.google.com/abc-defg-hij", meetingScheduledAt: meetingDate }
    });

    // Scenario D: HDFC Bank -> DECLINED
    const outreachHDFC = await Outreach.create({
      companyId: companies[3]._id,
      memberId: members[2]._id,
      emailId: "mock_email_004",
      status: "DECLINED",
      followUpCount: 0,
      nextFollowUpAt: null,
      lastReplyAt: new Date(),
      closedReason: "Sponsor stated annual CSR and university budget exhausted for Q3.",
      threadId: "gmail_thread_hdfc_104"
    });
    await OutreachEvent.create({
      outreachId: outreachHDFC._id,
      companyId: companies[3]._id,
      memberId: members[2]._id,
      eventType: "REPLY_RECEIVED",
      fromStatus: "WAITING FOR REPLY",
      toStatus: "DECLINED",
      description: "Sponsor declined: budget exhausted.",
      metadata: { label: "declined" }
    });

    // Scenario E: Notion -> CLOSED (Max 2 Follow-ups Reached)
    const outreachNotion = await Outreach.create({
      companyId: companies[4]._id,
      memberId: members[1]._id,
      emailId: "mock_email_005",
      status: "CLOSED",
      followUpCount: 2,
      nextFollowUpAt: null,
      lastContactedAt: pastDate,
      closedReason: "MAX_FOLLOWUPS_REACHED: Stopped outreach after 2 follow-ups to prevent spamming",
      threadId: "gmail_thread_notion_105",
      notes: "Sent 2 follow-ups with no response. Automatically closed per spam prevention policy."
    });
    await OutreachEvent.create({
      outreachId: outreachNotion._id,
      companyId: companies[4]._id,
      memberId: members[1]._id,
      eventType: "MAX_FOLLOWUPS_REACHED",
      fromStatus: "FOLLOW-UP 2",
      toStatus: "CLOSED",
      description: "Maximum follow-ups (2) reached. Outreach automatically closed to prevent spamming.",
      metadata: { followUpCount: 2 }
    });

    console.log("✅ Seed completed successfully!");
    console.log("Demo scenarios available:");
    console.log("1. GitHub -> WAITING FOR REPLY (Initial contact)");
    console.log("2. Cloudflare -> FOLLOW-UP 1 (Pending follow-up due now!)");
    console.log("3. Red Bull -> MEETING (Booked Google Meet call)");
    console.log("4. HDFC Bank -> DECLINED (Declined budget)");
    console.log("5. Notion -> CLOSED (Max 2 follow-ups reached & stopped)");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

seedData();
