/**
 * Email prompt builder. The tier decides the price, the ask type decides
 * WHAT we ask for, and the email type (initial / followup1 / followup2)
 * decides the length and structure.
 */

const PRICES = {
  Gold: { inr: "₹1,50,000", usd: "$5,000" },
  Silver: { inr: "₹75,000", usd: "$2,500" }
};

function getAskProfile(askType, { tier, tierAmount, silverAmount }) {
  const profiles = {
    money: {
      askLine: `Ask for a ${tier} cash sponsorship (${tierAmount}).`,
      deliverables: [
        "A dedicated 45-minute hands-on workshop and a custom prize bounty track",
        "Full opt-in resume database of all 500 finalists for engineering and DevRel hiring",
        "Prime logo branding across stage, website, lanyards, and our 1,500+ member Discord"
      ],
      fallback:
        tier === "Gold"
          ? `Silver tier (${silverAmount}) if Gold doesn't fit their current quarter`
          : "A smaller contribution is welcome too, and we can tailor it to their budget"
    },
    goodies: {
      askLine:
        "Ask for in-kind goodies (products, swag or prizes) for 500 participants. Do NOT mention cash amounts or tier prices.",
      deliverables: [
        "Their products in the hands of 500 builders over 36 hours",
        "Branded placement in swag bags and on-site stations",
        "Logo branding across stage, website, lanyards, and our 1,500+ member Discord"
      ],
      fallback: "A smaller product or swag contribution works too"
    },
    infra: {
      askLine:
        "Ask for infrastructure support (cloud credits, hosting or tooling access) for participants. Do NOT ask for cash.",
      deliverables: [
        "Their tools and credits used directly by 500 builders over 36 hours",
        "A dedicated 45-minute hands-on workshop and a custom prize bounty track",
        "Logo branding across stage, website, lanyards, and our 1,500+ member Discord"
      ],
      fallback: "A smaller credit allocation works too"
    }
  };
  return profiles[askType];
}

const WORD_LIMITS = {
  initial: "strictly between 120 and 150 words",
  followup1: "under 100 words",
  followup2: "under 90 words"
};

function buildEmailPrompt(company, options = {}) {
  const {
    type = "initial",
    customInstructions = "",
    previousSubject = "",
    previousBody = "",
    isRegeneration = false,
    organizerName = process.env.ORGANIZER_NAME || "Mahathi K.",
    organizerRole = process.env.ORGANIZER_ROLE || "Lead, Sponsorships & Partnerships",
    organizerOrg = process.env.ORGANIZER_ORG || "ACM NIT Surat",
    organizerEmail = process.env.ORGANIZER_EMAIL || "partnerships@sponsybot.com",
    calendarLink = process.env.CALENDAR_URL || "https://cal.com/sponsy-hackathon",
    deckLink = process.env.DECK_URL || "https://sponsybot.com/deck",
    eventName = process.env.EVENT_NAME || "Sponsy Bot Hackathon 2026",
    eventDates = process.env.EVENT_DATES || "November 14–16, 2026 (36 hours)",
    eventLocation = process.env.EVENT_LOCATION || "ACM Student Center, SVNIT Campus & Global Virtual Stream",
    eventProofPoints = process.env.EVENT_PROOF_POINTS || "Last year: 2,400+ applicants across 85+ universities, 500 finalists (20% acceptance rate), 110+ projects built.",
    eventPriorSponsorResult = process.env.EVENT_PRIOR_SPONSOR_RESULT || "Last year's cloud infrastructure partner saw 140+ developer API signups and 45 project deployments in 36 hours.",
    urgencyDate = process.env.EVENT_URGENCY_DATE || "October 28",
    customPrices = null
  } = options;

  const rawCompanyName = company.name || "the sponsor";
  const isIndianCompany =
    /Pvt\.?\s*Ltd\.?/i.test(rawCompanyName) || /India/i.test(company.research || "");

  const brandName = rawCompanyName
    .replace(/\s*(Pvt\.?\s*Ltd\.?|Inc\.?|LLC|Corp\.?|Ltd\.?)$/i, "")
    .trim();

  const firstName = company.contactName
    ? company.contactName.trim().split(/\s+/)[0]
    : "";
  const greeting = firstName ? `Dear ${firstName},` : `Hello ${brandName} Team,`;

  const activePrices = {
    Gold: {
      inr: (customPrices && customPrices.Gold && customPrices.Gold.inr) || options.goldAmountInr || PRICES.Gold.inr,
      usd: (customPrices && customPrices.Gold && customPrices.Gold.usd) || options.goldAmountUsd || PRICES.Gold.usd
    },
    Silver: {
      inr: (customPrices && customPrices.Silver && customPrices.Silver.inr) || options.silverAmountInr || PRICES.Silver.inr,
      usd: (customPrices && customPrices.Silver && customPrices.Silver.usd) || options.silverAmountUsd || PRICES.Silver.usd
    }
  };

  // Unknown tier names fall back to Silver (the cheaper, safer ask)
  const tier = activePrices[company.recommendedTier] ? company.recommendedTier : "Silver";
  const askType = ["money", "goodies", "infra"].includes(company.recommendedAsk)
    ? company.recommendedAsk
    : "money";

  const priceOf = (t) => (isIndianCompany ? activePrices[t].inr : activePrices[t].usd);
  const tierAmount = priceOf(tier);
  const silverAmount = priceOf("Silver");
  const currencySymbol = isIndianCompany ? "₹" : "$";
  const timeZone = isIndianCompany ? "IST" : "EST";

  const profile = getAskProfile(askType, { tier, tierAmount, silverAmount });
  const urgency =
    tier === "Gold"
      ? `Gold partnerships are capped at 3 sponsors and confirmations close on ${urgencyDate}`
      : `${tier} partnerships close on ${urgencyDate}`;

  const research = (company.research || "").slice(0, 2000);
  const shortPitch = company.shortPitch || "";
  const strategy = company.strategy || "";
  const whatToAsk = company.whatToAsk || "";

  const signOff = `Best regards,\n${organizerName}\n${organizerRole}, ${organizerOrg}\n${organizerEmail}`;
  const wordLimit = WORD_LIMITS[type] || WORD_LIMITS.initial;

  let taskObjective = "";
  if (type === "initial") {
    taskObjective = `You are drafting an initial cold outreach email to ${brandName} for ${eventName}.\n${profile.askLine}`;
  } else if (type === "followup1") {
    taskObjective = `You are drafting the 1st follow-up email after no reply.
Previous Subject: ${previousSubject || `${organizerOrg} Hackathon x ${brandName}`}
Reiterate the proof point (140+ API integrations last year), mention the deck link, and ask for a 15-min chat.
${profile.askLine}`;
  } else if (type === "followup2") {
    taskObjective = `You are drafting the 2nd (final) follow-up email.
Previous Subject: ${previousSubject || `${organizerOrg} Hackathon x ${brandName}`}
Politely close the loop, mention that ${urgency}, and offer to send the one-pager deck.
${profile.askLine}`;
  }

  // Regeneration vs follow-up context vs reviewer notes
  let revisionNotes = "";
  if (isRegeneration && previousBody) {
    revisionNotes += `
The reviewer rejected the earlier draft below. Write a clearly different version: a new opening hook and new wording, and do not reuse its sentences.
REJECTED SUBJECT: ${previousSubject}
REJECTED BODY:
${previousBody.slice(0, 1500)}
`;
  } else if (previousBody) {
    revisionNotes += `
Earlier email already sent (for context only, do not repeat it):
${previousBody.slice(0, 1500)}
`;
  }
  if (customInstructions && customInstructions.trim()) {
    revisionNotes += `
REVIEWER INSTRUCTIONS (follow these, but still obey every output rule below):
${customInstructions.trim().slice(0, 500)}
`;
  }

  const deliverablesText = profile.deliverables
    .map((d, i) => `${i + 1}. ${d}`)
    .join("\n");

  const ctaOptions = [
    `A 15-minute call this Tuesday or Thursday between 2:00 PM – 5:00 PM ${timeZone} (${calendarLink})`,
    `A forwardable sponsorship deck (${deckLink})`,
    profile.fallback
  ];

  const structureRule =
    type === "initial"
      ? `3. SINGLE BULLET LIST (RESULTS-ORIENTED): Present exactly ONE list of 3 to 4 bullets phrased as direct results for ${brandName}, not a list of hackathon features.`
      : `3. NO BULLET LIST: This is a short follow-up. Write 2 short paragraphs of plain text.`;

  return `
You are the Partnerships Director for ${organizerOrg} (organizers of ${eventName}).
${taskObjective}
${revisionNotes}
Target Sponsor Context:
- Brand Name: ${brandName} (Legal: ${rawCompanyName})
- Contact: ${company.contactName || "Team"} (${company.contactRole || "Developer Relations"})
- Recommended Tier: ${tier}
- Recommended Ask: ${askType}
- Pricing (${currencySymbol}): ${tier} = ${tierAmount}
- Time Zone: ${timeZone}
- Verifiable Intelligence from Research:
${research ? research : `${brandName} developer tooling and student credit programs`}
${shortPitch ? `- Value Pitch: ${shortPitch}` : ""}
${strategy ? `- Strategic Angle: ${strategy}` : ""}
${whatToAsk ? `- Researcher's note on the ask (context only, never copy amounts or currency from it): ${whatToAsk}` : ""}

Event Credentials & Hard Proof Points:
- Organizers: ${organizerOrg}
- Proof Points: ${eventProofPoints}
- Prior Sponsor Result: ${eventPriorSponsorResult}
- Dates: ${eventDates}
- Location: ${eventLocation}

What ${brandName} Gets:
${deliverablesText}

Call to Action (offer these options):
- ${ctaOptions.join("\n- ")}
- Urgency: ${urgency}

CRITICAL OUTPUT RULES:
1. GREETING AND HOOK: Start the body with exactly "${greeting}" on its own line. The first sentence after it must reference ${brandName}'s real tooling, developer credits, or past community support from the research. Never say "I hope this email finds you well" or "I am writing to".
2. ORGANISER CREDIBILITY WITH HARD NUMBERS: Cite "${organizerOrg}" and use the proof points above instead of adjectives.
${structureRule}
4. ASK ACCURACY: Ask only for what the Recommended Ask describes. Use ${currencySymbol}, time zone ${timeZone}, and the conversational name "${brandName}" (no "Pvt Ltd" in prose).
5. LOW-FRICTION CTA: Offer the options above, with the call and the deck link each appearing once.
6. REAL REASON TO ACT NOW: State that ${urgency}.
7. WORD COUNT: Keep the email body ${wordLimit}, clean and skimmable.
8. ABSOLUTELY NO PLACEHOLDERS: Never output [Your Name] or [Link]. End the body with this exact sign-off, using line breaks:
${signOff}
9. Return ONLY valid raw JSON with no markdown code fences:
{
  "subject": "Mobile-ready subject line under 40 characters",
  "body": "Exact email body text with sign-off"
}
`.trim();
}

module.exports = {
  buildEmailPrompt
};