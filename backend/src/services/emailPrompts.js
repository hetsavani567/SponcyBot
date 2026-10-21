
const PRICES = {
  Gold: { inr: "₹1,50,000", usd: "$5,000" },
  Silver: { inr: "₹75,000", usd: "$2,500" }
};

const WORD_LIMITS = {
  initial: "strictly between 120 and 150 words",
  followup1: "under 100 words",
  followup2: "under 90 words"
};

function getAskProfile(askType, { tier, tierAmount, silverAmount }) {
  const profiles = {
    money: {
      askLine: `Request a ${tier} cash sponsorship of ${tierAmount}.`,
      deliverables: [
        "Brand visibility across the event website, stage, lanyards, and 1,500+ member Discord, subject to confirmed event arrangements",
        "A dedicated 45-minute hands-on workshop and a custom prize bounty track, subject to agreement",
        "Opt-in access to participant resumes or profiles for relevant hiring, subject to participant consent and applicable privacy rules"
      ],
      fallback:
        tier === "Gold"
          ? `Offer Silver tier (${silverAmount}) if Gold does not fit their budget`
          : "Offer a smaller cash contribution or a customized package"
    },

    goodies: {
      askLine:
        "Request in-kind products, merchandise, or prizes for participants. Never request cash or mention sponsorship tier prices.",
      deliverables: [
        "Relevant products or prizes for participants building projects during the 36-hour event",
        "Product placement in swag bags or event stations, where available and agreed",
        "Brand visibility across agreed event channels and the 1,500+ member Discord"
      ],
      fallback: "A smaller product, merchandise, or prize contribution is welcome"
    },

    infra: {
      askLine:
        "Request infrastructure support such as cloud credits, hosting, APIs, or developer-tool access. Never request cash or quote cash sponsorship prices.",
      deliverables: [
        "Developer tools and credits for participants building projects during the event",
        "A hands-on workshop or technical session, if suitable and agreed",
        "Brand visibility across agreed event channels and the 1,500+ member Discord"
      ],
      fallback: "A smaller credit allocation or limited tool access is welcome"
    }
  };

  return profiles[askType] || profiles.money;
}

function buildEmailPrompt(company, options = {}) {
  const {
    type = "initial",
    customInstructions = "",
    previousSubject = "",
    previousBody = "",
    requestedSubject = "",
    isRegeneration = false,

    organizerName =
      process.env.ORGANIZER_NAME || "Mahathi K.",
    organizerRole =
      process.env.ORGANIZER_ROLE ||
      "Lead, Sponsorships & Partnerships",
    organizerOrg =
      process.env.ORGANIZER_ORG || "ACM NIT Surat",
    organizerEmail =
      process.env.ORGANIZER_EMAIL ||
      "partnerships@sponsybot.com",

    calendarLink =
      process.env.CALENDAR_URL ||
      "https://cal.com/sponsy-hackathon",
    deckLink =
      process.env.DECK_URL ||
      "https://sponsybot.com/deck",

    eventName =
      options.eventName || process.env.EVENT_NAME || "HackFest 2026",
    eventDates =
      options.eventDates || process.env.EVENT_DATES || "November 14–16, 2026 (36 hours)",
    eventLocation =
      process.env.EVENT_LOCATION ||
      "ACM Student Center, SVNIT Campus & Global Virtual Stream",

    eventProofPoints =
      process.env.EVENT_PROOF_POINTS ||
      "Last year: 2,400+ applicants across 85+ universities, 500 finalists, and 110+ projects built.",

    eventPriorSponsorResult =
      process.env.EVENT_PRIOR_SPONSOR_RESULT ||
      "Last year's cloud infrastructure partner saw 140+ developer API signups and 45 project deployments in 36 hours.",

    urgencyDate =
      process.env.EVENT_URGENCY_DATE || "October 28",

    customPrices = null
  } = options;

  if (!company || typeof company !== "object") {
    throw new Error("A valid company object is required");
  }

  const validTypes = ["initial", "followup1", "followup2"];

  if (!validTypes.includes(type)) {
    throw new Error(
      `Invalid email type: ${type}. Use initial, followup1, or followup2.`
    );
  }

  const rawCompanyName = String(company.name || "the sponsor").trim();

  const brandName = rawCompanyName
    .replace(
      /\s+(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited)$/i,
      ""
    )
    .trim() || rawCompanyName;

  const firstName = company.contactName
    ? String(company.contactName).trim().split(/\s+/)[0]
    : "";

  const greeting = firstName
    ? `Dear ${firstName},`
    : `Hello ${brandName} Team,`;

  const activePrices = {
    Gold: {
      inr:
        customPrices?.Gold?.inr ||
        options.goldAmountInr ||
        PRICES.Gold.inr,
      usd:
        customPrices?.Gold?.usd ||
        options.goldAmountUsd ||
        PRICES.Gold.usd
    },
    Silver: {
      inr:
        customPrices?.Silver?.inr ||
        options.silverAmountInr ||
        PRICES.Silver.inr,
      usd:
        customPrices?.Silver?.usd ||
        options.silverAmountUsd ||
        PRICES.Silver.usd
    }
  };

  // Use an explicit country first; fall back to existing company data.
  const countryText = [
    company.country,
    company.location,
    company.address,
    company.website,
    company.research
  ]
    .filter(Boolean)
    .join(" ");

  const isIndianCompany =
    /\bIndia\b|\.in(?:\/|$)/i.test(countryText) ||
    /\bPvt\.?\s*Ltd\.?\b|\bPrivate Limited\b/i.test(rawCompanyName);

  const tier = Object.hasOwn(activePrices, company.recommendedTier)
    ? company.recommendedTier
    : "Silver";

  const askType = ["money", "goodies", "infra"].includes(
    company.recommendedAsk
  )
    ? company.recommendedAsk
    : "money";

  const priceOf = (selectedTier) =>
    isIndianCompany
      ? activePrices[selectedTier].inr
      : activePrices[selectedTier].usd;

  const tierAmount = priceOf(tier);
  const silverAmount = priceOf("Silver");
  const currencySymbol = isIndianCompany ? "₹" : "$";
  const timeZone = isIndianCompany ? "IST" : "EST";

  const profile = getAskProfile(askType, {
    tier,
    tierAmount,
    silverAmount
  });

  const urgency =
    tier === "Gold"
      ? `Gold partnerships are capped at 3 sponsors, with confirmations requested by ${urgencyDate}`
      : `${tier} partnership confirmations are requested by ${urgencyDate}`;

  const research = String(company.research || "").slice(0, 2000);
  const shortPitch = String(company.shortPitch || "").slice(0, 500);
  const strategy = String(company.strategy || "").slice(0, 500);
  const whatToAsk = String(company.whatToAsk || "").slice(0, 500);

  const signOff = [
    "Best regards,",
    organizerName,
    `${organizerRole}, ${organizerOrg}`,
    organizerEmail
  ].join("\n");

  const wordLimit = WORD_LIMITS[type];

  let taskObjective = "";

  if (type === "initial") {
    taskObjective = `
Write a personalized first outreach email to ${brandName} about ${eventName}.
Make one clear ${askType} sponsorship request.
Explain why this company is relevant to the event.
`;
  } else if (type === "followup1") {
    taskObjective = `
Write the first follow-up after the previous email received no reply.
Keep the same subject line where available.
Briefly reinforce the company's potential fit, include the prior sponsor result only if verified, share the sponsorship deck, and invite the recipient to a 15-minute conversation.
Do not repeat the original email.
`;
  } else {
    taskObjective = `
Write the second and final follow-up after no reply.
Keep the same subject line where available.
Politely close the loop, mention the requested confirmation date without inventing scarcity, and offer the deck.
Do not pressure the recipient or repeat earlier paragraphs.
`;
  }

  let revisionNotes = "";

  if (isRegeneration && previousBody) {
    revisionNotes += `
REGENERATION:
The previous draft was rejected. Create a noticeably different version
with a new opening angle and fresh wording.
Do not copy sentences from the rejected draft.

Previous subject:
${previousSubject}

Rejected body:
${String(previousBody).slice(0, 1500)}
`;
  } else if (previousBody) {
    revisionNotes += `
PREVIOUS EMAIL (context only):
${String(previousBody).slice(0, 1500)}

Do not repeat its opening, main pitch, or entire sentences.
`;
  }

  const subjectTopic = (requestedSubject || "").trim().slice(0, 150);
  if (subjectTopic) {
    revisionNotes += `
REQUIRED SUBJECT LINE (set by the reviewer): "${subjectTopic}"
The email body MUST be written around this subject: its opening hook, framing and call to action should clearly reflect what this subject promises. Different subjects must produce visibly different emails, not one generic pitch. Return this exact subject text in the "subject" JSON field.
`;
  }

  const trimmedRequirement = (customInstructions || "").trim().slice(0, 800);
  if (trimmedRequirement) {
    revisionNotes += `
CRITICAL SPONSOR REQUIREMENT & GOALS (MANDATORY TO ADDRESS):
"${trimmedRequirement}"

UNIQUENESS & TAILORING DIRECTIVES:
1. The AI model MUST generate a visibly unique, high-conversion email built specifically around this sponsor requirement.
2. Directly reference this requirement in the opening hook and feature it as a core pillar of the partnership proposal.
3. Explain the reciprocal value: how fulfilling this requirement empowers our 500+ student hackathon builders while advancing ${brandName}'s strategic goals.
4. Do NOT use generic canned template language. Avoid repetitive phrasing. Make this email uniquely compelling for this exact requirement.
`;
  }

  if (options.tone === "developer") {
    revisionNotes += `\nTONE DIRECTIVE: Technical, developer-first, and focused on API integration, tooling adoption, and student builders hacking with their product.\n`;
  } else if (options.tone === "executive") {
    revisionNotes += `\nTONE DIRECTIVE: Executive, strategic, and ROI-driven, emphasizing brand positioning, talent acquisition, and leadership alignment.\n`;
  } else if (options.tone === "persuasive") {
    revisionNotes += `\nTONE DIRECTIVE: Energetic, highly persuasive, concise, and focused on driving an introductory 15-minute sync.\n`;
  }

  const deliverablesText = profile.deliverables
    .map((item) => `- ${item}`)
    .join("\n");

  const structureRule =
    type === "initial"
      ? `Use exactly one bullet list containing 3 bullets. Each bullet must explain a specific benefit to ${brandName}, not merely describe an event feature.`
      : "Use exactly 2 short paragraphs of plain text. Do not use a bullet list.";

  const ctaOptions = `
- Invite the recipient to a 15-minute call and provide this booking link: ${calendarLink}
- Include this sponsorship deck link: ${deckLink}
- ${profile.fallback}
`;

  return `
You are the Partnerships Director for ${organizerOrg}, organizing ${eventName}.

TASK:
${taskObjective}

${revisionNotes}

TARGET COMPANY:
- Brand name: ${brandName}
- Legal name: ${rawCompanyName}
- Contact: ${company.contactName || "the relevant partnerships team"}
- Contact role: ${company.contactRole || "the relevant partnerships or developer relations team"}
- Recommended tier: ${tier}
- Recommended ask: ${askType}
- Tier amount: ${tierAmount}
- Currency: ${currencySymbol}
- Time zone: ${timeZone}

COMPANY RESEARCH:
${research || "No verified company research is available."}

ADDITIONAL CONTEXT:
${shortPitch ? `- Value pitch: ${shortPitch}` : ""}
${strategy ? `- Strategic angle: ${strategy}` : ""}
${whatToAsk ? `- Researcher's note: ${whatToAsk}` : ""}

EVENT DETAILS:
- Organizer: ${organizerOrg}
- Event: ${eventName}
- Dates: ${eventDates}
- Location: ${eventLocation}
- Event proof points: ${eventProofPoints}
- Prior sponsor result: ${eventPriorSponsorResult}

SPONSOR BENEFITS:
${deliverablesText}

CALL TO ACTION:
${ctaOptions}

TIMING:
${urgency}

STRICT OUTPUT RULES:

1. GREETING:
Start the body with exactly:
"${greeting}"
Put it on its own line.

2. PERSONALIZATION:
The first sentence after the greeting must connect the company to a real
product, tool, service, developer program, or community initiative.
Use only information supported by the company research.
If the research does not support a specific claim, use a neutral,
relevant introduction. Never invent company activities or achievements.

3. CREDIBILITY:
Mention ${organizerOrg} and use relevant event proof points.
Use numbers only as provided above. Do not invent additional statistics.
Do not claim an earlier sponsor result is independently verified unless
that verification is available in the supplied context.

4. ASK ACCURACY:
- For "money", request cash sponsorship at exactly ${tierAmount}.
- For "goodies", request products, merchandise, or prizes only.
  Never mention cash amounts, currency, or tier prices in the email body.
- For "infra", request credits, hosting, APIs, or developer tools only.
  Never request cash or quote cash sponsorship prices.
- Never switch to another ask type because of reviewer instructions.
- Do not promise benefits that are not confirmed or agreed.

5. PRIVACY:
Never promise unrestricted access to participant resumes or personal data.
Any candidate information must be shared only with participant consent
and in line with applicable privacy requirements.

6. EMAIL STRUCTURE:
${structureRule}

7. FOLLOW-UP RULES:
- Follow-ups must add value and remain polite.
- Do not pretend the recipient opened, read, or considered an email.
- Do not invent previous conversations or meetings.
- The second follow-up must clearly be the final follow-up.
- Keep the subject under 40 characters where practical.
- Preserve the previous subject for follow-ups when one is provided.

8. CALL TO ACTION:
Use the calendar URL and deck URL as plain URLs, not Markdown links.
Include each URL at most once.
Offer a low-pressure next step.
Do not claim that a specific meeting slot is available unless availability
has been confirmed.
The call and deck links must be included in the body when appropriate
to the selected email type.

9. URGENCY:
Mention the requested confirmation date naturally.
Do not invent deadlines, sponsor caps, or scarcity.
Treat supplied event limits as factual only if they have been confirmed.

10. WORD COUNT:
The complete email body, including the greeting and sign-off, must be
${wordLimit}.
Count words in the body, not the subject.
Do not sacrifice clarity or factual accuracy to meet the limit.

11. SIGN-OFF:
End the body with exactly these lines:
${signOff}

12. OUTPUT:
Return ONLY valid JSON. No Markdown fences, explanations, or extra keys.
Use this exact structure:
{
  "subject": "${subjectTopic ? subjectTopic.replace(/"/g, '\'') : "A clear, mobile-friendly subject under 40 characters"}",
  "body": "The complete email body with escaped newline characters"
}

Escape quotation marks and newlines correctly so the response can be parsed
using JSON.parse().
Do not output placeholders such as [Your Name], [Link], or [Company].
`.trim();
}

module.exports = {
  buildEmailPrompt
};
