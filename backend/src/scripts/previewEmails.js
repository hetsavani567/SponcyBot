require("dotenv").config();
const { generateEmailDraft } = require("../services/emailGenerationService");
const mockCompanies = require("../mocks/companies.json");

async function previewAll() {
  console.log("================================================================================");
  console.log("               FINAL SPONSY BOT EMAIL GENERATION SHOWCASE                       ");
  console.log("================================================================================\n");

  for (const company of mockCompanies) {
    console.log("################################################################################");
    console.log(`SPONSOR: ${company.name}`);
    console.log(`INDUSTRY: ${company.industry} | TIER: ${company.recommendedTier} | ASK TYPE: ${company.recommendedAsk.toUpperCase()}`);
    console.log(`CONTACT: ${company.contactName} (${company.contactRole})`);
    console.log("################################################################################\n");

    try {
      // 1. Initial Email
      console.log(`>>> [STAGE 1: INITIAL OUTREACH] - ${company.name}`);
      const initial = await generateEmailDraft(company, { type: "initial" });
      console.log(`SUBJECT: ${initial.subject}`);
      console.log("--------------------------------------------------------------------------------");
      console.log(initial.body);
      console.log("--------------------------------------------------------------------------------\n");

      // 2. Follow-up 1
      console.log(`>>> [STAGE 2: FOLLOW-UP 1] - ${company.name}`);
      const f1 = await generateEmailDraft(company, {
        type: "followup1",
        previousSubject: initial.subject,
        previousBody: initial.body
      });
      console.log(`SUBJECT: ${f1.subject}`);
      console.log("--------------------------------------------------------------------------------");
      console.log(f1.body);
      console.log("--------------------------------------------------------------------------------\n");

      // 3. Follow-up 2 (Closing the loop)
      console.log(`>>> [STAGE 3: FOLLOW-UP 2 (FINAL)] - ${company.name}`);
      const f2 = await generateEmailDraft(company, {
        type: "followup2",
        previousSubject: f1.subject,
        previousBody: f1.body
      });
      console.log(`SUBJECT: ${f2.subject}`);
      console.log("--------------------------------------------------------------------------------");
      console.log(f2.body);
      console.log("--------------------------------------------------------------------------------\n\n");

    } catch (err) {
      console.error(`Error generating emails for ${company.name}:`, err.message);
    }
  }
}

previewAll();
