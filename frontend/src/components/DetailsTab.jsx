import React, { useState, useEffect, useCallback } from 'react';
import { api, safeFetchJson } from '../services/api.js';

export default function DetailsTab({
  selectedCompanyId,
  onShowToast,
  onRefreshStats
}) {
  const [company, setCompany] = useState(null);
  const [thread, setThread] = useState(null);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [manualThreadId, setManualThreadId] = useState('');
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reResearching, setReResearching] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadThread = useCallback(async (threadId) => {
    if (!threadId) {
      setThread(null);
      setCurrentThreadId(null);
      return;
    }
    setCurrentThreadId(threadId);
    setLoadingThread(true);
    try {
      const threadData = await api.getThread(threadId);
      setThread(threadData || null);
    } catch (err) {
      onShowToast(`Failed to load thread: ${err.message}`, 'error');
      setThread(null);
    } finally {
      setLoadingThread(false);
    }
  }, [onShowToast]);

  const loadCompany = useCallback(async (companyId) => {
    if (!companyId) return;
    setLoadingCompany(true);
    try {
      const comp = await api.getCompany(companyId);
      setCompany(comp);

      // Check if there is an associated outreach record with a threadId
      try {
        const outRes = await safeFetchJson(`/outreach?companyId=${companyId}`);
        const outList = Array.isArray(outRes.data) ? outRes.data : [];
        if (outList.length > 0 && outList[0].threadId) {
          loadThread(outList[0].threadId);
        } else {
          setThread(null);
          setCurrentThreadId(null);
        }
      } catch {
        setThread(null);
        setCurrentThreadId(null);
      }
    } catch (err) {
      onShowToast(`Failed to load company details: ${err.message}`, 'error');
    } finally {
      setLoadingCompany(false);
    }
  }, [loadThread, onShowToast]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadCompany(selectedCompanyId);
    }
  }, [selectedCompanyId, loadCompany]);

  const handleReResearch = async () => {
    if (!company?._id && !company?.id) {
      onShowToast('No company selected to refresh research.', 'warning');
      return;
    }
    const cId = company._id || company.id;
    setReResearching(true);
    onShowToast('Refreshing sponsor AI research...', 'info');
    try {
      const { res, data } = await api.researchCompany(cId);
      if (res.ok) {
        onShowToast(`Research updated! Score: ${data.score || 0}/100 · Tier: ${data.recommendedTier || 'Silver'}`, 'success');
        await loadCompany(cId);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Failed to refresh research', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setReResearching(false);
    }
  };

  const handleManualThreadSubmit = (e) => {
    e.preventDefault();
    if (!manualThreadId.trim()) return;
    loadThread(manualThreadId.trim());
  };

  const handleConfirmOutcome = async (label) => {
    if (!currentThreadId) return;
    setConfirming(true);
    try {
      const { res, data } = await api.confirmReplyOutcome({
        threadId: currentThreadId,
        label,
        confirmedBy: 'Partnerships Lead',
        notes: `Human confirmed outcome: ${label}`
      });
      if (res.ok) {
        onShowToast(`Reply outcome '${label}' confirmed! Outreach CRM updated.`, 'success');
        // reload thread to update state
        loadThread(currentThreadId);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Confirmation failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setConfirming(false);
    }
  };

  const tier = company?.recommendedTier || 'Bronze';
  const tierColor = {
    Platinum: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    Gold: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Silver: 'bg-slate-400/20 text-slate-300 border-slate-500/40',
    Bronze: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
  }[tier] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <section className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>{company?.name || company?.company || 'Sponsor Deep Dive'}</span>
            {company && (
              <span className={`text-xs px-2.5 py-0.5 rounded border font-semibold ${tierColor}`}>
                Tier: {tier}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            {company
              ? `${company.category || 'Technology'} · Score: ${company.score || 0}/100`
              : 'Select a company from the Sponsors or Outreach screen'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {company && (
            <button
              onClick={handleReResearch}
              disabled={reResearching}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition shadow-sm font-medium flex items-center space-x-1 disabled:opacity-50"
            >
              <span>{reResearching ? 'Refreshing...' : '🔍 Refresh AI Research'}</span>
            </button>
          )}

          <form onSubmit={handleManualThreadSubmit} className="flex items-center space-x-1.5">
            <input
              type="text"
              value={manualThreadId}
              onChange={(e) => setManualThreadId(e.target.value)}
              placeholder="Thread ID (e.g. thread_123)"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition border border-slate-700"
            >
              Load Thread
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Company Intelligence & Scores */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Research Summary
            </h3>
            {loadingCompany ? (
              <p className="text-xs text-slate-500">Loading company details...</p>
            ) : company ? (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {company.research || 'No research available yet. Click "🔍 Refresh AI Research" above.'}
                </p>
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400">Strategic Angle:</span>
                  <p className="text-xs text-emerald-400 font-medium mt-0.5">
                    {company.strategy || 'Direct partnership pitch with track branding.'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400">Recommended Ask:</span>
                  <p className="text-xs text-slate-200 font-medium mt-0.5">
                    <span className="font-semibold text-emerald-300">
                      {company.recommendedAsk === 'infra' ? '☁️ Cloud Credits' : company.recommendedAsk === 'goodies' ? '🎁 Swag/Prizes' : '💰 Cash'}
                    </span>
                    {company.whatToAsk ? ` · ${company.whatToAsk}` : ''}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                No sponsor selected. Click "Inspect" from the Sponsors table.
              </p>
            )}
          </div>

          {/* Discovered Contacts Card (Automatic Contact Discovery) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                <span>🎯 Discovered Contacts</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                Auto-Discovery Active
              </span>
            </div>

            {company?.discoveredContacts && company.discoveredContacts.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {company.discoveredContacts.map((c, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white text-[11px]">{c.role}</p>
                      <a href={`mailto:${c.email}`} className="text-blue-400 hover:underline font-mono text-[10px]">{c.email}</a>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      {c.confidence}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Primary: <span className="font-mono text-slate-300">{company?.contactEmail || 'sponsorships@' + (company?.website ? company.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : 'company.com')}</span>
              </p>
            )}
          </div>

          {/* 6-Factor Score Breakdown Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              6-Factor Score Breakdown
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Event Fit (max 25)</span>
                <span className="text-white font-mono">{company?.eventFit ?? '-'} / 25</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sponsorship Evidence (max 20)</span>
                <span className="text-white font-mono">{company?.sponsorshipEvidence ?? '-'} / 20</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Education/Community Fit (max 15)</span>
                <span className="text-white font-mono">{company?.educationCommunityFit ?? '-'} / 15</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Product Relevance (max 15)</span>
                <span className="text-white font-mono">{company?.productRelevance ?? '-'} / 15</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Audience Fit (max 15)</span>
                <span className="text-white font-mono">{company?.audienceFit ?? '-'} / 15</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sponsorship Potential (max 10)</span>
                <span className="text-white font-mono">{company?.sponsorshipPotential ?? '-'} / 10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Gmail Thread Viewer & AI Classification */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Gmail Conversation Thread
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {currentThreadId ? `Thread: ${currentThreadId}` : 'No thread selected'}
            </span>
          </div>

          {/* AI Sentiment Suggestion Banner */}
          {thread?.suggestedLabel && thread.suggestedLabel !== 'PENDING_CLASSIFICATION' && (
            <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-base">🤖</span>
                  <span className="text-xs font-semibold text-emerald-400">AI Suggested Reply Outcome:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {thread.suggestedLabel}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Confidence: {thread.confidence || 'HIGH'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {thread.classificationReason || 'AI analyzed sponsor intent.'}
              </p>

              {/* Human Confirm Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleConfirmOutcome('INTERESTED')}
                  disabled={confirming}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-medium transition disabled:opacity-50"
                >
                  ✓ Confirm: Interested & Book Meeting
                </button>
                <button
                  onClick={() => handleConfirmOutcome('DECLINED')}
                  disabled={confirming}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-medium transition disabled:opacity-50"
                >
                  ✕ Confirm: Declined (Close)
                </button>
              </div>
            </div>
          )}

          {/* Thread Chat Bubbles */}
          <div className="space-y-3 min-h-[300px] max-h-[450px] overflow-y-auto p-1">
            {loadingThread ? (
              <div className="text-xs text-slate-500 text-center py-16">
                Fetching conversation thread...
              </div>
            ) : !thread || !thread.messages || thread.messages.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-16">
                No conversation messages to display. Load a thread ID or assign outreach.
              </div>
            ) : (
              thread.messages.map((m, idx) => {
                const isSponsor = m.isFromSponsor;
                return (
                  <div
                    key={m.id || idx}
                    className={`flex flex-col ${isSponsor ? 'items-start' : 'items-end'} space-y-1`}
                  >
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                      <span>{isSponsor ? '🏢 Sponsor' : '⚡ Organizer'}</span>
                      <span>·</span>
                      <span>{m.date ? new Date(m.date).toLocaleTimeString() : ''}</span>
                    </div>
                    <div
                      className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                        isSponsor
                          ? 'bg-slate-800 text-slate-200 border border-slate-700'
                          : 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/30'
                      }`}
                    >
                      <p>{m.body || m.snippet}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
