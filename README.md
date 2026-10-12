# Sponsy Bot - Sponsorship Outreach Automation
**Track 5 | 4-Person Hackathon | Backend-Heavy | Human-in-the-Loop | Free APIs Only**

Automates university hackathon sponsor outreach end-to-end. It replaces scattered spreadsheets, forgotten follow-ups, and generic mass emails with an intelligent, human-supervised outreach pipeline.

---

### 🛡️ The Golden Rule
> **AI generates the email ➔ Human reviews & edits ➔ Human approves ➔ Gmail sends it**
> 
> *No email leaves the system unless its status is `APPROVED`. Follow-ups obey the exact same rule. Maximum 2 follow-ups per sponsor—spamming is strictly blocked.*

---

## 🚦 Project Status (Current vs Upcoming)

| Module | Role | Status | Description |
|---|---|---|---|
| **Person 1** | Sponsor Intelligence & Research | 🟢 **COMPLETED** | Company CRUD, duplicate outreach prevention, Tavily search, Gemini `gemini-3.8-flash` scoring (6-factor breakdown), tier & ask recommendations, and leaderboard ranking. |
| **Person 3** | Outreach CRM & Follow-up Engine | 🟢 **COMPLETED** | CRM tracking, team owner assignments, timeline event audit log (`OutreachEvent`), **strict max 2 follow-ups block**, overdue follow-up detection, and pipeline analytics. |
| **Person 2** | AI Email & Personalisation Engine | 🟡 **UPCOMING** | Email draft generation, prompt templates, AI regeneration, human edit versioning (`models/email.js`, `/emails/*`). |
| **Person 4** | Approval Workflow, Gmail & Frontend | 🟡 **UPCOMING** | Human approval gatekeeper (`/emails/:id/approve`), Gmail send guard (`/gmail/send`), reply detection webhook, and demo frontend. |

---

## 🟢 Completed Modules (In Active Codebase)

### 1. Person 1: Sponsor Intelligence & Research Engine
*Turn a company name into a ranked sponsor with a recommended tier and ask.*

* **Duplicate Outreach Prevention:** `POST /companies` verifies company name and website domains against existing records (case-insensitive) to prevent duplicate organizer outreach.
* **Tavily Research Integration:** Real-time web search for hackathon/sponsorship history, tech stacks, and developer programs.
* **AI Fit Scoring (Gemini `gemini-3.8-flash`):** Evaluates companies across 6 objective factors (Max 100):
  * `eventFit` (max 25)
  * `sponsorshipEvidence` (max 20)
  * `educationCommunityFit` (max 15)
  * `productRelevance` (max 15)
  * `audienceFit` (max 15)
  * `sponsorshipPotential` (max 10)
* **Tier & Ask Recommendations:**
  * **Tiers:** Platinum (≥90), Gold (≥75), Silver (≥60), Bronze (<60).
  * **Asks:** `money` (cash grant), `goodies` (swag/food), `infra` (cloud/API credits).
* **Verification & Institutional Memory:** Flags evidence (`isVerified: Boolean`, `confidence: HIGH/MEDIUM/LOW/UNVERIFIED`) and provides `sponsorshipHistory` storage for future teams.

**Live Endpoints (Person 1):**
* `POST /companies` — Add a new company (with duplicate prevention)
* `GET /companies` — List & filter companies by category and minimum score
* `GET /companies/:id` — Full company details, research notes, tier, and ask
* `POST /companies/research` — Trigger Tavily search + Gemini analysis and score computation
* `GET /companies/rank` — Leaderboard of companies ranked by fit score

---

### 2. Person 3: Outreach CRM & Follow-up Engine
*Always know who contacted whom, what happened, and when to follow up or stop.*

* **Owner & Sponsor Tracking:** Maps sponsors to specific organizers (`TeamMember`), ensuring no two organizers contact the same company.
* **Spam Prevention (Hard Cap at 2 Follow-ups):**
  * **Follow-up 1:** Allowed, increments count to 1, schedules follow-up in +3 days.
  * **Follow-up 2:** Allowed, increments count to 2, clears next schedule (limit reached).
  * **Follow-up 3:** **Strictly BLOCKED with HTTP 400 Bad Request**. Outreach is automatically moved to `CLOSED` with reason: `MAX_FOLLOWUPS_REACHED`.
* **Full Audit Trail (`OutreachEvent`):** Chronological timeline of every interaction, status transition, and note.
* **Overdue Follow-up Detection:** Automatically queries sponsors due for follow-ups today (`GET /outreach/pending-followups`).
* **Pipeline Metrics:** Real-time stats on total outreach, stage counts, reply rate %, and conversion rate % (`GET /outreach/stats`).

**Live Endpoints (Person 3):**
* `GET /outreach` — List all outreach records (filterable by `status`, `memberId`, `companyId`)
* `GET /outreach/pending-followups` — Get follow-ups due now (`nextFollowUpAt <= now` & `followUpCount < 2`)
* `GET /outreach/stats` — Dashboard analytics (status breakdown, reply rate %)
* `GET /outreach/:id` — Single outreach details with complete chronological event timeline
* `GET /outreach/history` — Global communications timeline across all sponsors
* `POST /outreach` — Create and assign outreach (blocks duplicate company assignment with HTTP 409)
* `POST /outreach/:id/followup` — Register follow-up (enforces max 2 limit)
* `POST /outreach/:id/close` — Close outreach with reason
* `POST /outreach/:id/status` — Move to `INTERESTED`, `MEETING` (with Google Meet link), or `DECLINED`
* `POST /outreach/webhook` — Webhook receiver for Person 4 sent and reply events
* `GET /team-members` & `POST /team-members` — Manage organizers

---

## 🟡 Upcoming Modules (Specifications for Teammates)

### 3. Person 2: AI Email & Personalisation Engine (To Be Added)
*Write a personalised email for every sponsor and never send it.*

* **Responsibilities:**
  * Define `models/email.js` with versioning (`version: Number`, `versions: [{ version, subject, body, editedBy }]`).
  * Implement `POST /emails/generate` using Gemini to draft customized pitches based on Person 1's `category`, `recommendedTier`, `recommendedAsk`, and `whyGoodSponsor`.
  * Implement `POST /emails/regenerate` for alternative drafts.
  * Implement `POST /emails/edit` to record organizer edits as new versions.
  * Implement `GET /emails/:id` and `GET /emails/pending-approval`.
* **Agreed Contract:**
  * Drafts must default to status `PENDING_APPROVAL`. No email leaves this module.

### 4. Person 4: Gmail Integration, Approval & Frontend (To Be Added)
*Make approval the only door to Gmail, then wire everything together.*

* **Responsibilities:**
  * Human approval endpoints: `POST /emails/:id/approve` and `POST /emails/:id/reject`.
  * Gmail integration: `POST /gmail/send` with **Send Guard** (blocks any email whose status is not `APPROVED`).
  * Reply detection: Check incoming replies and forward events to Person 3 via `POST /outreach/webhook`.
  * Build the minimal demo frontend (5 screens: Dashboard, Sponsors table, Approval Queue, CRM table, Detail modal).

---

## 🧪 Testing & Verification Guide

### 1. Run Automated Logic Tests (Person 3)
Verifies status enums, follow-up progression, the 3rd follow-up spam block, and status transitions:
```bash
cd backend
node src/scripts/testOutreachLogic.js
```

### 2. Seed Clean Demo Data
Populates MongoDB with 3 organizers and 5 realistic outreach scenarios across all lifecycle stages:
```bash
cd backend
npm run seed:outreach
```
*Creates: GitHub (Waiting for reply), Cloudflare (Due for follow-up now), Red Bull (Meeting booked), HDFC Bank (Declined), Notion (Closed after 2 follow-ups).*

### 3. Postman Collection
Import the pre-configured Postman collection directly:
* **File:** [`backend/SponsyBot_Person3_Postman_Collection.json`](file:///Users/hetsavani/Documents/Projects/SponcyBot/backend/SponsyBot_Person3_Postman_Collection.json)
* Contains all 10 requests pre-configured with headers, URLs, and sample request bodies.

---

## ⚙️ Installation & Setup

1. **Clone & Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables (`backend/.env`):**
   ```env
   MONGODB_URI=your_mongodb_connection_string
   TAVILY_API_KEY=your_tavily_api_key
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-3.8-flash
   ```

3. **Start the Backend Server:**
   ```bash
   npm start
   # Server runs on http://localhost:5000
   ```

---

## 📋 Hackathon Compliance Checklist

- [x] **Backend-heavy:** Core business logic, scoring, and follow-up engines live in backend
- [x] **Sponsor Prioritisation:** Person 1 6-factor score + leaderboard ranking (`GET /companies/rank`)
- [x] **Sponsor Categorisation:** 13 industry categories with fallback sanitization
- [x] **Institutional Memory:** `sponsorshipHistory` schema to persist past sponsor data
- [x] **Duplicate Outreach Prevention:** Case-insensitive validation stops duplicate outreach
- [x] **Outreach Tracking:** Full CRM with owner assignment and chronological audit timeline
- [x] **Strict 2 Follow-Ups Limit:** Hard-coded block and auto-close on 3rd follow-up attempt
- [x] **Free APIs Only:** Tavily (search), Google Gemini `gemini-3.8-flash` (free tier), MongoDB Atlas
- [ ] **AI Email Personalisation:** Person 2 implementation in progress
- [ ] **Human Approval & Gmail Send Guard:** Person 4 implementation in progress
- [ ] **Demo Frontend Layer:** Person 4 implementation in progress