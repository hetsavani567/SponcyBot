import React from 'react';

export default function Navbar({
  currentTab,
  onSwitchTab,
  pendingApprovalsCount = 0,
  gmailStatus = {},
  user = null,
  onOpenAuthModal,
  onSignOut,
  onOpenGmailModal,
  onOpenDemoModal
}) {
  const isGmailConnected = Boolean(gmailStatus?.authorized);
  const email = gmailStatus?.email || (user?.email || 'sponsorships@hackathon.club');

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'sponsors', label: '🏢 Sponsors' },
    {
      id: 'approval',
      label: '🛡️ Approval Queue',
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
    },
    { id: 'outreach', label: '📈 Outreach CRM' },
    { id: 'details', label: '💬 Thread & Details' }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand & Subtitle */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white">SponcyBot</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold uppercase tracking-wider">
                v1.0 · AI Outreach
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Human-in-the-Loop Sponsor Outreach · ACM Hackathon
            </p>
          </div>
        </div>

        {/* Center Nav Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
          {tabs.map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSwitchTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded-full font-bold border border-amber-500/40 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Mailbox Status Pill */}
          <div
            onClick={onOpenGmailModal}
            className="hidden lg:flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-800 transition shadow-sm"
            title="Click to configure Gmail OAuth or Demo Sender Account"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isGmailConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
              }`}
            />
            <span className="truncate max-w-[130px] font-mono text-[11px]">
              {isGmailConnected ? '✉️ Gmail' : '⚡ Demo'}: {email}
            </span>
          </div>

          {/* User Authentication Pill / Sign In Button */}
          {user ? (
            <div className="flex items-center space-x-2 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs font-bold">
                {(user.name || user.username || 'U')[0].toUpperCase()}
              </div>
              <div className="text-left hidden xl:block leading-tight">
                <div className="text-xs font-semibold text-white truncate max-w-[100px]">
                  {user.name || user.username}
                </div>
                <div className="text-[10px] text-emerald-400 truncate max-w-[100px]">
                  {user.role || 'Organizer'}
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out of SponcyBot"
                className="ml-1 text-[11px] text-slate-400 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-semibold transition shadow-sm"
            >
              <span>🔐</span>
              <span className="hidden sm:inline">Sign In / Sign Up</span>
              <span className="sm:hidden">Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="md:hidden flex items-center overflow-x-auto border-t border-slate-800 px-3 py-2 space-x-1.5 bg-slate-950 no-scrollbar">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSwitchTab(tab.id)}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition ${
                isActive
                  ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label} {tab.badge ? `(${tab.badge})` : ''}
            </button>
          );
        })}
      </div>
    </header>
  );
}
