# Sponsy Bot - Hackathon Development Plan
**Track 2 | 4-Person Hackathon | Backend-Heavy | Human-in-the-loop | Free APIs only | 20-40 emails/day**

## Project Overview
**What Sponsy Bot does:** Automates sponsor outreach end-to-end. A human approves every important step.

**Features:**
*   **Prioritise & categorise** sponsors so the team targets best-fit companies first.
*   **Pick whom to approach and what to ask** (money, goodies, or infrastructure) from company history.
*   **Personalise every email** using company research.
*   **Track emails, follow-ups, and owners** (who contacted which company).
*   **Max 2 follow-ups**, then stop. Nothing is sent without human approval.

### The Golden Rule
**AI generates the email -> Human reviews -> Human approves -> Gmail sends it**
*No email leaves the system unless its status is APPROVED. Follow-ups obey the same rule.*

---

## Complete Workflow
1. Research Company
2. Prioritise Sponsor
3. Pick Tier & Ask
4. Generate Personalised Email
5. Human Approval *(edit/rewrite loop: reject sends it back to Writer)*
6. Send via Gmail
7. Check Reply
8. Outcome Detected:
    *   **Interested:** Book virtual meeting
    *   **No Reply:** Follow-up (max 2, then stop)
    *   **Declined:** Mark closed

**Suggested Stack:** LangGraph, Tavily, Apollo/Hunter, Gemini/Grok (free alternatives allowed).

---

## System Architecture
**One backend, four owned modules.** Frontend is only a thin demo layer. All logic lives in the backend. Everything is internal to one module — nobody waits on anybody.

### Integration Points (Only 4 Hand-offs)
1. **P1 -> P2 (Company / Sponsor Data):** Research, score, category, recommendedTier, recommendedAsk.
2. **P2 -> P4 (Generated Email):** Email ID + subject/body, status `PENDING_APPROVAL`.
3. **P4 -> P3 (Sent Email / Reply):** Events: sent `{emailId, threadId}`, reply `{threadId, label}`.
4. **P3 -> UI (Outreach Status):** Dashboard reads status, followUpCount, nextFollowUpAt.

---

## Team Division

### PERSON 1: Sponsor Intelligence & Research Engine
*Turn a company name into a ranked sponsor with a recommended tier and ask.*

*   **Responsibilities:**
    *   Company/sponsor database (CRUD)
    *   Research each company with Tavily (or free search API)
    *   Categorise sponsors (industry/type)
    *   Score and rank sponsors so best fits come first
    *   Recommend sponsor tier & ask (money, goodies, infrastructure)
    *   Store previous sponsorship/history info
    *   AI-assisted company analysis (Gemini/Grok free tier)
    *   *Optional:* find contacts (Apollo/Hunter); manual entry as fallback
*   **APIs Owned:**
    *   `POST /companies` (Add a sponsor company)
    *   `GET /companies` (List/filter companies)
    *   `GET /companies/:id` (Full details + research + tier + ask)
    *   `POST /companies/research` (Run research, score, categorize)
    *   `GET /companies/rank` (Ranked list for team)
*   **Database Entities:** Company (shared), Research Note, Sponsorship History
*   **Dependencies:** Needs nothing to start (standalone). Gives Company data to P2 and dashboard.

### PERSON 2: AI Email & Personalisation Engine
*Write a personalised email for every sponsor and never send it.*

*   **Responsibilities:**
    *   Generate personalised sponsor emails & subject lines
    *   Use company research and recommended tier/ask
    *   Regenerate on request; allow edits before approval
    *   Maintain email versions
    *   Same engine writes follow-up 1 and 2 drafts
*   **APIs Owned:**
    *   `POST /emails/generate` (Create draft from companyId)
    *   `POST /emails/regenerate` (New version, same company)
    *   `POST /emails/edit` (Save a human edit as new version)
    *   `GET /emails/:id` (Email + all versions + status)
*   **Database Entities:** Email (shared), Email Version (body history), PromptTemplate
*   **Dependencies:** Needs Company fields from P1 (use mock JSON until ready). Gives Email ID to P4 for approval.

### PERSON 3: Outreach CRM & Follow-up Engine
*Always know who contacted whom, what happened, and when to follow up or stop.*

*   **Responsibilities:**
    *   Track every sponsor outreach, owners, sent emails, and replies
    *   Track follow-up count & calculate next follow-up date
    *   Prevent excessive follow-ups (auto-stop after 2)
    *   Track states: interested, declined, no-response, meeting
    *   Keep complete outreach history
*   **APIs Owned:**
    *   `GET /outreach` (All outreach + status)
    *   `GET /outreach/:id` (One outreach + timeline)
    *   `POST /outreach/:id/followup` (Register follow-up, blocked after 2)
    *   `POST /outreach/:id/close` (Close with reason)
    *   `GET /outreach/pending-followups` (Follow-ups due now)
    *   `GET /outreach/history` (Full comms history)
*   **Database Entities:** Outreach (shared), OutreachEvent, TeamMember
*   **Dependencies:** Needs emailId from P2, sent/reply events from P4 (simulate with seed script). Gives Outreach status to dashboard.

### PERSON 4: Gmail Integration, Human Approval & System Integration
*Make approval the only door to Gmail, then wire everything together.*

*   **Responsibilities:**
    *   Gmail integration (OAuth, send, read)
    *   Send **only** approved emails; Check replies & associate threads
    *   Human approval workflow (approve/reject)
    *   Final backend integration: connect P1, P2, P3 modules
    *   Orchestrate the workflow (LangGraph suggested)
    *   Suggest reply label for human confirmation
    *   Build the minimal frontend for the demo
*   **APIs Owned:**
    *   `POST /gmail/send` (Send APPROVED email only)
    *   `GET /gmail/messages` (Fetch new replies)
    *   `GET /gmail/thread/:id` (Thread for one sponsor)
    *   `POST /emails/:id/approve` (Human approves)
    *   `POST /emails/:id/reject` (Human rejects -> rewrite)
*   **Database Entities:** ApprovalLog, Gmail Thread
*   **Dependencies:** Needs Email records from P2 (mock one), outreach update from P3 (stub). Gives sent/reply events to P3.

---

## Shared Data Models
*Agree schemas and API contracts once. After that, nobody waits for anybody.*

### 1. Company (Owner: P1)
*   `id`: uuid
*   `name`: string
*   `website`: string
*   `industry`: string
*   `research`: json / text
*   `score`: number
*   `category`: string
*   `recommendedTier`: string
*   `recommendedAsk`: enum (money | goodies | infra)

### 2. Email (Owner: P2)
*   `id`: uuid
*   `companyId`: Company.id
*   `subject`: string
*   `createdAt`: datetime
*   `body`: text
*   `status`: enum
*   `version`: int

### 3. Outreach (Owner: P3)
*   `id`: uuid
*   `companyId`: Company.id
*   `emailId`: Email.id
*   `memberId`: TeamMember
*   `status`: enum
*   `followUpCount`: int (max 2)
*   `nextFollowUpAt`: datetime
*   `lastReplyAt`: datetime

### Agreed Status Values
*   **Email.status:** `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SENT`
*   **Outreach.status:** `DRAFT`, `APPROVED`, `SENT`, `WAITING FOR REPLY`, `INTERESTED`, `MEETING`, `DECLINED`, `NO REPLY`, `FOLLOW-UP 1`, `FOLLOW-UP 2`, `CLOSED`

---

## Development Phases
1. **Phase 1: Foundations (All 4):** Agree database schemas & API contracts. Set up repo, skeleton, API keys.
2. **Phase 2: Parallel Build (Independent):** Build modules using mocks/seeds.
3. **Phase 3: Integrate (P4 Leads):** Replace mocks with real calls. Orchestration wiring. Connect UI to APIs.
4. **Phase 4: Gmail + Approval Testing (P4 + All):** Test inbox. Prove send guard (APPROVED only). Reject/rewrite loop.
5. **Phase 5: End-to-End Testing (All 4):** Full flow on companies. Verify max 2 follow-ups. Dry run 20-40 emails/day.
6. **Phase 6: Demo Preparation (All 4):** Seed clean demo data, write script, finalize README.

---

## End-to-End Demo Flow
1. **P1:** Add a company (`POST /companies`)
2. **P1:** Research company (`POST /companies/research`) -> Score (`82/100`), Category (`Cloud & dev tools`)
3. **P1:** Recommended tier (`Gold`) & Ask (`cloud credits + prize money`)
4. **P2:** AI generates personalised email (`POST /emails/generate` -> `PENDING_APPROVAL`)
5. **P2:** Human edits / approves (`POST /emails/edit`, `POST /emails/:id/approve`)
6. **P4:** Gmail sends email (`POST /gmail/send` - APPROVED only)
7. **P4:** Reply is detected (`GET /gmail/messages`, thread linked)
8. **P3:** Status marked (Interested -> meeting, No reply, Declined -> closed)
9. **P3/P2/P4:** Follow-up when required (Scheduler flags -> P2 drafts -> Human approves -> sent)
10. **P3:** Stops after max 2 follow-ups (Third attempt blocked -> `CLOSED`)

---

## Minimal Frontend Architecture (Built by P4)
*Just enough UI to prove the backend. Plain tables and buttons - no design effort.*

1. **Dashboard:** Counts by status, pending approvals, follow-ups due (`GET /outreach`)
2. **Sponsors:** Ranked list, add company, run research (`GET /companies/rank`)
3. **Approval Queue:** Read, edit, approve, or reject drafts (`/emails/:id/approve`)
4. **Outreach / Follow-ups:** Status, contact owner, history, pending follow-ups (`GET /outreach/pending-followups`)
5. **Sponsor Details:** Research, tier, ask, email versions, timeline (`GET /companies/:id`)

---

## Hackathon Compliance Checklist
- [x] **Backend-heavy:** 4 backend modules; frontend demo only
- [x] **Sponsor prioritisation:** P1 score + rank endpoint
- [x] **Human approval before sending:** Send guard (only APPROVED go out)
- [x] **Sponsor categorisation:** P1 categorisation service
- [x] **Personalised emails:** P2 uses research, tier, and ask
- [x] **Follow-up automation:** P3 scheduler flags -> human approves
- [x] **Gmail integration:** P4 Gmail service (send + replies)
- [x] **20-40 emails/day target:** Queue + cached research
- [x] **Modular 4-person development:** Contract-first, mocks, 4 owners
- [x] **Outreach tracking:** P3 model + history, with member owner
- [x] **Maximum 2 follow-ups:** P3 rule blocks 3rd, then CLOSED
- [x] **Free APIs only:** Tavily, Gemini/Grok free tier, Gmail API
- [x] **Minimal frontend:** 5 simple screens by P4