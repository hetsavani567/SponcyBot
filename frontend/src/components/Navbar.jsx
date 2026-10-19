import React from 'react';

export default function Navbar({
  currentTab,
  onSwitchTab,
  pendingApprovalsCount = 0,
  gmailStatus = {},
  onOpenGmailModal,
  onOpenDemoModal
}) {
  const isGmailConnected = gmailStatus?.authorized;
  const isDemo = gmailStatus?.isDemo;
  const email = gmailStatus?.email || 'sponsorships@hackathon.club';

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
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white">SponcyBot</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">React</span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Human-in-the-Loop Sponsor Outreach · ACM NIT Surat</p>
          </div>
        </div>

        {/* Center Nav Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
          {tabs.map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSwitchTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/40">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          {/* Gmail Status Pill */}
          <div
            onClick={onOpenGmailModal}
            className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer hover:border-emerald-500/50 transition shadow-sm"
            title="Click to manage Gmail Connection"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isGmailConnected
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="truncate max-w-[170px]">
              {isGmailConnected
                ? isDemo
                  ? `Connected: ${email} (Demo)`
                  : `Connected: ${email}`
                : 'Gmail Offline (Connect)'}
            </span>
          </div>

          {/* 12-Step Demo Button */}
          <button
            onClick={onOpenDemoModal}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs shadow-md shadow-emerald-500/10 flex items-center space-x-1.5 transition"
          >
            <span>⚡ Run 12-Step Demo</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="md:hidden flex overflow-x-auto border-t border-slate-800 px-4 py-2 space-x-2 bg-slate-950">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            className={`text-xs px-3 py-1 rounded whitespace-nowrap ${
              currentTab === tab.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            {tab.label} {tab.badge ? `(${tab.badge})` : ''}
          </button>
        ))}
      </div>
    </header>
  );
}
