import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

export default function ApprovalTab({
  onShowToast,
  onRefreshStats,
  onSwitchTab,
  companies = [],
  draftingTarget = null,
  newlyCreatedEmail = null,
  preselectedEmailId = null,
  onDraftHandled = null,
  onOpenDraftRequirement = null
}) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [acting, setActing] = useState(false);
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [localDraftingTarget, setLocalDraftingTarget] = useState(null);
  const [preserveSubject, setPreserveSubject] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  const [eventNameInput, setEventNameInput] = useState('HackFest 2026');
  const [eventDatesInput, setEventDatesInput] = useState('November 14–16, 2026');
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);

  const activeDrafting = draftingTarget || localDraftingTarget;

  const loadEmails = useCallback(async (preserveSelectionId = null, forceRefresh = false) => {
    setLoading(true);
    try {
      const emailList = await api.getEmails(forceRefresh);
      setEmails(emailList);

      if (emailList.length > 0) {
        const nextId = preserveSelectionId && emailList.some(e => e._id === preserveSelectionId)
          ? preserveSelectionId
          : emailList[0]._id;
        setSelectedEmailId(nextId);
      } else {
        setSelectedEmailId(null);
      }
    } catch (err) {
      onShowToast(`Failed to load emails: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  // When a newly created email arrives from App.jsx, inject it immediately!
  useEffect(() => {
    if (newlyCreatedEmail && newlyCreatedEmail._id) {
      setEmails(prev => {
        const filtered = prev.filter(e => e._id !== newlyCreatedEmail._id);
        return [newlyCreatedEmail, ...filtered];
      });
      setSelectedEmailId(newlyCreatedEmail._id);
      if (onDraftHandled) onDraftHandled();
    }
  }, [newlyCreatedEmail, onDraftHandled]);

  // When preselectedEmailId changes, select it
  useEffect(() => {
    if (preselectedEmailId) {
      setSelectedEmailId(preselectedEmailId);
    }
  }, [preselectedEmailId]);

  const handleQuickSeedDraft = async () => {
    if (!companies || companies.length === 0) {
      if (onSwitchTab) onSwitchTab('sponsors');
      onShowToast('Please add or select a sponsor in the Sponsors tab first.', 'info');
      return;
    }
    const target = companies[0];
    const targetId = target._id || target.id;
    if (onOpenDraftRequirement) {
      onOpenDraftRequirement(targetId);
      return;
    }
    const targetName = target.name || target.company || 'Top Sponsor';
    setAutoDrafting(true);
    setLocalDraftingTarget({ companyId: targetId, companyName: targetName });
    onShowToast(`⚡ Generating AI proposal draft for ${targetName}...`, 'info');
    try {
      const { res, data } = await api.generateDraft(targetId);
      if (res.ok) {
        if (data?.usedFallback) {
          onShowToast('Draft created using resilient requirements engine.', 'info');
        } else {
          onShowToast('Draft created successfully! Review and approve below.', 'success');
        }
        const createdEmail = data?.data?.email || data?.email;
        if (createdEmail) {
          if (!createdEmail.companyId || typeof createdEmail.companyId === 'string') {
            createdEmail.companyId = target;
          }
          setEmails(prev => [createdEmail, ...prev.filter(e => e._id !== createdEmail._id)]);
          setSelectedEmailId(createdEmail._id);
        } else {
          await loadEmails();
        }
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to generate draft', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setAutoDrafting(false);
      setLocalDraftingTarget(null);
    }
  };

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const selectedEmail = emails.find(e => e._id === selectedEmailId) || null;
  const isCustomDraft = Boolean(
    selectedEmail?.version > 1 ||
    selectedEmail?.isCustomized ||
    (selectedEmail?.customInstructions && selectedEmail.customInstructions.trim())
  );
  // Whenever selected email changes or updates, populate inputs and fetch approval history
  useEffect(() => {
    if (!selectedEmail) {
      setSubjectInput('');
      setBodyInput('');
      setCustomInstructions('');
      setApprovalHistory([]);
      return;
    }

    setSubjectInput(selectedEmail.subject || '');
    setBodyInput(selectedEmail.body || '');
    setCustomInstructions(selectedEmail.customInstructions || '');
    setEventNameInput(selectedEmail.eventName || 'HackFest 2026');
    setEventDatesInput(selectedEmail.eventDates || 'November 14–16, 2026');

    let isMounted = true;
    if (selectedEmail._id) {
      api.getEmail(selectedEmail._id)
        .then(emailData => {
          if (!isMounted) return;
          const fresh = emailData?.email || emailData;
          if (fresh) {
            if (fresh.body) setBodyInput(fresh.body);
            if (fresh.subject && (!selectedEmail.subject || selectedEmail.subject === 'No Subject')) {
              setSubjectInput(fresh.subject);
            }
          }
        })
        .catch(() => {});

      api.getApprovalHistory(selectedEmail._id)
        .then(history => {
          if (isMounted) setApprovalHistory(history);
        })
        .catch(() => {
          if (isMounted) setApprovalHistory([]);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [
    selectedEmailId,
    selectedEmail?._id,
    selectedEmail?.version,
    selectedEmail?.body,
    selectedEmail?.subject,
    selectedEmail?.updatedAt
  ]);

  const handleApprove = async () => {
    if (!selectedEmail) return;

    setActing(true);
    const targetEmailAddress = selectedEmail.companyId?.contactEmail || 'sponsor';
    onShowToast(`🚀 Approving & delivering proposal to ${targetEmailAddress}...`, 'info');
    try {
      const { res, data } = await api.approveEmail(selectedEmail._id, 'Partnerships Director');
      if (res.ok) {
        const recipient = data?.data?.recipient || data?.data?.delivery?.recipient || targetEmailAddress;
        onShowToast(`✓ Email approved & delivered to ${recipient}! Outreach CRM active.`, 'success');
        setEmails(prev => prev.map(e => e._id === selectedEmail._id ? { ...e, status: 'SENT', isApproved: true } : e));
        await loadEmails(selectedEmail._id);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Approval and delivery failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedEmail) return;

    setActing(true);
    onShowToast('Moving draft to rejected rewrite loop...', 'info');
    try {
      const reason = customInstructions?.trim() || 'Revisions requested by reviewer';
      const { res, data } = await api.rejectEmail(selectedEmail._id, reason);
      if (res.ok) {
        onShowToast('Draft rejected and moved back to DRAFT for rewrite loop.', 'warning');
        setEmails(prev => prev.map(e => e._id === selectedEmail._id ? { ...e, status: 'DRAFT', isRejected: true, rejectionReason: reason } : e));
        await loadEmails(selectedEmail._id);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Rejection failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  const handleDeleteDraft = async (emailId, subject = '') => {
    if (!emailId) return;

    // Optimistically remove immediately from local state
    setEmails(prev => {
      const remaining = prev.filter(e => e._id !== emailId);
      if (selectedEmailId === emailId) {
        setSelectedEmailId(remaining.length > 0 ? remaining[0]._id : null);
      }
      return remaining;
    });

    setActing(true);
    try {
      const { res, data } = await api.deleteEmail(emailId, true);
      if (res.ok) {
        onShowToast('Draft removed successfully from queue.', 'info');
        await loadEmails(null, true);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to remove draft', 'error');
        await loadEmails(null, true);
      }
    } catch (err) {
      onShowToast(err.message, 'error');
      await loadEmails(null, true);
    } finally {
      setActing(false);
    }
  };

  const handleRemoveAllRejected = async () => {
    const rejectedCount = emails.filter(e => e.isRejected || e.status === 'REJECTED').length;
    if (rejectedCount === 0) {
      onShowToast('No rejected drafts found in queue.', 'info');
      return;
    }

    setEmails(prev => prev.filter(e => !e.isRejected && e.status !== 'REJECTED'));
    setActing(true);
    try {
      const { res, data } = await api.deleteRejectedEmails();
      if (res.ok) {
        onShowToast(`Removed ${data?.count || rejectedCount} rejected draft(s).`, 'success');
        await loadEmails(null, true);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to remove rejected drafts', 'error');
        await loadEmails(null, true);
      }
    } catch (err) {
      onShowToast(err.message, 'error');
      await loadEmails(null, true);
    } finally {
      setActing(false);
    }
  };

  const handleDeleteAllDrafts = async () => {
    if (emails.length === 0) return;

    setEmails([]);
    setSelectedEmailId(null);
    setActing(true);
    try {
      const { res, data } = await api.deleteAllDrafts();
      if (res.ok) {
        onShowToast(`Cleared ${data?.count ?? emails.length} draft(s). Queue is clean!`, 'success');
        await loadEmails(null, true);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to clear drafts', 'error');
        await loadEmails(null, true);
      }
    } catch (err) {
      onShowToast(err.message, 'error');
      await loadEmails(null, true);
    } finally {
      setActing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEmail) return;
    setSavingEdit(true);
    try {
      const { res, data } = await api.saveEmailEdit({
        emailId: selectedEmail._id,
        subject: subjectInput,
        body: bodyInput,
        notes: 'Human review adjustments'
      });
      if (res.ok) {
        onShowToast('New version saved successfully!', 'success');
        await loadEmails(selectedEmail._id);
      } else {
        onShowToast(data.message || 'Save failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedEmail) return;
    setRegenerating(true);
    onShowToast('Generating tailored AI email copy...', 'info');
    try {
      const activeSubject = subjectInput.trim() || selectedEmail.subject;
      const activeInstructions = customInstructions.trim() || selectedEmail.customInstructions || '';
      const { res, data } = await api.regenerateDraft(selectedEmail._id, {
        customInstructions: activeInstructions,
        subject: activeSubject,
        preserveSubject: preserveSubject,
        eventName: eventNameInput.trim() || 'HackFest 2026',
        eventDates: eventDatesInput.trim() || 'November 14–16, 2026'
      });
      if (res.ok) {
        if (data?.usedFallback) {
          onShowToast('Draft regenerated with custom requirement.', 'info');
        } else {
          onShowToast('✨ New tailored AI email generated! Approval unlocked.', 'success');
        }
        const updatedEmail = data?.data?.email || data?.email;
        if (updatedEmail) {
          if (updatedEmail.body) {
            setBodyInput(updatedEmail.body);
          }
          if (!preserveSubject && updatedEmail.subject) {
            setSubjectInput(updatedEmail.subject);
          } else if (preserveSubject && activeSubject) {
            setSubjectInput(activeSubject);
          }
        }
        await loadEmails(selectedEmail._id);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Regeneration failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSend = async () => {
    if (!selectedEmail) return;
    const defaultRecipient = selectedEmail.companyId?.contactEmail || 'sponsorships@github.com';
    let to = defaultRecipient;
    try {
      const prompted = window.prompt('Recipient sponsor email address:', defaultRecipient);
      if (prompted && prompted.trim()) to = prompted.trim();
    } catch {}

    setActing(true);
    onShowToast(`Send Guard verified status === APPROVED. Dispatching via Gmail to ${to}...`, 'info');
    try {
      const { res, data } = await api.sendEmail(selectedEmail._id, to);
      if (res.ok) {
        onShowToast(`🚀 Email dispatched via Gmail! Thread ID: ${data.data?.threadId || 'OK'}`, 'success');
        setEmails(prev => prev.map(e => e._id === selectedEmail._id ? { ...e, status: 'SENT' } : e));
        await loadEmails(selectedEmail._id);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(`Send Guard Blocked: ${data.message}`, 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  const isApproved = selectedEmail?.status === 'APPROVED';
  const isSent = selectedEmail?.status === 'SENT';
  const rejectedCount = emails.filter(e => e.isRejected || e.status === 'REJECTED').length;
  const selectedEmailIsRejected = Boolean(
    selectedEmail?.isRejected ||
    selectedEmail?.status === 'REJECTED' ||
    (selectedEmail?.status === 'DRAFT' && approvalHistory.some(h => h.decision === 'REJECTED'))
  );

  return (
    <section className="space-y-4">
      {/* Send Guard Reminder Banner */}
      <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center space-x-2">
          <span className="text-base">🛡️</span>
          <span>
            <strong>Human-in-the-Loop Send Guard Active:</strong> Any email in <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">DRAFT</code> or <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">PENDING_APPROVAL</code> is strictly blocked from Gmail. Only approved drafts can be sent.
          </span>
        </div>
        <button
          onClick={() => loadEmails(selectedEmailId)}
          className="text-xs text-amber-300 hover:underline font-medium ml-4 shrink-0"
        >
          Refresh Queue
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Drafts List (Left) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-1 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Drafts Queue</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-medium">
                {emails.length} draft{emails.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              {rejectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleRemoveAllRejected}
                  disabled={acting}
                  title="Remove all rejected drafts from queue"
                  className="px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 text-[10px] font-semibold transition flex items-center space-x-1"
                >
                  <span>🗑️</span>
                  <span>Rejected ({rejectedCount})</span>
                </button>
              )}
              {emails.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllDrafts}
                  disabled={acting}
                  title="Remove all drafts from queue"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 hover:border-red-800/60 border border-slate-700 text-[10px] font-semibold transition flex items-center space-x-1"
                >
                  <span>🗑️</span>
                  <span>Clear Queue</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {activeDrafting && (
              <div className="p-3 rounded-lg border border-emerald-500/50 bg-emerald-950/25 text-left space-y-1 relative overflow-hidden animate-pulse">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 text-xs flex items-center space-x-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                    AI Drafting for {activeDrafting.companyName}...
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                    ⚡ GENERATING
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Synthesizing 6-factor score, tier alignment &amp; custom deliverables...
                </p>
              </div>
            )}
            {loading && emails.length === 0 && !activeDrafting ? (
              <div className="text-xs text-slate-500 text-center py-8">Loading email drafts...</div>
            ) : emails.length === 0 && !activeDrafting ? (
              <div className="text-xs text-slate-500 text-center py-8 space-y-3 px-2">
                <div className="text-2xl">📬</div>
                <p className="font-medium text-slate-400">No drafts in approval queue.</p>
                <p className="text-[11px] text-slate-500">
                  Generate personalized AI proposals from the Sponsors tab or auto-generate one below:
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  {companies.length > 0 && (
                    <button
                      type="button"
                      onClick={handleQuickSeedDraft}
                      disabled={autoDrafting}
                      className="w-full px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition flex items-center justify-center space-x-1 disabled:opacity-50"
                    >
                      <span>{autoDrafting ? '⏳ Generating...' : `⚡ Auto-Draft for ${companies[0].name || 'Top Sponsor'}`}</span>
                    </button>
                  )}
                  {onSwitchTab && (
                    <button
                      type="button"
                      onClick={() => onSwitchTab('sponsors')}
                      className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition"
                    >
                      🏢 View All Sponsors &amp; Draft &rarr;
                    </button>
                  )}
                </div>
              </div>
            ) : (
              emails.map((em) => {
                const isSelected = em._id === selectedEmailId;
                const companyName = em.companyId?.name || (typeof em.companyId === 'string' ? em.companyId : null);
                const isItemRejected = Boolean(em.isRejected || em.status === 'REJECTED');
                const statusBadge = isItemRejected
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : {
                      PENDING_APPROVAL: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                      SENT: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                      DRAFT: 'bg-slate-700 text-slate-300 border-slate-600'
                    }[em.status] || 'bg-slate-800 text-slate-400';

                return (
                  <div
                    key={em._id}
                    onClick={() => setSelectedEmailId(em._id)}
                    className={`p-3 rounded-lg border transition text-left space-y-1 cursor-pointer group relative ${
                      isSelected
                        ? 'border-emerald-500/50 bg-slate-800'
                        : isItemRejected
                        ? 'border-red-900/40 bg-red-950/15 hover:bg-red-950/30'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white text-xs truncate max-w-[170px]">
                        {companyName ? `${companyName}: ` : ''}{em.subject || 'No Subject'}
                      </span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase border ${statusBadge}`}>
                          {isItemRejected ? 'REJECTED' : em.status}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDraft(em._id, em.subject);
                          }}
                          disabled={acting}
                          title={isItemRejected ? 'Remove rejected draft' : 'Remove draft from queue'}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition border border-transparent ${
                            isItemRejected
                              ? 'text-red-400 hover:text-red-200 hover:bg-red-900/50 hover:border-red-800'
                              : 'text-slate-500 hover:text-red-300 hover:bg-red-950/80 hover:border-red-800/60'
                          } flex items-center space-x-0.5`}
                        >
                          <span>🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {(em.body || '').slice(0, 70)}...
                    </p>
                    {isItemRejected && em.rejectionReason && (
                      <div className="text-[10px] text-red-400/90 truncate flex items-center space-x-1 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/30">
                        <span className="font-semibold">Reason:</span>
                        <span className="italic truncate">"{em.rejectionReason}"</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Ask: <strong className="text-slate-400">{em.askType || 'money'}</strong></span>
                      <div className="flex items-center space-x-1">
                        {em.version <= 1 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">Needs AI Gen</span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">v{em.version} Ready</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Draft Reviewer & Actions (Right) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[550px]">
          {!selectedEmail ? (
            activeDrafting ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-20 space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl animate-bounce">
                  ✍️
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-white flex items-center justify-center space-x-2">
                    <span>Drafting AI Proposal for</span>
                    <span className="text-emerald-400 font-semibold">{activeDrafting.companyName}</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Gemini AI is crafting a personalized, high-conversion sponsorship proposal tailored to your hackathon tier and sponsor intelligence.
                  </p>
                </div>
                <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Generating proposal &bull; Landing directly in queue...</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-24 space-y-3 text-center">
                <span className="text-3xl">📝</span>
                <p className="text-slate-400 font-medium">Select an email draft from the left to inspect, edit, or approve.</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Organizers retain total control. You can edit subjects and bodies directly, request AI angle regenerations, or approve for Gmail dispatch.
                </p>
                {emails.length === 0 && companies.length > 0 && (
                  <button
                    type="button"
                    onClick={handleQuickSeedDraft}
                    disabled={autoDrafting}
                    className="mt-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                  >
                    {autoDrafting ? 'Generating AI Proposal...' : `⚡ Generate Sample Draft for ${companies[0].name || 'Sponsor'}`}
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-3.5">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedEmail.companyId?.name && (
                      <span className="text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                        🏢 {selectedEmail.companyId.name}
                      </span>
                    )}
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border font-semibold ${
                      selectedEmailIsRejected
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : isApproved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : isSent
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {selectedEmailIsRejected ? 'REJECTED' : selectedEmail.status}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      v{selectedEmail.version || 1}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold truncate max-w-xs">
                      🏆 {selectedEmail.eventName || 'HackFest 2026'} ({selectedEmail.eventDates || 'Nov 14–16, 2026'})
                    </span>
                  </div>
                  {selectedEmail.companyId?.contactEmail && (
                    <p className="text-[11px] text-slate-400">
                      To: <span className="font-mono text-slate-300 font-medium">{selectedEmail.companyId.contactEmail}</span>
                    </p>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  {isApproved ? (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={acting}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-bold text-xs rounded-lg shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <span>🚀 Send via Gmail</span>
                    </button>
                  ) : isSent ? (
                    <div className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1">
                      <span>✓ Dispatched &amp; CRM Active</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={acting}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <span>{acting ? '🚀 Delivering...' : '✓ Approve & Send to Sponsor'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={acting}
                        className="px-3 py-2 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
                      >
                        ✕ Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(selectedEmail._id, selectedEmail.subject)}
                        disabled={acting}
                        title="Remove this draft from the queue"
                        className="px-2.5 py-2 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 hover:border-red-800/60 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-50 flex items-center space-x-1"
                      >
                        <span>🗑️</span>
                        <span className="hidden sm:inline">Remove Draft</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Single Contextual Alert Banner */}
              {selectedEmailIsRejected ? (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <span>⚠️</span>
                    <span className="truncate"><strong>Draft Rejected:</strong> {selectedEmail.rejectionReason || 'Reviewer requested revisions.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="ml-2 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold rounded shrink-0 transition"
                  >
                    Rewrite with AI
                  </button>
                </div>
              ) : isSent ? (
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <span>🚀</span>
                    <span className="truncate"><strong>Dispatched &amp; CRM Active:</strong> Delivered to sponsor. Automated follow-up registered in Outreach CRM.</span>
                  </div>
                  {onSwitchTab && (
                    <button
                      type="button"
                      onClick={() => onSwitchTab('outreach')}
                      className="ml-2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded shrink-0 transition"
                    >
                      View CRM &rarr;
                    </button>
                  )}
                </div>
              ) : isApproved ? (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                  <span>✅</span>
                  <span><strong>Approved &amp; Ready:</strong> Human review complete. Click <strong>"Send via Gmail"</strong> to dispatch.</span>
                </div>
              ) : (selectedEmail?.customInstructions || customInstructions) ? (
                <div className="px-3 py-2 rounded-lg bg-purple-950/40 border border-purple-800/50 text-purple-200 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-purple-400 font-bold">🎯 Target Requirement:</span>
                    <span className="truncate italic font-medium">"{customInstructions || selectedEmail.customInstructions}"</span>
                  </div>
                  <span className="text-[10px] text-purple-400 font-mono shrink-0 ml-2">Tailored by AI</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-[11px] flex items-center space-x-2">
                  <span>⚡</span>
                  <span><strong>Instant Delivery:</strong> Approving this proposal will immediately dispatch it to the sponsor's email and create an active Outreach CRM record.</span>
                </div>
              )}

              {/* Subject Line Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Subject Line</label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={preserveSubject}
                      onChange={(e) => setPreserveSubject(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-3 h-3"
                    />
                    <span>Lock Subject on AI Regenerate</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Enter proposal subject line..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-medium focus:border-emerald-500/60 focus:outline-none"
                />
              </div>

              {/* Email Body Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Content</label>
                  <span className="text-[10px] text-slate-500">Full markdown &amp; plain text preview</span>
                </div>
                <textarea
                  rows={9}
                  value={bodyInput}
                  onChange={(e) => setBodyInput(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono leading-relaxed resize-none focus:border-emerald-500/60 focus:outline-none"
                  placeholder="Email body text..."
                />
              </div>

              {/* Unified AI Requirement & Save Controls */}
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Sponsor requirement (e.g. $5k cash bounty, free credits, workshop presence)..."
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:border-purple-500/60 focus:outline-none"
                  />
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50 flex items-center space-x-1.5 shadow-sm"
                    >
                      <span>{regenerating ? '⏳ Generating...' : '✨ Regenerate with AI'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving...' : '💾 Save Text'}
                    </button>
                  </div>
                </div>

                {/* Event Name & Dates Quick Inputs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                  <div className="flex items-center space-x-1.5 flex-1">
                    <span className="text-slate-400 font-semibold shrink-0">🏆 Event:</span>
                    <input
                      type="text"
                      value={eventNameInput}
                      onChange={(e) => setEventNameInput(e.target.value)}
                      placeholder="e.g. HackFest 2026"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 focus:border-purple-500/60 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 flex-1">
                    <span className="text-slate-400 font-semibold shrink-0">📅 Dates:</span>
                    <input
                      type="text"
                      value={eventDatesInput}
                      onChange={(e) => setEventDatesInput(e.target.value)}
                      placeholder="e.g. November 14–16, 2026"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 focus:border-purple-500/60 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Collapsible Audit Trail */}
              <div className="border-t border-slate-800/80 pt-2">
                <button
                  type="button"
                  onClick={() => setAuditTrailOpen(!auditTrailOpen)}
                  className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 py-1"
                >
                  <span className="flex items-center space-x-1.5">
                    <span>📜</span>
                    <span className="font-semibold uppercase tracking-wider">Approval History</span>
                    <span className="text-slate-500">({approvalHistory.length} event{approvalHistory.length === 1 ? '' : 's'})</span>
                  </span>
                  <span>{auditTrailOpen ? '▲ Hide' : '▼ View History'}</span>
                </button>

                {auditTrailOpen && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                    {approvalHistory.length === 0 ? (
                      <p className="text-slate-500 text-[11px] py-1">No approval actions recorded yet.</p>
                    ) : (
                      approvalHistory.map((l, idx) => (
                        <div
                          key={l._id || idx}
                          className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`font-bold ${l.decision === 'APPROVED' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {l.decision}
                            </span>
                            <span className="text-slate-400">by {l.reviewerName || 'Reviewer'}</span>
                            {l.notes && <span className="text-slate-500 italic truncate max-w-xs">"{l.notes}"</span>}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {l.decidedAt ? new Date(l.decidedAt).toLocaleTimeString() : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
