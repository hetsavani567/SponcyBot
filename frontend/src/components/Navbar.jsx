import React from 'react';

// Semantic SVG Icons for Structured Modern Navigation
function IconBolt({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h8l-2 8 11-13h-7l2-7z" />
    </svg>
  );
}

function IconDashboard({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconSponsors({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v8h4" />
      <path d="M18 9h2a2 2 0 0 1 2 2v11h-4" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}

function IconApproval({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconCRM({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-5 5" />
      <circle cx="19" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconDetails({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  );
}

function IconMail({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconGuide({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
    </svg>
  );
}

function IconSignOut({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconSignIn({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function Navbar({
  currentTab,
  onSwitchTab,
  pendingApprovalsCount = 0,
  gmailStatus = {},
  user = null,
  activeRole = 'Organizer',
  onOpenAuthModal,
  onOpenTutorial,
  onSignOut,
  onOpenGmailModal,
  onOpenDemoModal
}) {
  const isGmailConnected = Boolean(gmailStatus?.authorized);
  const email = gmailStatus?.email || (user?.email || 'sponsorships@hackathon.club');

  // Structured tab specifications with semantic SVGs
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'sponsors', label: 'Sponsors', icon: IconSponsors },
    {
      id: 'approval',
      label: 'Approval Queue',
      icon: IconApproval,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
    },
    { id: 'outreach', label: 'Outreach CRM', icon: IconCRM },
    { id: 'details', label: 'Thread & Details', icon: IconDetails }
  ];

  const userRoleDisplay = user?.role
    ? user.role.includes('Organizer')
      ? `👑 ${user.role}`
      : user.role.includes('Coordinator')
      ? `📋 ${user.role}`
      : `💼 ${user.role}`
    : activeRole.includes('Coordinator')
    ? `📋 ${activeRole}`
    : `👑 ${activeRole}`;

  return (
    <header className="border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 transition-all shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* ── ZONE 1: Brand & Organization Scope ───────────────────────────── */}
        <div 
          onClick={() => onSwitchTab('dashboard')} 
          className="flex items-center space-x-3 shrink-0 cursor-pointer group"
          title="Go to Dashboard"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600/30 via-emerald-500/20 to-teal-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-sm shadow-emerald-500/10 group-hover:scale-105 transition-transform">
            <IconBolt className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                SponcyBot
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider font-mono">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden xl:block font-medium">
              Human-in-the-Loop Sponsor Outreach · HackFest 2026
            </p>
          </div>
        </div>

        {/* ── ZONE 2: Primary Navigation Tabs (Segmented Control) ─────────── */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 shadow-inner">
          {tabs.map(tab => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSwitchTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center space-x-1.5 select-none ${
                  isActive
                    ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded-full font-bold border border-amber-500/40 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── ZONE 3: Structured User & Outreach Sender Mailbox Cluster ── */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {user ? (
            <div className="flex items-center space-x-3 bg-slate-950/90 border border-slate-800/90 hover:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm transition">
              {/* User Avatar */}
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                {(user.name || user.username || 'U')[0].toUpperCase()}
              </div>

              {/* Structured Stack: Username on top, Outreach Sender Mailbox directly below */}
              <div className="text-left leading-tight min-w-0">
                {/* 1. Username & Role Badge */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[150px]">
                    {user.name || user.username}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 shrink-0">
                    {userRoleDisplay}
                  </span>
                </div>

                {/* 2. Outreach Sender Mailbox (below Username) */}
                <button
                  type="button"
                  onClick={onOpenGmailModal}
                  title="Configure Outreach Sender Mailbox (Gmail OAuth or Demo Mode)"
                  className="flex items-center space-x-1.5 mt-0.5 text-[11px] text-slate-400 hover:text-emerald-300 transition group/mail text-left focus:outline-none"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isGmailConnected
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                        : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                    }`}
                  />
                  <IconMail className="w-3 h-3 text-slate-400 group-hover/mail:text-emerald-400 shrink-0 transition-colors" />
                  <span className="truncate max-w-[130px] sm:max-w-[160px] font-mono group-hover/mail:underline">
                    {isGmailConnected ? 'Gmail' : 'Demo'}: {email}
                  </span>
                </button>
              </div>

              {/* Separator & Sign Out */}
              <div className="h-6 w-px bg-slate-800/80 shrink-0" />
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out of SponcyBot"
                className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20 font-medium shrink-0"
              >
                <IconSignOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3 bg-slate-950/90 border border-slate-800/90 hover:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm transition">
              {/* Guest / Account Icon */}
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                👤
              </div>

              {/* Structured Stack: Username on top, Outreach Sender Mailbox directly below */}
              <div className="text-left leading-tight min-w-0">
                {/* 1. Username Display & Role */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-200">
                    Guest Organizer
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 shrink-0">
                    {userRoleDisplay}
                  </span>
                </div>

                {/* 2. Outreach Sender Mailbox (below Username) */}
                <button
                  type="button"
                  onClick={onOpenGmailModal}
                  title="Configure Outreach Sender Mailbox (Gmail OAuth or Demo Mode)"
                  className="flex items-center space-x-1.5 mt-0.5 text-[11px] text-slate-400 hover:text-emerald-300 transition group/mail text-left focus:outline-none"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isGmailConnected
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                        : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                    }`}
                  />
                  <IconMail className="w-3 h-3 text-slate-400 group-hover/mail:text-emerald-400 shrink-0 transition-colors" />
                  <span className="truncate max-w-[130px] sm:max-w-[160px] font-mono group-hover/mail:underline">
                    {isGmailConnected ? 'Gmail' : 'Demo'}: {email}
                  </span>
                </button>
              </div>

              {/* Separator & Sign In Button */}
              <div className="h-6 w-px bg-slate-800/80 shrink-0" />
              <button
                type="button"
                onClick={onOpenAuthModal}
                title="Sign in to SponcyBot"
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-semibold transition shrink-0"
              >
                <IconSignIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
                <span className="sm:hidden">Login</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Navigation Sub-Header ───────────────────────────────── */}
      <div className="md:hidden flex items-center overflow-x-auto border-t border-slate-800/90 px-3 py-2 space-x-1.5 bg-slate-950/95 no-scrollbar">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSwitchTab(tab.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition flex items-center space-x-1.5 ${
                isActive
                  ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-300 rounded-full font-bold border border-amber-500/40">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
