import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

export default function ApprovalTab({ onShowToast, onRefreshStats, onSwitchTab, companies = [] }) {
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
  const [preserveSubject, setPreserveSubject] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');

  const loadEmails = useCallback(async (preserveSelectionId = null) => {
    setLoading(true);
    try {
      const emailList = await api.getEmails();
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

  const handleQuickSeedDraft = async () => {
    if (!companies || companies.length === 0) {
      if (onSwitchTab) onSwitchTab('sponsors');
      onShowToast('Please add or select a sponsor in the Sponsors tab first.', 'info');
      return;
    }
    const target = companies[0];
    const targetId = target._id || target.id;
    setAutoDrafting(true);
    onShowToast(`Generating AI proposal draft for ${target.name || target.company}...`, 'info');
    try {
      const { res, data } = await api.generateDraft(targetId);
      if (res.ok) {
        onShowToast('Draft created successfully! Review and approve below.', 'success');
        const generatedEmailId = data?.data?.email?._id || data?.email?._id;
        await loadEmails(generatedEmailId);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to generate draft', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setAutoDrafting(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const selectedEmail = emails.find(e => e._id === selectedEmailId) || null;
  const hasRegenerated = Boolean(selectedEmail?.version > 1);
  const canApprove = hasRegenerated;

  // Whenever selected email changes or updates, populate inputs and fetch approval history
  useEffect(() => {
    if (!selectedEmail) {
      setSubjectInput('');
      setBodyInput('');
      setApprovalHistory([]);
      return;
    }

    setSubjectInput(selectedEmail.subject || '');
    setBodyInput(selectedEmail.body || '');

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

    if (!canApprove) {
      onShowToast('Repetition Guard: Direct approval locked. Please click "Generate New AI Email" first to personalize this outreach and eliminate repetition.', 'warning');
      return;
    }

    const reviewer = window.prompt('Reviewer Name (or press OK for default):', 'Partnerships Director') || 'Partnerships Director';
    setActing(true);
    try {
      const { res, data } = await api.approveEmail(selectedEmail._id, reviewer);
      if (res.ok) {
        onShowToast('Email approved! Send Guard now permits outbound send.', 'success');
        await loadEmails(selectedEmail._id);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Approval failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedEmail) return;
    const reason = window.prompt('Reason for rejection (guides rewrite loop):', 'Needs to highlight cloud credits and student bounty track.');
    if (!reason) return;

    setActing(true);
    try {
      const { res, data } = await api.rejectEmail(selectedEmail._id, reason);
      if (res.ok) {
        onShowToast('Draft rejected and moved back to DRAFT for rewrite loop.', 'warning');
        await loadEmails(selectedEmail._id);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Rejection failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  const handleDeleteDraft = async (emailId, subject = '') => {
    if (!window.confirm(`Are you sure you want to permanently remove this draft${subject ? ` ("${subject.slice(0, 30)}...")` : ''}?`)) {
      return;
    }
    setActing(true);
    try {
      const { res, data } = await api.deleteEmail(emailId);
      if (res.ok) {
        onShowToast('Draft removed successfully from queue.', 'info');
        await loadEmails(selectedEmailId === emailId ? null : selectedEmailId);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to remove draft', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
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
    if (!window.confirm(`Remove all ${rejectedCount} rejected draft(s) from the queue?`)) {
      return;
    }
    setActing(true);
    try {
      const { res, data } = await api.deleteRejectedEmails();
      if (res.ok) {
        onShowToast(`Removed ${data?.count || rejectedCount} rejected draft(s).`, 'success');
        await loadEmails(null);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to remove rejected drafts', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  };

  const handleDeleteAllDrafts = async () => {
    if (emails.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove all ${emails.length} draft(s) from the queue? This will clear any mock or test drafts.`)) {
      return;
    }
    setActing(true);
    try {
      const { res, data } = await api.deleteAllDrafts();
      if (res.ok) {
        onShowToast(`Cleared ${data?.count ?? emails.length} draft(s). Queue is clean!`, 'success');
        setSelectedEmailId(null);
        await loadEmails(null);
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data?.message || 'Failed to clear drafts', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
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
    onShowToast('Generating new personalized AI email version...', 'info');
    try {
      const activeSubject = subjectInput.trim() || selectedEmail.subject;
      const { res, data } = await api.regenerateDraft(selectedEmail._id, {
        customInstructions: customInstructions.trim(),
        subject: activeSubject,
        preserveSubject: preserveSubject
      });
      if (res.ok) {
        onShowToast('✨ New unique AI email generated! Repetition check passed & approval unlocked.', 'success');
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
    const defaultRecipient = selectedEmail.companyId?.contactEmail || '';
    const to = window.prompt('Recipient sponsor email address:', defaultRecipient);
    if (!to) return;

    setActing(true);
    onShowToast('Send Guard checking status === APPROVED before dispatch...', 'info');
    try {
      const { res, data } = await api.sendEmail(selectedEmail._id, to);
      if (res.ok) {
        onShowToast(`Email dispatched via Gmail! Thread ID: ${data.data?.threadId || 'OK'}`, 'success');
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
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Drafts Queue</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {emails.length} drafts
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              {rejectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleRemoveAllRejected}
                  disabled={acting}
                  title="Remove all rejected drafts from queue"
                  className="px-2 py-0.5 rounded bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 text-[10px] font-semibold transition flex items-center space-x-1"
                >
                  <span>🗑️ Rejected ({rejectedCount})</span>
                </button>
              )}
              {emails.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllDrafts}
                  disabled={acting}
                  title="Clear all drafts from queue (removes mock/test drafts)"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 border border-slate-700 text-[10px] font-semibold transition flex items-center space-x-1"
                >
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {loading && emails.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">Loading email drafts...</div>
            ) : emails.length === 0 ? (
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
                          title={isItemRejected ? 'Remove rejected draft' : 'Remove draft'}
                          className={`p-1 rounded text-xs transition ${
                            isItemRejected
                              ? 'text-red-400 hover:text-red-200 hover:bg-red-900/50'
                              : 'text-slate-500 hover:text-red-400 hover:bg-slate-800'
                          }`}
                        >
                          🗑️
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
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded border ${
                      selectedEmailIsRejected
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : isApproved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : isSent
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      Status: {selectedEmailIsRejected ? 'REJECTED' : selectedEmail.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Version: <strong>v{selectedEmail.version || 1}</strong>
                    </span>
                    {selectedEmail.companyId?.name && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 font-medium">
                        🏢 {selectedEmail.companyId.name}
                      </span>
                    )}
                  </div>
                  {selectedEmail.companyId?.contactEmail && (
                    <p className="text-xs text-slate-400 mt-1">
                      Recipient: <span className="font-mono text-emerald-400">{selectedEmail.companyId.contactEmail}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {isApproved ? (
                    <button
                      onClick={handleSend}
                      disabled={acting}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <span>🚀 Send via Gmail</span>
                    </button>
                  ) : isSent ? (
                    <div className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1">
                      <span>✓ Dispatched to Gmail</span>
                    </div>
                  ) : (
                    <>
                      {!canApprove ? (
                        <>
                          <button
                            type="button"
                            disabled={true}
                            title="Approval locked: You must generate a new personalized AI email version first to eliminate repetition."
                            className="px-3 py-1.5 bg-slate-800 text-slate-500 border border-slate-700 font-medium text-xs rounded-lg cursor-not-allowed flex items-center space-x-1"
                          >
                            <span>🔒 Approve (Locked)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            disabled={regenerating}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-purple-500/25 transition flex items-center space-x-1.5 disabled:opacity-50 animate-pulse"
                          >
                            <span>{regenerating ? '⏳ Generating...' : '✨ Generate New AI Email (Unlock)'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={acting}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50 flex items-center space-x-1"
                        >
                          <span>✓ Approve Draft</span>
                        </button>
                      )}
                      <button
                        onClick={handleReject}
                        disabled={acting}
                        className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-medium text-xs rounded-lg transition disabled:opacity-50"
                      >
                        ✕ Reject & Rewrite
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(selectedEmail._id, selectedEmail.subject)}
                        disabled={acting}
                        title="Permanently remove this draft from the queue"
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-red-950/80 hover:border-red-800/80 text-slate-400 hover:text-red-300 font-medium text-xs rounded-lg border border-slate-700 transition flex items-center space-x-1 disabled:opacity-50"
                      >
                        <span>🗑️ Remove</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Rejection Alert Banner if rejected */}
              {selectedEmailIsRejected && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <strong>Draft Rejected:</strong> {selectedEmail.rejectionReason || approvalHistory.find(h => h.decision === 'REJECTED')?.notes || 'Reviewer requested rewrite or discard.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(selectedEmail._id, selectedEmail.subject)}
                    disabled={acting}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold shadow transition shrink-0 ml-3 flex items-center space-x-1"
                  >
                    <span>🗑️ Remove Draft</span>
                  </button>
                </div>
              )}

              {/* Repetition Guard Alert Banner (if draft has not been personalized/regenerated) */}
              {!canApprove && !isApproved && !isSent && !selectedEmailIsRejected && (
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🛡️</span>
                    <div>
                      <strong>Repetition Guard Active:</strong> Default template drafts cannot be approved directly to prevent sending generic, repetitive emails. Click <strong>"Generate New AI Email"</strong> to produce unique, personalized copy and unlock approval.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded text-xs shrink-0 ml-3 transition shadow"
                  >
                    {regenerating ? 'Generating...' : '✨ Generate New Email'}
                  </button>
                </div>
              )}

              {/* Unlocked Confirmation Banner */}
              {canApprove && !isApproved && !isSent && !selectedEmailIsRejected && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                  <span>✓</span>
                  <span><strong>Personalized AI Draft (v{selectedEmail.version}):</strong> Repetition check passed &amp; approval unlocked. Review subject and body below, then approve for Gmail dispatch.</span>
                </div>
              )}

              {/* Send Guard status banner */}
              {!isApproved && !isSent && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
                  <span>🛡️</span>
                  <span><strong>Human-in-the-Loop Send Guard Active:</strong> Any email in <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">DRAFT</code> or <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">PENDING_APPROVAL</code> is strictly blocked from Gmail. Only approved drafts can be sent.</span>
                </div>
              )}

              {/* Editable Subject */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Subject Line</label>
                  {subjectInput !== (selectedEmail.subject || '') && (
                    <span className="text-amber-400 text-[10px] font-mono">● Custom edits active</span>
                  )}
                </div>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Enter personalized subject line..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-medium focus:border-emerald-500/60 focus:outline-none"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={preserveSubject}
                      onChange={(e) => setPreserveSubject(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Lock &amp; Keep this custom Subject Line when generating new AI emails</span>
                  </label>
                  {preserveSubject && subjectInput.trim() && (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                      <span>🔒</span>
                      <span>Subject Protected</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Editable Body */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Body</label>
                  <span className="text-[10px] text-slate-500">Edit text before approving</span>
                </div>
                <textarea
                  rows={9}
                  value={bodyInput}
                  onChange={(e) => setBodyInput(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono leading-relaxed resize-none focus:border-emerald-500/60 focus:outline-none"
                />
              </div>

              {/* Quick Edit & Regenerate Controls */}
              <div className="space-y-2 pt-1 border-b border-slate-800 pb-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Optional prompt angle (e.g. emphasize cloud credits, hiring, or workshop tracks)"
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:border-purple-500/60 focus:outline-none"
                  />
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50 shrink-0 flex items-center space-x-1 shadow-sm"
                    >
                      <span>{regenerating ? '⏳ Generating...' : '🔄 Generate New AI Email'}</span>
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition disabled:opacity-50 shrink-0"
                    >
                      {savingEdit ? 'Saving...' : '💾 Save Current Version'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Trail / Version History */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Approval Audit Trail</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {approvalHistory.length === 0 ? (
                    <p className="text-slate-500 text-[11px]">No approval actions recorded yet.</p>
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
                          <span className="text-slate-400">by {l.reviewerName || 'Human'}</span>
                          {l.notes && <span className="text-slate-500 italic">"{l.notes}"</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {l.decidedAt ? new Date(l.decidedAt).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </section>
  );
}
