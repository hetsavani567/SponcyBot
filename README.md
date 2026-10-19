# SponcyBot — Autonomous Sponsorship Outreach & CRM Platform
**Track 5 | Hackathon Project | Human-in-the-Loop | Free APIs Only**

SponcyBot automates hackathon sponsor outreach end-to-end. It replaces scattered spreadsheets, forgotten follow-ups, and generic mass emails with an intelligent, human-supervised outreach pipeline.

---

### 🛡️ The Golden Rule
> **AI generates the email ➔ Human reviews & edits ➔ Human approves ➔ Gmail sends it**
> 
> *No email leaves the system unless its status is `APPROVED`. Follow-ups obey the exact same rule. Maximum 2 follow-ups per sponsor—spamming is strictly blocked by the Outreach state machine.*

---

## 📁 Clean Architecture & Folder Structure

The project is structured into decoupled, modular **Frontend** (React 18 + Vite) and **Backend** (Node.js + Express + MongoDB) directories:

```
SponcyBot/
├── frontend/                         # Modern React 18 + Vite Web Client
│   ├── css/
│   │   └── styles.css                # Dark-mode styling, typography & scrollbars
│   ├── dist/                         # Optimized production bundle (served by backend)
│   ├── src/
│   │   ├── components/               # Modular UI Components
│   │   │   ├── modals/               # Reusable Modal Dialogs
│   │   │   │   ├── AddMemberModal.jsx
│   │   │   │   ├── AddSponsorModal.jsx
│   │   │   │   ├── AssignOutreachModal.jsx
│   │   │   │   ├── DemoSimulationModal.jsx
│   │   │   │   ├── GmailModal.jsx
│   │   │   │   ├── OutreachTimelineModal.jsx
│   │   │   │   └── SimulateReplyModal.jsx
│   │   │   ├── ApprovalTab.jsx       # Screen 3: Email Reviewer & Send Guard
│   │   │   ├── BackendBanner.jsx     # Connection alert banner
│   │   │   ├── DashboardTab.jsx      # Screen 1: 6 Metric cards & overview
│   │   │   ├── DetailsTab.jsx        # Screen 5: Sponsor deep dive & Gmail thread
│   │   │   ├── Navbar.jsx            # Header, tab navigation & Gmail status
│   │   │   ├── OutreachTab.jsx       # Screen 4: Outreach CRM (max 2 follow-ups)
│   │   │   ├── SponsorsTab.jsx       # Screen 2: Sponsor Leaderboard & actions
│   │   │   └── Toast.jsx             # Animated status notifications
│   │   ├── services/
│   │   │   └── api.js                # Centralized API service & safe JSON client
│   │   ├── App.jsx                   # Master component orchestrating reactive state
│   │   └── main.jsx                  # React entry point mounting to #root
│   ├── index.html                    # HTML shell (Tailwind CSS CDN + Inter fonts)
│   ├── package.json                  # React 18 & Vite configuration
│   ├── vite.config.js                # Dev server config & backend API proxy (:5000)
│   └── README.md                     # Frontend documentation
│
├── backend/                          # Node.js, Express & MongoDB Backend
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # Mongoose connection & resilience config
│   │   ├── controllers/              # REST Controller handlers
│   │   │   ├── companyController.js
│   │   │   ├── emailController.js
│   │   │   ├── gmailController.js
│   │   │   ├── llmController.js
│   │   │   ├── outreachController.js
│   │   │   └── teamMemberController.js
│   │   ├── lib/
│   │   │   └── aiClient.js           # Multi-model Gemini fallback client
│   │   ├── middleware/               # Express Middlewares
│   │   │   ├── errorHandler.js       # Centralized JSON 404 & error handler
│   │   │   └── sendGuard.js          # Send Guard: strictly blocks unapproved sends
│   │   ├── models/                   # Mongoose schemas & data models
│   │   │   ├── approvalLog.js
│   │   │   ├── company.js
│   │   │   ├── email.js
│   │   │   ├── emailVersion.js
│   │   │   ├── gmailThread.js
│   │   │   ├── gmailToken.js
│   │   │   ├── outreach.js
│   │   │   ├── outreachEvent.js
│   │   │   └── teamMember.js
│   │   ├── routes/                   # Express API routers
│   │   ├── scripts/                  # Automated logic tests & database seeders
│   │   ├── services/                 # Business logic, CRM & Gmail services
│   │   └── server.js                 # Express bootstrap & static frontend serving
│   ├── .env.example                  # Environment variables template
│   ├── package.json                  # Backend dependencies & npm scripts
│   └── README.md                     # Backend documentation
│
├── postman/                          # API Testing & Verification
│   └── SponsyBot_Outreach_Postman_Collection.json
│
├── package.json                      # Monorepo runner scripts
├── vercel.json                       # Zero-config cloud deployment config
├── .gitignore                        # Standard repository exclusions
└── README.md                         # Main repository documentation
```

---

## 🚦 System Modules

| Module | Role | Status | Description |
|---|---|---|---|
| **Sponsor Intelligence** | Research & Ranking | 🟢 **COMPLETED** | Company CRUD, duplicate prevention, Tavily web search, Gemini `gemini-2.5-flash` scoring (6-factor breakdown), tier & ask recommendations, and leaderboard ranking. |
| **Outreach CRM** | Pipeline & Follow-up Engine | 🟢 **COMPLETED** | Pipeline tracking, team owner assignments, timeline event audit log (`OutreachEvent`), **strict max 2 follow-ups block**, overdue follow-up detection, and pipeline analytics. |
| **AI Email Engine** | Personalisation & Versioning | 🟢 **COMPLETED** | AI email proposal drafting, prompt angle templates, AI regeneration, human edit versioning (`models/email.js`, `/emails/*`). |
| **Gmail & Approval** | Approval Gatekeeper & Gmail API | 🟢 **COMPLETED** | Human approval gatekeeper (`/emails/:id/approve`), Gmail Send Guard (`/gmail/send`), reply detection webhook, and modern React 18 dashboard. |

---

## ⚡ Step-by-Step Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **MongoDB**: A free MongoDB Atlas cluster connection URI or local MongoDB instance (`mongodb://localhost:27017/sponcybot`)
- **Google Gemini API Key**: Free API key from [Google AI Studio](https://aistudio.google.com/)
- *(Optional)* **Tavily API Key**: Free key from [Tavily AI](https://tavily.com/) for live sponsor web search
- *(Optional)* **Google Cloud OAuth Credentials**: For live Gmail sending (demo simulation mode works 100% offline with zero setup)

---

### Step 1: Clone the Repository & Install Dependencies

From the project root directory, install dependencies for the root, backend, and frontend with a single command:

```bash
# 1. Install all dependencies across root, backend, and frontend:
npm run install:all
```

Or install individually:
```bash
# Backend dependencies:
cd backend && npm install

# Frontend dependencies:
cd ../frontend && npm install
cd ..
```

---

### Step 2: Configure Environment Variables

Create your `.env` file in the `backend/` directory from the provided example:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your keys:

```env
# Server Port
PORT=5000

# MongoDB Connection String (Atlas or Local)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/sponcybot?retryWrites=true&w=majority

# Google Gemini API Key (Required for AI Research, Scoring & Drafting)
GEMINI_API_KEY=your_gemini_api_key_here

# Tavily Search API Key (Optional - enables live web research)
TAVILY_API_KEY=your_tavily_api_key_here

# Gmail OAuth 2.0 Credentials (Optional - 1-Click Demo mode available in UI)
GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:5000/gmail/oauth/callback
```

---

### Step 3: Build & Launch the Application

You can run SponcyBot in either **Unified Fullstack Mode** or **Two-Process Development Mode**:

#### Method A: Unified Fullstack Mode (Recommended)
Builds the React frontend and serves everything (API + UI) from the single Express server on port 5000:

```bash
# 1. Build the React frontend:
npm run build

# 2. Start the unified server:
npm start
```
Now open your browser and navigate to:
👉 **`http://localhost:5000`**

#### Method B: Two-Process Development Mode (Fast HMR)
Run backend and frontend concurrently for hot module replacement during development:

```bash
# Terminal 1: Start Backend (Port 5000)
npm run dev:backend

# Terminal 2: Start Frontend Vite Dev Server (Port 3000)
npm run dev:frontend
```
Open your browser at:
👉 **`http://localhost:3000`** *(all API calls automatically proxy to `:5000`)*

---

## 🧪 Testing & Verification Guide

### 1. Run Automated Logic Tests
Verifies outreach state machine rules, follow-up progression, the 3rd follow-up spam block, and status transitions:
```bash
npm test
```
*Output: `All tests passed! State machine and follow-up limits strictly enforced.`*

### 2. Seed Realistic Demo Data
Populates the database with 3 organizers and 5 realistic outreach scenarios across all lifecycle stages:
```bash
npm run seed:outreach
```
*Creates: GitHub (Waiting for reply), Cloudflare (Due for follow-up now), Red Bull (Meeting booked), HDFC Bank (Declined), Notion (Closed after 2 follow-ups).*

### 3. Clear Database
Reset all database collections to start completely fresh:
```bash
npm run db:clear
```

### 4. Postman Collection
Import the pre-configured Postman collection directly:
- **File:** [`postman/SponsyBot_Outreach_Postman_Collection.json`](file:///Users/hetsavani/Documents/Projects/SponcyBot/postman/SponsyBot_Outreach_Postman_Collection.json)
- Contains all 10 core API requests pre-configured with headers, URLs, and sample request bodies.

---

## ⚡ 12-Step Autonomous Simulation Walkthrough

To see the complete end-to-end sponsorship workflow in action:
1. Open the dashboard at `http://localhost:5000`.
2. Click the **"⚡ Run 12-Step Demo"** button in the top navbar.
3. Watch SponcyBot execute all 12 stages in real-time:
   - **Step 1:** Add company to database
   - **Step 2:** Deep AI research (Tavily search + company website analysis)
   - **Step 3:** 6-factor score calculation (max 100) & tier assignment
   - **Step 4:** Recommended ask generation (cash, cloud credits, swag)
   - **Step 5:** Leaderboard rank calculation
   - **Step 6:** AI proposal email draft generation (`v1`)
   - **Step 7:** Human review & edit simulation (`v2`)
   - **Step 8:** Human approval gatekeeper (Send Guard unlocked)
   - **Step 9:** Outbound email dispatch via Gmail API
   - **Step 10:** CRM outreach record created & owner assigned
   - **Step 11:** Inbound reply simulation & AI sentiment classification
   - **Step 12:** Human confirms outcome (`INTERESTED`) & meeting scheduled

---

## 💎 Code Quality & Coding Conventions

SponcyBot follows strict software engineering and coding standards:

1. **Modular React JSX Components:** Each screen and modal is an independent, self-contained component in `frontend/src/components/`.
2. **Standard React Hooks:** Clean functional architecture using `useState`, `useEffect`, and `useCallback` for reactive state management without DOM mutations.
3. **Resilient Centralized API Layer:** `frontend/src/services/api.js` encapsulates all network requests with `safeFetchJson`, handling network disconnects, server startup states, and JSON parse safety.
4. **Human-in-the-Loop Send Guard Middleware:** Backend gatekeeper in `backend/src/middleware/sendGuard.js` strictly halts any outbound email that is not marked `APPROVED`.
5. **Strict Follow-up Enforcement:** Outreach controller guarantees that `followUpCount` never exceeds 2, auto-closing the outreach on the 3rd attempt to prevent sponsor spam.
6. **Centralized Error Handling:** All backend routes route through `backend/src/middleware/errorHandler.js`, guaranteeing consistent, informative JSON responses.

---

## 📋 Hackathon Compliance Checklist

- [x] **Backend-heavy:** Core business logic, scoring, and follow-up engines live in backend
- [x] **Sponsor Prioritisation:** 6-factor score + leaderboard ranking (`GET /companies/rank`)
- [x] **Sponsor Categorisation:** 13 industry categories with fallback sanitization
- [x] **Institutional Memory:** `sponsorshipHistory` schema to persist past sponsor data
- [x] **Duplicate Outreach Prevention:** Case-insensitive validation stops duplicate outreach
- [x] **Outreach Tracking:** Full CRM with owner assignment and chronological audit timeline
- [x] **Strict 2 Follow-Ups Limit:** Hard-coded block and auto-close on 3rd follow-up attempt
- [x] **Free APIs Only:** Tavily (search), Google Gemini `gemini-2.5-flash` (free tier), MongoDB Atlas
- [x] **AI Email Personalisation:** Gemini draft generation and multi-version tracking
- [x] **Human Approval & Gmail Send Guard:** Strict Send Guard gating email dispatch
- [x] **Modern React 18 Frontend:** Clean, modular `.jsx` single-page dashboard with Vite