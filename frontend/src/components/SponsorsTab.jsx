import React, { useState } from 'react';

export default function SponsorsTab({
  companies = [],
  loading,
  onOpenAddModal,
  onResearch,
  onGenerateDraft,
  onAssign,
  onInspect,
  onDelete
}) {
  const [filterCategory, setFilterCategory] = useState('All');

  const categories = ['All', 'Technology', 'Cloud & Developer Tools', 'AI & Data', 'Finance', 'Education', 'Other'];

  const filtered = filterCategory === 'All'
    ? companies
    : companies.filter(c => (c.category || c.industry || 'Other').toLowerCase() === filterCategory.toLowerCase());

  const tierBadgeColor = (tier) => ({
    Platinum: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    Gold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    Silver: 'bg-slate-400/10 text-slate-300 border-slate-500/30',
    Bronze: 'bg-orange-500/10 text-orange-300 border-orange-500/30'
  }[tier] || 'bg-slate-800 text-slate-400 border-slate-700');

  const askIcon = (ask) => ({
    money: '💰 Cash',
    goodies: '🎁 Swag/Prizes',
    infra: '☁️ Cloud Credits'
  }[ask] || (ask || 'General'));

  return (
    <section className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>Sponsor Intelligence & Leaderboard</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              {companies.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Objective 6-factor score evaluated by Tavily search + Gemini LLM synthesis.
          </p>
        </div>
        <button
          onClick={onOpenAddModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <span>+ Add Sponsor Company</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] whitespace-nowrap">Filter:</span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2.5 py-1 rounded-lg border text-xs transition whitespace-nowrap ${
              filterCategory === cat
                ? 'bg-slate-800 text-white border-slate-600 font-medium'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sponsor Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Fit Score</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Ask</th>
                <th className="py-3 px-4">Point of Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    Loading sponsors...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-500">
                    No sponsors found. Click "+ Add Sponsor Company" above!
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  const compId = c._id || c.id;
                  const score = c.score || 0;

                  return (
                    <tr key={compId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-500 font-mono text-[10px]">#{idx + 1}</span>
                          <span className="font-semibold">{c.name || c.company}</span>
                        </div>
                        {c.website && (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-slate-500 hover:text-slate-300 underline block mt-0.5"
                          >
                            {c.website}
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{c.category || c.industry || 'Technology'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold ${
                            score >= 75 ? 'text-emerald-400' : score >= 60 ? 'text-blue-400' : 'text-slate-300'
                          }`}
                        >
                          {score}/100
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${tierBadgeColor(c.recommendedTier)}`}>
                          {c.recommendedTier || 'Bronze'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{askIcon(c.recommendedAsk)}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {c.contactName && <span className="text-slate-300 font-medium">{c.contactName}<br /></span>}
                        <span className="text-slate-500">{c.contactEmail || 'No email registered'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onResearch(compId, c.name)}
                            title="Research company using Tavily + Gemini"
                            className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded border border-purple-500/30 transition text-[11px] flex items-center space-x-1"
                          >
                            <span>🔍 AI Research</span>
                          </button>
                          <button
                            onClick={() => onGenerateDraft(compId)}
                            title="Generate AI proposal draft"
                            className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded border border-emerald-500/30 transition text-[11px]"
                          >
                            ✍️ Draft
                          </button>
                          <button
                            onClick={() => onAssign(compId)}
                            title="Assign to team member"
                            className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded border border-blue-500/30 transition text-[11px]"
                          >
                            👤 Assign
                          </button>
                          <button
                            onClick={() => onInspect(compId)}
                            title="View 6-factor score breakdown"
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition text-[11px]"
                          >
                            Inspect &rarr;
                          </button>
                          <button
                            onClick={() => onDelete(compId, c.name || c.company)}
                            title="Delete Sponsor"
                            className="px-1.5 py-1 text-slate-500 hover:text-red-400 rounded transition text-[11px]"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
