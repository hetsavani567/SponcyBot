import React from 'react';

export default function DashboardTab({ stats, onRefresh, onSwitchTab, onOpenGmailModal, onOpenAddSponsorModal, onOpenDemoModal }) {
  const sponsorsCount = stats?.sponsors?.total ?? 0;
  const pendingApprovals = stats?.emails?.pendingApproval ?? 0;
  const emailsSent = stats?.emails?.totalSent ?? 0;
  const totalOutreach = stats?.outreach?.totalOutreach ?? 0;
  const followUpsDue = stats?.outreach?.pendingFollowUpsDue ?? 0;
  const meetingsCount = stats?.outreach?.conversionsCount ?? 0;

  return (
    <section className="space-y-6">
      {/* Welcome & Golden Rule Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>SponsyBot Overview</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
              Active React Engine
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            <strong className="text-slate-300">Golden Rule:</strong> AI generates draft &rarr; Human reviews &rarr; Human approves &rarr; Verified Mailer sends it.{' '}
            <span className="text-emerald-400">Send Guard prevents any unapproved sends.</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            🔄 Refresh Stats
          </button>
          <button
            onClick={onOpenGmailModal}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition shadow-sm flex items-center space-x-1.5"
          >
            <span>✉️ Mailbox Settings</span>
          </button>
        </div>
      </div>

      {/* 6 Key System Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div
          onClick={() => onSwitchTab('sponsors')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Target Sponsors</span>
            <span className="text-lg">🏢</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">{sponsorsCount}</div>
          <p className="text-[11px] text-slate-500">6-factor scored & tier ranked</p>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => onSwitchTab('approval')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Approvals</span>
            <span className="text-lg">🛡️</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{pendingApprovals}</div>
          <p className="text-[11px] text-slate-500">Locked behind Send Guard</p>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => onSwitchTab('approval')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Emails Dispatched</span>
            <span className="text-lg">🚀</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{emailsSent}</div>
          <p className="text-[11px] text-slate-500">Approved & sent via Gmail API</p>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => onSwitchTab('outreach')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Outreach Pipeline</span>
            <span className="text-lg">📈</span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">{totalOutreach}</div>
          <p className="text-[11px] text-slate-500">Assigned organizer CRM records</p>
        </div>

        {/* Metric 5 */}
        <div
          onClick={() => onSwitchTab('outreach')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Follow-Ups Due</span>
            <span className="text-lg">⏰</span>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">{followUpsDue}</div>
          <p className="text-[11px] text-slate-500">Strictly capped at max 2</p>
        </div>

        {/* Metric 6: Meetings, Response Rate & Pipeline Value */}
        <div
          onClick={() => onSwitchTab('outreach')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Meetings & Funds Secured</span>
            <span className="text-lg">🤝</span>
          </div>
          <div className="text-2xl font-bold font-mono text-teal-400 flex items-baseline space-x-2">
            <span>{meetingsCount}</span>
            <span className="text-sm font-normal text-slate-300">
              (₹{(stats?.outreach?.fundsSecuredINR || 0).toLocaleString('en-IN')})
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Response Rate: <strong className="text-emerald-400">{stats?.outreach?.responseRatePercent ?? 0}%</strong> · Converted: <strong className="text-teal-300">{stats?.outreach?.conversionRatePercent ?? 0}%</strong>
          </p>
        </div>
      </div>

      {/* Quick Launchpad Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h3 className="font-semibold text-white text-xs">1. Add & Score Sponsors</h3>
          <p className="text-[11px] text-slate-400">
            Research company using Tavily search and evaluate fit across 6 objective factors.
          </p>
          <button
            onClick={onOpenAddSponsorModal}
            className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-block"
          >
            + Add New Sponsor &rarr;
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h3 className="font-semibold text-white text-xs">2. Review AI Drafts</h3>
          <p className="text-[11px] text-slate-400">
            Inspect generated emails. Edit subjects and bodies with automatic version diffing.
          </p>
          <button
            onClick={() => onSwitchTab('approval')}
            className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium inline-block"
          >
            Open Approval Queue &rarr;
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h3 className="font-semibold text-white text-xs">3. CRM Follow-Up Rule</h3>
          <p className="text-[11px] text-slate-400">
            Never spam sponsors. Strict 2-follow-up limit automatically closes unresponsive tracks.
          </p>
          <button
            onClick={() => onSwitchTab('outreach')}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-medium inline-block"
          >
            Track in CRM &rarr;
          </button>
        </div>
      </div>

      {/* 12-Step Autonomous Lifecycle Simulation Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/20 shadow-lg shadow-emerald-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-2xl shrink-0 shadow-sm">
            ⚡
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white">12-Step Autonomous Sponsor Outreach Simulation</h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Interactive Demo
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Execute the complete end-to-end lifecycle: Company Intelligence ➔ 6-Factor Scoring ➔ Gemini AI Drafting ➔ Human Review ➔ Send Guard ➔ Gmail Dispatch ➔ AI Reply Classification ➔ Meeting Booking.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenDemoModal}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center space-x-2 transition shrink-0"
        >
          <span className="text-sm">⚡</span>
          <span className="tracking-tight text-xs font-bold uppercase">Run Demo Simulation</span>
        </button>
      </div>
    </section>
  );
}
