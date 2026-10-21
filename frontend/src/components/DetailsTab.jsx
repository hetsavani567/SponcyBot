import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, safeFetchJson } from '../services/api.js';

// Helper to generate personalized sponsorship outreach proposal ready for chat
const generatePreparedProposal = (company) => {
  if (!company) return '';
  const compName = company.name || company.company || 'there';
  const contact = company.contactName ? company.contactName.split(' ')[0] : `${compName} Team`;
  const tier = company.recommendedTier || 'Silver';
  const askText = company.recommendedAsk === 'infra'
    ? 'cloud infrastructure credits, developer tooling access, and workshop challenge bounties'
    : company.recommendedAsk === 'goodies'
    ? 'participant swag hampers, student vouchers, and prize bundles'
    : `${tier} tier cash sponsorship and talent hiring engagement`;

  let customAngle = company.strategy || company.whyGoodSponsor || company.shortPitch || '';
  if (!customAngle) {
    customAngle = `Given ${compName}'s strong presence in ${company.industry || company.category || 'technology'}, our 500+ builders would love to build with your tools and APIs.`;
  }

  return `Hi ${contact},\n\nWe are organizing HackFest 2026 at ACM NIT Surat, bringing together 500+ top collegiate developers and builders.\n\n${customAngle}\n\nWe would love to feature ${compName} as our ${tier} Sponsor for HackFest 2026. We are looking to collaborate on ${askText}.\n\nCould we connect for a brief 10-minute sync this week to explore this?\n\nBest regards,\nHet Savani\nSponsorship Lead · HackFest 2026`;
};

export default function DetailsTab({
  selectedCompanyId,
  selectedThreadId,
  companies = [],
  onShowToast,
  onRefreshStats,
  onSwitchTab
}) {
  // Master Threads List
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Active Selection
  const [activeThreadId, setActiveThreadId] = useState(selectedThreadId || null);
  const [threadDetail, setThreadDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Active Company (linked to selected thread or selectedCompanyId)
  const [activeCompany, setActiveCompany] = useState(null);

  // UI Tabs & Filters
  const [activePanelTab, setActivePanelTab] = useState('conversation'); // 'conversation' | 'intelligence'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'INTERESTED' | 'WAITING' | 'MEETING' | 'DECLINED'
  const [showSponsorPicker, setShowSponsorPicker] = useState(false);

  // Composer & Actions
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [confirmingOutcome, setConfirmingOutcome] = useState(false);
  const [reResearching, setReResearching] = useState(false);

  // Simulation Dropdown/Input
  const [showSimulateBox, setShowSimulateBox] = useState(false);
  const [simText, setSimText] = useState('');
  const [simSentiment, setSimSentiment] = useState('interested');
  const [simulating, setSimulating] = useState(false);

  // Helper to create an in-memory prepared thread structure for any sponsor
  const createPreparedThread = useCallback((comp) => {
    if (!comp) return null;
    const cId = comp._id || comp.id;
    return {
      threadId: `thread_${cId}`,
      companyId: comp,
      outreachId: null,
      emailId: null,
      subject: `Partnering with HackFest 2026: ${comp.name || comp.company} Sponsorship`,
      snippet: `⚡ Prepared outreach chat for ${comp.name || comp.company}...`,
      messages: [],
      lastMessageAt: new Date(),
      suggestedLabel: 'PENDING_CLASSIFICATION',
      classificationReason: 'New outreach chat prepared for sponsor.',
      confidence: 'HIGH',
      isPrepared: true
    };
  }, []);

  // Fetch all threads from backend
  const fetchAllThreads = useCallback(async (preferredThreadId = null, targetCompanyId = null) => {
    setLoadingThreads(true);
    try {
      const data = await api.getThreads();
      let list = Array.isArray(data) ? [...data] : [];

      const effCompanyId = targetCompanyId || selectedCompanyId;
      let targetId = preferredThreadId || selectedThreadId;

      if (effCompanyId) {
        const matching = list.find((t) => {
          const cId = t.companyId?._id || t.companyId?.id || t.companyId;
          return String(cId) === String(effCompanyId);
        });

        if (matching) {
          targetId = matching.threadId;
          setActiveThreadId(matching.threadId);
          if (matching.companyId && typeof matching.companyId === 'object') {
            setActiveCompany(matching.companyId);
          }
          setActivePanelTab('conversation');
        } else {
          // Sponsor does not have a thread yet -> prepare chat!
          const comp = companies.find(c => String(c._id || c.id) === String(effCompanyId)) ||
            (await api.getCompany(effCompanyId).catch(() => null));

          if (comp) {
            const prepared = createPreparedThread(comp);
            list = [prepared, ...list];
            targetId = prepared.threadId;
            setActiveThreadId(prepared.threadId);
            setActiveCompany(comp);
            setThreadDetail(prepared);
            setReplyBody(generatePreparedProposal(comp));
            setActivePanelTab('conversation');
          }
        }
      }

      setThreads(list);

      if (!targetId && list.length > 0) {
        targetId = list[0].threadId;
        setActiveThreadId(targetId);
      }
    } catch (err) {
      onShowToast(`Failed to load email threads: ${err.message}`, 'error');
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId, selectedCompanyId, companies, createPreparedThread, onShowToast]);

  // Initial load
  useEffect(() => {
    fetchAllThreads();
  }, [fetchAllThreads]);

  // When selectedCompanyId prop changes externally (e.g. user clicked Inspect on a sponsor)
  useEffect(() => {
    if (!selectedCompanyId) return;

    const matching = threads.find((t) => {
      const cId = t.companyId?._id || t.companyId?.id || t.companyId;
      return String(cId) === String(selectedCompanyId);
    });

    if (matching) {
      setActiveThreadId(matching.threadId);
      if (matching.companyId && typeof matching.companyId === 'object') {
        setActiveCompany(matching.companyId);
      }
      setActivePanelTab('conversation');
      if (!matching.messages || matching.messages.length === 0) {
        setReplyBody(generatePreparedProposal(matching.companyId));
      }
    } else {
      const comp = companies.find(c => String(c._id || c.id) === String(selectedCompanyId));
      const applyPrepared = (compData) => {
        if (!compData) return;
        const prepared = createPreparedThread(compData);
        setThreads(prev => {
          const without = prev.filter(t => t.threadId !== prepared.threadId);
          return [prepared, ...without];
        });
        setActiveThreadId(prepared.threadId);
        setActiveCompany(compData);
        setThreadDetail(prepared);
        setReplyBody(generatePreparedProposal(compData));
        setActivePanelTab('conversation');
      };

      if (comp) {
        applyPrepared(comp);
      } else {
        api.getCompany(selectedCompanyId).then(applyPrepared).catch(() => {});
      }
    }
  }, [selectedCompanyId, companies, threads, createPreparedThread]);

  // Load single thread detail whenever activeThreadId changes
  const loadActiveThread = useCallback(async (threadId) => {
    if (!threadId) return;

    // If it's a prepared thread in memory with no saved messages yet, don't overwrite with 404
    const existing = threads.find(t => t.threadId === threadId);
    if (existing && existing.isPrepared && (!existing.messages || existing.messages.length === 0)) {
      setThreadDetail(existing);
      if (existing.companyId && typeof existing.companyId === 'object') {
        setActiveCompany(existing.companyId);
        setReplyBody(prev => prev || generatePreparedProposal(existing.companyId));
      }
      return;
    }

    setLoadingDetail(true);
    try {
      const threadData = await api.getThread(threadId);
      if (threadData) {
        setThreadDetail(threadData);

        if (threadData.companyId && typeof threadData.companyId === 'object' && threadData.companyId.name) {
          setActiveCompany(threadData.companyId);
        } else if (threadData.companyId) {
          const comp = await api.getCompany(threadData.companyId);
          if (comp) setActiveCompany(comp);
        }

        if (!threadData.messages || threadData.messages.length === 0) {
          const compObj = threadData.companyId && typeof threadData.companyId === 'object' ? threadData.companyId : activeCompany;
          if (compObj) {
            setReplyBody(prev => prev || generatePreparedProposal(compObj));
          }
        }
      }
    } catch (err) {
      console.warn('[DetailsTab] Thread detail notice:', err.message);
    } finally {
      setLoadingDetail(false);
    }
  }, [threads, activeCompany]);

  useEffect(() => {
    if (activeThreadId) {
      loadActiveThread(activeThreadId);
    }
  }, [activeThreadId, loadActiveThread]);

  // Filtered threads list for sidebar
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const compName = t.companyId?.name || t.companyId?.company || '';
      const subject = t.subject || '';
      const snippet = t.snippet || '';
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || compName.toLowerCase().includes(q) || subject.toLowerCase().includes(q) || snippet.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      const status = (t.isPrepared ? 'PREPARED' : t.outreachId?.status || t.suggestedLabel || '').toUpperCase();
      if (filterStatus === 'ALL') return true;
      if (filterStatus === 'INTERESTED') return status.includes('INTEREST') || t.suggestedLabel === 'INTERESTED';
      if (filterStatus === 'WAITING') return status.includes('WAITING') || status.includes('FOLLOW') || status.includes('PREPARED');
      if (filterStatus === 'MEETING') return status.includes('MEETING');
      if (filterStatus === 'DECLINED') return status.includes('DECLINE');
      return true;
    });
  }, [threads, searchQuery, filterStatus]);

  // Quick prompt shortcuts for reply composer
  const handleInsertQuickTemplate = (type) => {
    const compName = activeCompany?.name || 'there';
    if (type === 'meeting') {
      setReplyBody(
        `Hi ${compName} Team,\n\nThank you for the positive response! We would love to host a quick 15-minute sync with our organizing team.\n\nPlease find our Google Meet link here: https://meet.google.com/abc-defg-hij\n\nLooking forward to speaking this week!\n\nBest regards,\nHet Savani`
      );
    } else if (type === 'deck') {
      setReplyBody(
        `Hi ${compName} Team,\n\nFollowing up with our complete HackFest 2026 Sponsorship Prospectus and tier breakdowns.\n\nYou can view the full brochure and demographic overview here: https://hackfest.acm-nitsurat.org/prospectus.pdf\n\nLet us know if you have any questions!\n\nBest regards,\nHet Savani`
      );
    } else if (type === 'followup') {
      setReplyBody(
        `Hi ${compName} Partnerships Team,\n\nChecking in to see if you had a moment to review our earlier proposal regarding the HackFest 2026 sponsor tracks.\n\nWe would be thrilled to have your participation.\n\nBest regards,\nHet Savani`
      );
    } else if (type === 'proposal') {
      setReplyBody(generatePreparedProposal(activeCompany));
    }
  };

  // Count outbound messages sent by organizer to enforce 3-message limit
  const outboundMessagesCount = useMemo(() => {
    const msgs = threadDetail?.messages || [];
    return msgs.filter((m) => !m.isFromSponsor).length;
  }, [threadDetail?.messages]);
  const isMessageLimitReached = outboundMessagesCount >= 3;

  // Send outbound reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim() || !activeThreadId) return;

    if (isMessageLimitReached) {
      onShowToast('Outreach limit reached: Maximum 3 messages allowed per sponsor thread to prevent spam.', 'warning');
      return;
    }

    setSendingReply(true);
    try {
      const recipientEmail = activeCompany?.contactEmail || 'sponsor@company.com';
      const companyId = activeCompany?._id || activeCompany?.id || null;
      const { res, data } = await api.sendThreadReply(activeThreadId, {
        body: replyBody.trim(),
        subject: threadDetail?.subject || `Partnering with HackFest 2026: ${activeCompany?.name || 'Sponsor'} Sponsorship`,
        recipientEmail,
        senderName: 'Het Savani',
        companyId
      });

      if (res.ok) {
        onShowToast(`Outreach message sent to ${activeCompany?.name || 'sponsor'}! Tracked in Outreach CRM.`, 'success');
        setReplyBody('');

        // Invalidate CRM cache so CRM page reflects row immediately
        api.invalidateCache('/outreach');
        api.invalidateCache('/gmail/stats');
        api.invalidateCache('/api/bootstrap');

        const updatedThread = data?.data?.thread;
        const newMsg = data?.data?.message;

        if (updatedThread) {
          setThreadDetail(updatedThread);
          setThreads(prev => prev.map(t => t.threadId === activeThreadId ? { ...t, ...updatedThread, isPrepared: false } : t));
        } else if (newMsg) {
          setThreadDetail(prev => ({
            ...prev,
            isPrepared: false,
            messages: [...(prev?.messages || []), newMsg],
            lastMessageAt: new Date()
          }));
          setThreads(prev => prev.map(t => t.threadId === activeThreadId ? {
            ...t,
            isPrepared: false,
            messages: [...(t.messages || []), newMsg],
            lastMessageAt: new Date(),
            snippet: newMsg.snippet
          } : t));
        }

        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Failed to send reply', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // Simulate inbound sponsor reply
  const handleSimulateInboundReply = async () => {
    if (!activeThreadId) return;
    const textToSend = simText.trim() || (
      simSentiment === 'interested'
        ? `Hey Het, thanks for reaching out! We'd love to partner as a ${activeCompany?.recommendedTier || 'Gold'} Sponsor and host a workshop track for your 500 hackers. Let's schedule a 15-min call to lock in details: https://meet.google.com/abc-defg-hij`
        : `Hi Het, thank you for considering us. Unfortunately our university event budget is fully allocated for this semester so we must pass.`
    );

    setSimulating(true);
    try {
      const companyId = activeCompany?._id || activeCompany?.id || null;
      const { res, data } = await api.simulateThreadReply(activeThreadId, {
        replyText: textToSend,
        sentiment: simSentiment,
        sponsorName: activeCompany?.contactName || `${activeCompany?.name || 'Sponsor'} Team`,
        sponsorEmail: activeCompany?.contactEmail || 'sponsor@company.com',
        companyId
      });

      if (res.ok) {
        onShowToast(`Simulated sponsor reply recorded! AI classified as ${data.data?.classification?.suggestedLabel || 'INTERESTED'}`, 'success');
        setSimText('');
        setShowSimulateBox(false);

        const updatedThread = data?.data?.thread;
        const newMsg = data?.data?.message;
        const classification = data?.data?.classification;

        if (updatedThread) {
          setThreadDetail(updatedThread);
          setThreads(prev => prev.map(t => t.threadId === activeThreadId ? { ...t, ...updatedThread, isPrepared: false } : t));
        } else if (newMsg) {
          setThreadDetail(prev => ({
            ...prev,
            isPrepared: false,
            messages: [...(prev?.messages || []), newMsg],
            suggestedLabel: classification?.suggestedLabel || 'INTERESTED',
            confidence: classification?.confidence || 'HIGH',
            classificationReason: classification?.reason || '',
            lastMessageAt: new Date()
          }));
          setThreads(prev => prev.map(t => t.threadId === activeThreadId ? {
            ...t,
            isPrepared: false,
            messages: [...(t.messages || []), newMsg],
            suggestedLabel: classification?.suggestedLabel || 'INTERESTED',
            lastMessageAt: new Date(),
            snippet: newMsg.snippet
          } : t));
        }

        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Simulation failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  // Confirm AI suggested reply outcome
  const handleConfirmOutcome = async (label) => {
    if (!activeThreadId) return;
    setConfirmingOutcome(true);
    try {
      const { res, data } = await api.confirmReplyOutcome({
        threadId: activeThreadId,
        label,
        confirmedBy: 'Het Savani (Sponsorship Lead)',
        meetingLink: label === 'INTERESTED' ? 'https://meet.google.com/abc-defg-hij' : null,
        meetingScheduledAt: label === 'INTERESTED' ? new Date(Date.now() + 86400000 * 2) : null,
        notes: `Human confirmed AI outcome: ${label}`
      });

      if (res.ok) {
        onShowToast(`Outcome '${label}' confirmed! Outreach CRM & Meeting pipeline updated.`, 'success');
        await loadActiveThread(activeThreadId);
        fetchAllThreads(activeThreadId);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Confirmation failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setConfirmingOutcome(false);
    }
  };

  // Refresh AI Research with Tavily + Gemini
  const handleReResearch = async () => {
    if (!activeCompany?._id && !activeCompany?.id) return;
    const cId = activeCompany._id || activeCompany.id;
    setReResearching(true);
    onShowToast('Refreshing sponsor AI research with Tavily...', 'info');
    try {
      const { res, data } = await api.researchCompany(cId);
      if (res.ok) {
        onShowToast(`Research updated! Score: ${data.score || 0}/100 · Tier: ${data.recommendedTier || 'Silver'}`, 'success');
        setActiveCompany(data);
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

  // Helper formatting
  const tier = activeCompany?.recommendedTier || 'Bronze';
  const tierColor = {
    Platinum: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    Gold: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Silver: 'bg-slate-400/20 text-slate-300 border-slate-500/40',
    Bronze: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
  }[tier] || 'bg-slate-800 text-slate-300 border-slate-700';

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Quick stats summary
  const statsSummary = useMemo(() => {
    const total = threads.length;
    let interested = 0;
    let waiting = 0;
    let meetings = 0;
    threads.forEach((t) => {
      const s = (t.outreachId?.status || t.suggestedLabel || '').toUpperCase();
      if (s.includes('MEETING')) meetings++;
      else if (s.includes('INTEREST') || t.suggestedLabel === 'INTERESTED') interested++;
      else if (s.includes('WAITING') || s.includes('FOLLOW')) waiting++;
    });
    return { total, interested, waiting, meetings };
  }, [threads]);

  return (
    <div className="space-y-4">
      {/* ── Top Bar & Stats ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">💬</span>
            <h1 className="text-base font-bold text-white tracking-tight">
              Conversation Threads & Deal Intelligence
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Database Synced
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Full email message histories, Gemini AI intent classification, and structured sponsor deep dives.
          </p>
        </div>

        {/* Quick Metrics Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Threads</span>
            <span className="text-xs font-bold text-white font-mono">{statsSummary.total}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-center">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Interested</span>
            <span className="text-xs font-bold text-emerald-300 font-mono">{statsSummary.interested}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-500/30 text-center">
            <span className="text-[10px] text-blue-400 uppercase font-semibold block">Awaiting</span>
            <span className="text-xs font-bold text-blue-300 font-mono">{statsSummary.waiting}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-500/30 text-center">
            <span className="text-[10px] text-purple-400 uppercase font-semibold block">Meetings</span>
            <span className="text-xs font-bold text-purple-300 font-mono">{statsSummary.meetings}</span>
          </div>

          <button
            onClick={() => fetchAllThreads(activeThreadId)}
            disabled={loadingThreads}
            title="Reload threads from database"
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition border border-slate-700 flex items-center space-x-1"
          >
            <span className={loadingThreads ? 'animate-spin' : ''}>🔄</span>
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* ── Main Structured 2-Column Layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Threads Directory Sidebar (Col 4) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[750px] shadow-sm overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900/90 sticky top-0 z-10">
            {/* Quick Sponsor Chat Launcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSponsorPicker(!showSponsorPicker)}
                className="w-full text-xs py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition flex items-center justify-between font-medium group"
              >
                <span className="flex items-center space-x-1.5">
                  <span>💬</span>
                  <span>+ Start Chat with Sponsor...</span>
                </span>
                <span className="text-[10px] text-emerald-400 group-hover:text-white font-mono">
                  {companies.length} Available ▾
                </span>
              </button>

              {showSponsorPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-800/80 p-1">
                  <div className="p-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Select Sponsor Company:
                  </div>
                  {companies.map((c) => {
                    const cId = c._id || c.id;
                    const cTier = c.recommendedTier || 'Silver';
                    return (
                      <button
                        key={cId}
                        type="button"
                        onClick={() => {
                          setShowSponsorPicker(false);
                          const matching = threads.find((t) => {
                            const tCompId = t.companyId?._id || t.companyId?.id || t.companyId;
                            return String(tCompId) === String(cId);
                          });

                          if (matching) {
                            setActiveThreadId(matching.threadId);
                            setActiveCompany(matching.companyId || c);
                            setActivePanelTab('conversation');
                            if (!matching.messages || matching.messages.length === 0) {
                              setReplyBody(generatePreparedProposal(c));
                            }
                          } else {
                            const prepared = createPreparedThread(c);
                            setThreads((prev) => {
                              const without = prev.filter((t) => t.threadId !== prepared.threadId);
                              return [prepared, ...without];
                            });
                            setActiveThreadId(prepared.threadId);
                            setActiveCompany(c);
                            setThreadDetail(prepared);
                            setReplyBody(generatePreparedProposal(c));
                            setActivePanelTab('conversation');
                          }
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-xs text-slate-200 flex items-center justify-between transition"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-white truncate">{c.name || c.company}</p>
                          <p className="text-[10px] text-slate-400 truncate">{c.contactEmail || 'No email'}</p>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-900 text-slate-300 border border-slate-700 shrink-0">
                          {cTier} · {c.score || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sponsor or subject..."
                className="w-full text-xs pl-8 pr-7 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <span className="absolute left-2.5 top-2.5 text-xs text-slate-500">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 text-[11px]">
              {['ALL', 'INTERESTED', 'WAITING', 'MEETING', 'DECLINED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition ${
                    filterStatus === st
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'INTERESTED' ? '🔥 Interested' : st === 'WAITING' ? '⏳ Awaiting' : st === 'MEETING' ? '📅 Meeting' : '❌ Declined'}
                </button>
              ))}
            </div>
          </div>

          {/* Threads Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1.5 space-y-1">
            {loadingThreads ? (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
                Loading conversations from database...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <span className="text-2xl">📭</span>
                <p className="text-xs text-slate-400">No conversation threads found.</p>
                <button
                  onClick={() => { setSearchQuery(''); setFilterStatus('ALL'); }}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isSelected = t.threadId === activeThreadId;
                const comp = t.companyId || {};
                const compName = comp.name || comp.company || 'Sponsor';
                const compTier = comp.recommendedTier || 'Silver';
                const msgCount = (t.messages || []).length;
                const isPrepared = Boolean(t.isPrepared);
                const status = isPrepared ? 'READY TO SEND' : (t.outreachId?.status || t.suggestedLabel || 'WAITING FOR REPLY');
                const isInterested = t.suggestedLabel === 'INTERESTED' || status === 'INTERESTED' || status === 'MEETING';
                const isDeclined = t.suggestedLabel === 'DECLINED' || status === 'DECLINED';

                return (
                  <div
                    key={t.threadId}
                    onClick={() => {
                      setActiveThreadId(t.threadId);
                      if (comp && (comp._id || comp.id)) setActiveCompany(comp);
                      if (isPrepared) {
                        setThreadDetail(t);
                        if (!replyBody) setReplyBody(generatePreparedProposal(comp));
                      }
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition relative text-left ${
                      isSelected
                        ? 'bg-slate-800/90 border border-emerald-500/50 shadow-sm'
                        : 'bg-slate-950/40 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    {/* Header: Company + Tier + Time */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                          {compName[0]?.toUpperCase() || 'S'}
                        </div>
                        <span className="text-xs font-bold text-white truncate max-w-[130px]">
                          {compName}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                          {compTier}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {isPrepared ? 'Ready' : formatRelativeTime(t.lastMessageAt || t.updatedAt)}
                      </span>
                    </div>

                    {/* Subject line */}
                    <p className="text-[11px] font-semibold text-slate-200 truncate mb-1">
                      {t.subject || 'Outreach Discussion'}
                    </p>

                    {/* Snippet */}
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {isPrepared ? '⚡ Prepared proposal ready in composer. Click to chat...' : (t.snippet || 'No message preview available.')}
                    </p>

                    {/* Footer Tags */}
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center space-x-1">
                        {isPrepared && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium text-[9px] flex items-center space-x-1">
                            <span>⚡</span>
                            <span>Prepared Chat</span>
                          </span>
                        )}
                        {!isPrepared && isInterested && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                            🤖 Interested
                          </span>
                        )}
                        {!isPrepared && isDeclined && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
                            Declined
                          </span>
                        )}
                        {!isPrepared && !isInterested && !isDeclined && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                            {status}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                        <span>✉️</span>
                        <span>{msgCount}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Master Detail Area (Col 8) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[750px] shadow-sm overflow-hidden">
          {/* Top Panel Nav Tabs */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActivePanelTab('conversation')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activePanelTab === 'conversation'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💬 Conversation History</span>
                {threadDetail?.messages && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-200">
                    {threadDetail.messages.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActivePanelTab('intelligence')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activePanelTab === 'intelligence'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🏢 Sponsor Intelligence & Research</span>
                {activeCompany?.score && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {activeCompany.score}/100
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions Right */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSimulateBox(!showSimulateBox)}
                className="px-2.5 py-1 text-xs bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg border border-purple-500/30 transition font-medium flex items-center space-x-1"
                title="Simulate inbound sponsor email to test AI classification"
              >
                <span>🧪 Test Inbound Reply</span>
              </button>

              {activeCompany && (
                <button
                  onClick={handleReResearch}
                  disabled={reResearching}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition flex items-center space-x-1.5 ${
                    reResearching
                      ? 'bg-purple-600/40 text-purple-200 border-purple-500/50 cursor-wait'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Run live Tavily web intelligence and Gemini scoring"
                >
                  {reResearching ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-purple-200 inline-block shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-semibold">Researching...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>AI Research</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Test Inbound Reply Simulation Dropdown Drawer */}
          {showSimulateBox && (
            <div className="p-3 bg-purple-950/30 border-b border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
                  <span>🧪</span>
                  <span>Simulate Sponsor Inbound Email</span>
                </span>
                <button
                  onClick={() => setShowSimulateBox(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <label className="text-slate-400">Sentiment:</label>
                <select
                  value={simSentiment}
                  onChange={(e) => setSimSentiment(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="interested">Interested (Wants meeting/credits)</option>
                  <option value="declined">Declined (Budget exhausted)</option>
                  <option value="auto">Auto-detect with Gemini AI</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="Optional custom sponsor message (or leave blank for auto template)..."
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSimulateInboundReply}
                  disabled={simulating}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {simulating ? 'Processing...' : 'Simulate Inbound'}
                </button>
              </div>
            </div>
          )}

          {/* ── Content Body: Tab 1 (Conversation) or Tab 2 (Intelligence) ── */}
          {loadingDetail ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              <div className="text-center space-y-2">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading thread data from database...</p>
              </div>
            </div>
          ) : !threadDetail ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 p-8 text-center">
              <div>
                <span className="text-3xl block mb-2">✉️</span>
                <p className="font-semibold text-slate-300">Select an email thread from the left directory</p>
                <p className="text-[11px] text-slate-500 mt-1">Or inspect a sponsor from the Sponsors table</p>
              </div>
            </div>
          ) : activePanelTab === 'conversation' ? (
            /* ── VIEW 1: Conversation History & Interactive Composer ────── */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Thread Info Bar */}
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-bold text-white tracking-tight">
                      {threadDetail.subject || `Partnering with HackFest 2026: ${activeCompany?.name || 'Sponsor'} Sponsorship`}
                    </h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${tierColor}`}>
                      {tier}
                    </span>
                    {threadDetail.isPrepared && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                        ⚡ Prepared Chat
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                    <span>🏢 {activeCompany?.name || 'Sponsor'}</span>
                    <span>·</span>
                    <span>✉ {activeCompany?.contactEmail || 'sponsor@company.com'}</span>
                    <span>·</span>
                    <span className="font-mono text-[10px] text-slate-500">Thread: {threadDetail.threadId}</span>
                  </div>
                </div>

                {/* Meeting Callout Pill (if confirmed) */}
                {threadDetail.outreach?.status === 'MEETING' && (
                  <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs text-emerald-300">
                    <span>📅</span>
                    <span className="font-semibold">Meeting Scheduled!</span>
                    {threadDetail.outreach.meetingLink && (
                      <a
                        href={threadDetail.outreach.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-[11px] transition shadow-sm ml-1"
                      >
                        Join Call ↗
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* AI Classification & Sentiment Decision Box */}
              {threadDetail.suggestedLabel && threadDetail.suggestedLabel !== 'PENDING_CLASSIFICATION' && (
                <div className="m-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 space-y-2 shrink-0 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🤖</span>
                      <span className="text-xs font-bold text-emerald-400">Gemini Intent Classification:</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        threadDetail.suggestedLabel === 'INTERESTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}>
                        {threadDetail.suggestedLabel}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">
                      Confidence: {threadDetail.confidence || 'HIGH'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {threadDetail.classificationReason || 'AI analyzed sponsor reply intent.'}
                  </p>
                  {threadDetail.confirmedLabel && (
                    <div className="text-[11px] text-slate-400 pt-1 flex items-center space-x-1">
                      <span>✓ Human confirmed outcome:</span>
                      <span className="font-semibold text-white">{threadDetail.confirmedLabel}</span>
                      {threadDetail.confirmedBy && <span>by {threadDetail.confirmedBy}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Messages Chat Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!threadDetail.messages || threadDetail.messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/10 animate-pulse">
                      ⚡
                    </div>
                    <div className="max-w-md">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        Outreach Chat Prepared for {activeCompany?.name || 'Sponsor'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        A personalized sponsorship proposal has been generated based on their <strong>{tier} Tier</strong> fit score ({activeCompany?.score ?? 0}/100) and target ask.
                      </p>
                    </div>

                    <div className="w-full max-w-lg bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-left text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                        <span className="font-medium text-slate-400">Target Contact:</span>
                        <span className="font-mono text-emerald-300 font-semibold">{activeCompany?.contactEmail || 'sponsorships@company.com'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                        <span className="font-medium text-slate-400">Recommended Ask:</span>
                        <span className="text-slate-200 font-medium">
                          {activeCompany?.recommendedAsk === 'infra' ? '☁️ Cloud Credits & Dev Tools' : activeCompany?.recommendedAsk === 'goodies' ? '🎁 Swag & Prize Bundles' : '💰 Cash Bounty'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed italic pt-1">
                        "{activeCompany?.strategy || activeCompany?.whyGoodSponsor || 'Pitch dedicated sponsor workshop track and developer recruiting engagement.'}"
                      </p>
                    </div>

                    <p className="text-[11px] text-emerald-400/90 font-medium flex items-center space-x-1.5">
                      <span>✍️</span>
                      <span>Personalized proposal ready in composer below. Click 'Send Outreach ↗' to dispatch.</span>
                    </p>
                  </div>
                ) : (
                  threadDetail.messages.map((m, idx) => {
                    const isSponsor = m.isFromSponsor;
                    return (
                      <div
                        key={m.messageId || idx}
                        className={`flex flex-col ${isSponsor ? 'items-start' : 'items-end'} space-y-1`}
                      >
                        {/* Header Pill */}
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 px-1">
                          <span className="font-semibold text-slate-300">
                            {isSponsor ? `🏢 ${activeCompany?.name || 'Sponsor'}` : '⚡ You (Organizer)'}
                          </span>
                          <span>·</span>
                          <span className="text-slate-500 font-mono">
                            {m.date ? new Date(m.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            isSponsor ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}>
                            {isSponsor ? 'Received Inbound' : 'Outbound Dispatched'}
                          </span>
                        </div>

                        {/* Bubble Body */}
                        <div
                          className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                            isSponsor
                              ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-sm'
                              : 'bg-emerald-950/70 text-emerald-100 border border-emerald-500/30 rounded-tr-sm'
                          }`}
                        >
                          <p>{m.body || m.snippet}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Composer Bar */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/70 space-y-2 shrink-0">
                {/* 3-Message Quota Alert / Counter */}
                {isMessageLimitReached ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-base shrink-0">🔒</span>
                      <div>
                        <span className="font-bold text-amber-200">Outreach Quota Reached (3/3 Messages Sent):</span>
                        <span className="text-slate-300 ml-1">
                          You have sent the maximum 3 outreach messages allowed for this sponsor thread to prevent spam. This conversation is tracked in Outreach CRM.
                        </span>
                      </div>
                    </div>
                    {onSwitchTab && (
                      <button
                        type="button"
                        onClick={() => onSwitchTab('outreach')}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg font-medium text-[11px] whitespace-nowrap self-start sm:self-auto transition shadow-sm"
                      >
                        View in Outreach CRM ↗
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
                      <span className="text-slate-500 font-mono text-[10px]">✨ Quick AI Fill:</span>
                      <button
                        type="button"
                        disabled={isMessageLimitReached}
                        onClick={() => handleInsertQuickTemplate('proposal')}
                        className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition shrink-0 font-medium disabled:opacity-40"
                      >
                        💡 Prepared Pitch
                      </button>
                      <button
                        type="button"
                        disabled={isMessageLimitReached}
                        onClick={() => handleInsertQuickTemplate('meeting')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0 disabled:opacity-40"
                      >
                        📅 Propose Meeting
                      </button>
                      <button
                        type="button"
                        disabled={isMessageLimitReached}
                        onClick={() => handleInsertQuickTemplate('deck')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0 disabled:opacity-40"
                      >
                        📊 Send Prospectus
                      </button>
                      <button
                        type="button"
                        disabled={isMessageLimitReached}
                        onClick={() => handleInsertQuickTemplate('followup')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0 disabled:opacity-40"
                      >
                        ⏳ Friendly Follow-up
                      </button>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 shrink-0 hidden sm:inline-block">
                      ✉️ Quota: <strong className="text-emerald-400">{outboundMessagesCount}</strong> / 3 messages sent
                    </span>
                  </div>
                )}

                <form onSubmit={handleSendReply} className="flex gap-2 items-end">
                  <textarea
                    rows={2}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    disabled={isMessageLimitReached || sendingReply}
                    placeholder={
                      isMessageLimitReached
                        ? "Outreach limit reached (3/3 sent). Further follow-ups locked to protect deliverability and avoid spam."
                        : (!threadDetail.messages || threadDetail.messages.length === 0
                        ? `Review or customize prepared outreach proposal to ${activeCompany?.name || 'sponsor'}...`
                        : `Compose email response to ${activeCompany?.name || 'sponsor'}...`)
                    }
                    className="flex-1 text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={isMessageLimitReached || sendingReply || !replyBody.trim()}
                    className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 shrink-0"
                  >
                    <span>
                      {isMessageLimitReached
                        ? '🔒 Limit Reached (3/3)'
                        : sendingReply
                        ? 'Sending...'
                        : (!threadDetail.messages || threadDetail.messages.length === 0
                        ? 'Send Outreach ↗'
                        : 'Send ↗')}
                    </span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* ── VIEW 2: Sponsor Intelligence & Research Deep Dive ──────── */
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header Overview Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-white">
                      {activeCompany?.name || activeCompany?.company}
                    </h2>
                    <span className={`text-xs px-2.5 py-0.5 rounded border font-semibold ${tierColor}`}>
                      {tier} Tier
                    </span>
                    {activeCompany?.isVerified && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeCompany?.industry || 'Technology'} · {activeCompany?.category}
                    {activeCompany?.website && (
                      <a
                        href={activeCompany.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline ml-2"
                      >
                        {activeCompany.website.replace(/^https?:\/\//, '')} ↗
                      </a>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Sponsor Fit Score</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {activeCompany?.score ?? 0}
                    <span className="text-xs font-normal text-slate-500"> / 100</span>
                  </span>
                </div>
              </div>

              {/* Research & Strategic Angle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <span>💡 Why They Are a Good Sponsor</span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeCompany?.whyGoodSponsor || activeCompany?.research || 'Verified sponsor aligned with student developer ecosystems and collegiate hackathons.'}
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <span>🎯 Pitch Strategy & Recommended Ask</span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeCompany?.strategy || 'Propose dedicated workshop track and challenge bounty.'}
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Ask Type:</span>
                    <span className="font-bold text-emerald-300">
                      {activeCompany?.recommendedAsk === 'infra' ? '☁️ Cloud Credits & Infra' : activeCompany?.recommendedAsk === 'goodies' ? '🎁 Swag & Prize Hampers' : '💰 Cash Bounty'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discovered Contacts Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                    <span>👥 Discovered Sponsor Contacts</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                    Pattern & Domain Discovery Active
                  </span>
                </div>

                {activeCompany?.discoveredContacts && activeCompany.discoveredContacts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeCompany.discoveredContacts.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-white text-[11px]">{c.role}</p>
                          <a href={`mailto:${c.email}`} className="text-emerald-400 hover:underline font-mono text-[10px]">{c.email}</a>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {c.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white text-[11px]">Primary Outreach Contact</p>
                      <a href={`mailto:${activeCompany?.contactEmail}`} className="text-emerald-400 hover:underline font-mono text-[11px]">
                        {activeCompany?.contactEmail || 'sponsorships@company.com'}
                      </a>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      VERIFIED
                    </span>
                  </div>
                )}
              </div>

              {/* 6-Factor Score Breakdown */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                  <span>📊 6-Factor Sponsorship Scoring Breakdown</span>
                </h3>

                <div className="space-y-3 text-xs">
                  {[
                    { label: 'Event Fit', max: 25, val: activeCompany?.eventFit ?? 20 },
                    { label: 'Sponsorship Evidence', max: 20, val: activeCompany?.sponsorshipEvidence ?? 16 },
                    { label: 'Education & Community Fit', max: 15, val: activeCompany?.educationCommunityFit ?? 12 },
                    { label: 'Product Relevance', max: 15, val: activeCompany?.productRelevance ?? 13 },
                    { label: 'Audience Fit', max: 15, val: activeCompany?.audienceFit ?? 12 },
                    { label: 'Sponsorship Potential', max: 10, val: activeCompany?.sponsorshipPotential ?? 8 }
                  ].map((f, idx) => {
                    const pct = Math.round((f.val / f.max) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>{f.label}</span>
                          <span className="font-mono text-white font-semibold">
                            {f.val} <span className="text-slate-500 font-normal">/ {f.max}</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
