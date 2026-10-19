# SponcyBot — Backend API & Intelligence Engine

Express & Node.js backend powering SponcyBot's sponsor intelligence, proposal draft generation, Human-in-the-Loop Send Guard, and Gmail API integration.

---

## Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                 # Centralized Mongoose connection & pool config
│   ├── controllers/
│   │   ├── companyController.js  # Sponsor CRUD, scoring & rank computation
│   │   ├── emailController.js    # Proposal drafting, versioning & human review
│   │   ├── gmailController.js    # Gmail OAuth, dispatch, polling & simulation
│   │   ├── llmController.js      # Gemini LLM strategy & email generation
│   │   ├── outreachController.js # Multi-stage CRM & 2-follow-up policy
│   │   └── teamMemberController.js# Team coordinator assignment
│   ├── lib/
│   │   └── aiClient.js           # Multi-model Gemini fallback client
│   ├── middleware/
│   │   ├── errorHandler.js       # JSON 404 & centralized error handler
│   │   └── sendGuard.js          # Security guard: blocks unapproved email dispatch
│   ├── models/
│   │   ├── approvalLog.js        # Audit trail of human approve/reject decisions
│   │   ├── company.js            # Sponsor company profile & 6-factor score
│   │   ├── email.js              # Email draft document & review lifecycle
│   │   ├── emailVersion.js       # Version history snapshots
│   │   ├── gmailThread.js        # Tracked email thread conversations
│   │   ├── gmailToken.js         # OAuth credentials storage
│   │   ├── outreach.js           # Sponsor outreach status & follow-up counters
│   │   ├── outreachEvent.js      # CRM state transition audit events
│   │   └── teamMember.js         # Organizer team member profiles
│   ├── routes/
│   │   ├── companyRoutes.js      # /companies
│   │   ├── emailRoutes.js        # /emails
│   │   ├── gmailRoutes.js        # /gmail
│   │   ├── llmRoutes.js          # /llm
│   │   ├── outreachRoutes.js     # /outreach
│   │   └── teamMemberRoutes.js   # /team-members
│   ├── scripts/
│   │   ├── clearDatabase.js      # Wipe all records for fresh judge demo
│   │   ├── seedOutreach.js       # Seed sample companies & outreach
│   │   └── test*.js              # Automated CLI test runners
│   ├── services/
│   │   ├── approvalService.js    # Human approval state machine
│   │   ├── companyResearch.js    # Tavily web search integration
│   │   ├── emailGenerationService.js # AI draft generation
│   │   ├── emailPrompts.js       # Dynamic prompt engineering templates
│   │   ├── emailVersioningService.js # Immutable email version diffing
│   │   ├── gmailService.js       # Gmail API send & demo simulation
│   │   ├── llmService.js         # Gemini strategy synthesis
│   │   ├── orchestrationService.js # End-to-end pipeline coordinator
│   │   ├── outreachService.js    # Follow-up rules & status transitions
│   │   └── sponsorIntelligence.js # 6-factor scoring engine
│   └── server.js                 # Express server bootstrap & router mounts
├── .env.example                  # Environment variables template
├── package.json                  # Backend dependencies & npm scripts
└── README.md
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Scripts
```bash
# Seed initial outreach pipeline:
npm run seed:outreach

# Clear database to start completely fresh:
npm run db:clear
```
