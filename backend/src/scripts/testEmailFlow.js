require("dotenv").config();
const mongoose = require("mongoose");
const { Email } = require("../models/email");
const { EmailVersion } = require("../models/emailVersion");
const Company = require("../models/company");
const { generateEmailDraft } = require("../services/emailGenerationService");
const {
  createInitialEmail,
  recordRegeneratedVersion,
  recordHumanEdit,
  getEmailWithVersions
} = require("../services/emailVersioningService");
const mockCompanies = require("../mocks/companies.json");

async function runEndToEndTest() {
  console.log("=== AI EMAIL ENGINE END-TO-END TEST ===\n");

  try {
    console.log("1. Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB successfully\n");

    // Clean up any test company/email
    const testCompanyName = "TestTech Sponsor Co";
    await Company.deleteMany({ name: testCompanyName });

    // 2. Create test sponsor company
    console.log("2. Creating test sponsor company using real schema fields...");
    const company = await Company.create({
      name: testCompanyName,
      website: "https://testtech.example",
      industry: "Cloud Infrastructure",
      category: "Cloud & Developer Tools",
      research: "Specializes in scalable cloud instances and APIs, frequently supports student developer communities.",
      score: 88,
      recommendedTier: "Gold",
      recommendedAsk: "money",
      shortPitch: "Empowering developers with scalable cloud tools.",
      strategy: "Pitch high student developer mindshare and workshop opportunities.",
      whatToAsk: "Request Gold sponsorship tier of $5,000.",
      whyGoodSponsor: "Strong track record of supporting student hackathons.",
      contactName: "Jordan Lee",
      contactRole: "Director of Developer Relations"
    });
    console.log(`✓ Company created: ${company.name} (ID: ${company._id})\n`);

    // 3. Test initial email generation
    console.log("3. Testing initial email generation with Gemini...");
    const draft = await generateEmailDraft(company, { type: "initial" });
    console.log("✓ AI Draft generated:");
    console.log("  Subject:", draft.subject);
    console.log("  Body preview:", draft.body.slice(0, 120) + "...\n");

    // 4. Test initial Email and Version 1 creation
    console.log("4. Saving initial email into database...");
    const { email, emailVersion: v1 } = await createInitialEmail({
      companyId: company._id,
      type: "initial",
      askType: company.recommendedAsk,
      subject: draft.subject,
      body: draft.body,
      promptUsed: draft.promptUsed,
      status: "PENDING_APPROVAL"
    });
    console.log(`✓ Email created (ID: ${email._id})`);
    console.log(`  Status: ${email.status}`);
    console.log(`  Version: ${email.version}`);
    console.log(`  Type: ${email.type}`);
    console.log(`  Version 1 ID: ${v1._id}, Source: ${v1.source}\n`);

    // 5. Test regeneration (accepts PENDING_APPROVAL / DRAFT, sets back to PENDING_APPROVAL)
    console.log("5. Testing AI regeneration (creating version 2)...");
    const regenDraft = await generateEmailDraft(company, {
      type: email.type,
      customInstructions: "Make it more enthusiastic and highlight the 500+ attendees."
    });
    const { email: emailV2, emailVersion: v2 } = await recordRegeneratedVersion({
      emailId: email._id,
      subject: regenDraft.subject,
      body: regenDraft.body,
      promptUsed: regenDraft.promptUsed,
      notes: "Regeneration with focus on 500+ attendees"
    });
    console.log(`✓ Email regenerated to Version: ${emailV2.version}`);
    console.log(`  Updated Subject: ${emailV2.subject}`);
    console.log(`  Status: ${emailV2.status}`);
    console.log(`  Version 2 ID: ${v2._id}, Source: ${v2.source}\n`);

    // 6. Test human edit (creating version 3)
    console.log("6. Testing human edit (creating version 3)...");
    const humanSubject = "Updated: Exclusive Gold Partnership with Sponsy Bot Hackathon";
    const humanBody = emailV2.body + "\n\nP.S. We also have booth spaces available!";
    const { email: emailV3, emailVersion: v3 } = await recordHumanEdit({
      emailId: email._id,
      subject: humanSubject,
      body: humanBody,
      notes: "Added P.S. note about booth space"
    });
    console.log(`✓ Human edit saved as Version: ${emailV3.version}`);
    console.log(`  Version 3 Source: ${v3.source}`);
    console.log(`  Version 3 Notes: ${v3.notes}\n`);

    // 7. Test guard: reject edit and regenerate when APPROVED or SENT
    console.log("7. Testing security guard (rejecting edit/regenerate for APPROVED / SENT)...");
    emailV3.status = "APPROVED";
    await emailV3.save();

    let guardPassed = false;
    try {
      await recordRegeneratedVersion({
        emailId: emailV3._id,
        subject: "Should fail",
        body: "Should fail"
      });
    } catch (err) {
      if (err.statusCode === 400) {
        guardPassed = true;
        console.log(`✓ Guard correctly rejected regeneration on APPROVED email: "${err.message}"`);
      }
    }
    if (!guardPassed) throw new Error("Guard failed: APPROVED email was not rejected on regenerate!");

    let editGuardPassed = false;
    try {
      await recordHumanEdit({
        emailId: emailV3._id,
        subject: "Should fail edit"
      });
    } catch (err) {
      if (err.statusCode === 400) {
        editGuardPassed = true;
        console.log(`✓ Guard correctly rejected human edit on APPROVED email: "${err.message}"\n`);
      }
    }
    if (!editGuardPassed) throw new Error("Guard failed: APPROVED email was not rejected on edit!");

    // 8. Test full version history retrieval
    console.log("8. Testing full version history retrieval (GET /emails/:id logic)...");
    const fullHistory = await getEmailWithVersions(email._id);
    console.log(`✓ Retrieved Email ID: ${fullHistory.email._id}`);
    console.log(`  Total Versions recorded: ${fullHistory.versions.length}`);
    fullHistory.versions.forEach((v) => {
      console.log(`    - Version ${v.version} [${v.source.toUpperCase()}]: ${v.subject}`);
    });

    console.log("\n========================================================");
    console.log("🎉 ALL END-TO-END TESTS COMPLETED SUCCESSFULLY!");
    console.log("========================================================\n");

    // Clean up test data
    await EmailVersion.deleteMany({ emailId: email._id });
    await Email.deleteOne({ _id: email._id });
    await Company.deleteOne({ _id: company._id });
    console.log("✓ Cleaned up test database records.");

  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
}

runEndToEndTest();
