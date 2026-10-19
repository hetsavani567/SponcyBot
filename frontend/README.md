# SponcyBot — Modern React Frontend

Interactive, reactive dashboard for SponcyBot: AI-powered sponsor research, Human-in-the-Loop Send Guard approval queue, Outreach CRM, and live Gmail thread explorer. Built with **React 18**, **Vite**, and **Tailwind CSS**.

---

## 📁 Architecture & Component Hierarchy

```
frontend/
├── css/
│   └── styles.css                    # Global typography, sleek scrollbars & theme styles
├── dist/                             # Production-compiled assets served by backend Express
├── src/
│   ├── components/                   # Modular React UI Components
│   │   ├── modals/                   # Reusable Modal Dialogs
│   │   │   ├── AddMemberModal.jsx    # Add organizer/team member dialog
│   │   │   ├── AddSponsorModal.jsx   # Add new sponsor company dialog
│   │   │   ├── AssignOutreachModal.jsx # Assign sponsor to member (with 409 duplicate guard)
│   │   │   ├── DemoSimulationModal.jsx # 12-Step autonomous workflow simulation runner
│   │   │   ├── GmailModal.jsx        # OAuth 2.0 & 1-Click demo connection hub
│   │   │   ├── OutreachTimelineModal.jsx # Full chronological audit trail modal
│   │   │   └── SimulateReplyModal.jsx # Test AI sentiment analysis & outcome confirmation
│   │   ├── ApprovalTab.jsx           # Screen 3: Email Reviewer, Version Diffs & Send Guard
│   │   ├── BackendBanner.jsx         # Connection alert banner for backend status
│   │   ├── DashboardTab.jsx          # Screen 1: 6 Metric overview cards & quick actions
│   │   ├── DetailsTab.jsx            # Screen 5: Sponsor deep dive, 6-factor scores & Gmail thread
│   │   ├── Navbar.jsx                # Header, navigation tabs, Gmail badge & 12-step demo trigger
│   │   ├── OutreachTab.jsx           # Screen 4: Outreach CRM table (enforcing strict max 2 follow-ups)
│   │   ├── SponsorsTab.jsx           # Screen 2: Sponsor leaderboard, category chips & actions
│   │   └── Toast.jsx                 # Animated status notifications
│   ├── services/
│   │   └── api.js                    # Centralized API service with resilient safeFetchJson
│   ├── App.jsx                       # Master React orchestrator & state manager
│   └── main.jsx                      # React 18 entry point mounting to #root
├── index.html                        # HTML5 shell loading Tailwind CSS & Google Fonts
├── package.json                      # Frontend dependencies & build scripts
├── vite.config.js                    # Vite bundler config with backend proxying to :5000
└── README.md                         # Frontend documentation
```

---

## ⚡ Development & Build Scripts

### 1. Developer Mode (with Hot Module Replacement)
Run the Vite development server with real-time HMR:
```bash
npm run dev
# Opens Vite dev server on http://localhost:3000
# Proxies all API requests (/companies, /emails, /gmail, /outreach, /team-members) to backend :5000
```

### 2. Production Build
Compile and bundle the React application into optimized assets:
```bash
npm run build
# Outputs compiled bundle to frontend/dist/
```

### 3. Production Serving
When you run the backend server (`npm start` from root or `backend`), Express automatically detects `frontend/dist/` and serves the compiled React application directly on `http://localhost:5000`.

---

## 🛡️ Key Features

- **Strict Human-in-the-Loop Send Guard:** Blocks drafts and pending emails from dispatching until explicitly approved by a human reviewer.
- **Max 2 Follow-Ups Limit:** UI badges visually warn organizers and disable follow-up actions once the strict 2 follow-up cap is reached.
- **AI Sentiment Classification:** Interactive modal lets organizers simulate sponsor replies (Interested, Declined, Out of Office) and confirm AI intent classifications.
- **12-Step Lifecycle Simulation:** One-click automated walkthrough running through all stages from research to reply confirmation.
