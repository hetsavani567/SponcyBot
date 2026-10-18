# Manual steps (things I couldn't change without seeing your routes/models/services)

## 1. Dependencies
    npm install express cors mongoose dotenv @google/genai

## 2. routes/emailRoutes.js  - static route BEFORE :id
    router.get("/pending-approval", getPendingApprovalEmails);   // must come first
    router.get("/:id", getEmail);
    router.get("/", listEmails);

## 3. models/email.js - add field used by rejectEmail
    rejectionReason: { type: String, default: "" }

## 4. models/outreach.js - stop duplicate active outreach even under race conditions
Use $in with the ACTIVE statuses ($nin is not allowed in a partial index). Match the exact
values in OUTREACH_STATUSES:
    outreachSchema.index(
      { companyId: 1 },
      { unique: true, partialFilterExpression: { status: { $in: ["DRAFT","SENT","WAITING FOR REPLY","INTERESTED","MEETING","NO REPLY"] } } }
    );
(Drop any existing duplicate active outreaches first or index creation will fail.)

## 5. emailGenerationService.js - use the per-tier ask range
emailController now passes options.askAmountRange = { min, max, label } based on recommendedTier.
In your prompt builder, tell the model to propose a figure inside that range
(and tailor it to company size) instead of a fixed amount.
Edit TIER_ASK_RANGES at the top of emailController.js to your real budget numbers.

## 6. .env additions
    P4_WEBHOOK_SECRET=some-long-random-string     # Person 4 must send it as header x-webhook-secret
    CORS_ORIGIN=http://localhost:3000             # optional, frontend origin
