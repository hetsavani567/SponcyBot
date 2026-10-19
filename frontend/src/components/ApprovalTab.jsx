import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

export default function ApprovalTab({ onShowToast, onRefreshStats }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [acting, setActing] = useState(false);

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

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const selectedEmail = emails.find(e => e._id === selectedEmailId) || null;

  // Whenever selected email changes, populate inputs and fetch approval history
  useEffect(() => {
    if (selectedEmail) {
      setSubjectInput(selectedEmail.subject || '');
      setBodyInput(selectedEmail.body || '');

      // Load approval history
      api.getApprovalHistory(selectedEmail._id)
        .then(history => setApprovalHistory(history))
        .catch(() => setApprovalHistory([]));
    } else {
      setSubjectInput('');
      setBodyInput('');
      setApprovalHistory([]);
    }
  }, [selectedEmailId, selectedEmail]);

  const handleApprove = async () => {
    if (!selectedEmail) return;
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
    onShowToast('Regenerating new draft with dynamic prompt angle...', 'info');
    try {
      const { res, data } = await api.regenerateDraft(selectedEmail._id, 'Emphasize student builder community and resume books');
      if (res.ok) {
        onShowToast('New draft version created!', 'success');
        await loadEmails(selectedEmail._id);
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
    const to = window.prompt('Recipient sponsor email address:', 'sponsorships@techcorp.io');
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Drafts Queue</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {emails.length} drafts
            </span>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {loading && emails.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">Loading email drafts...</div>
            ) : emails.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">
                No drafts available. Generate one from the Sponsors screen!
              </div>
            ) : (
              emails.map((em) => {
                const isSelected = em._id === selectedEmailId;
                const statusBadge = {
                  PENDING_APPROVAL: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  SENT: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                  DRAFT: 'bg-slate-700 text-slate-300 border-slate-600'
                }[em.status] || 'bg-slate-800 text-slate-400';

                return (
                  <div
                    key={em._id}
                    onClick={() => setSelectedEmailId(em._id)}
                    className={`p-3 rounded-lg border transition text-left space-y-1 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500/50 bg-slate-800'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs truncate max-w-[180px]">
                        {em.subject || 'No Subject'}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase border ${statusBadge}`}>
                        {em.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {(em.body || '').slice(0, 70)}...
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Ask: <strong className="text-slate-400">{em.askType || 'money'}</strong></span>
                      <span>v{em.version || 1}</span>
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
            <div className="flex items-center justify-center h-full text-slate-500 text-xs py-24">
              Select an email draft from the left to inspect, edit, or approve.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded border ${
                      isApproved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : isSent
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      Status: {selectedEmail.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Version: <strong>v{selectedEmail.version || 1}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Email ID: <span className="font-mono text-slate-500">{selectedEmail._id}</span>
                  </p>
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
                      <button
                        onClick={handleApprove}
                        disabled={acting}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow-sm disabled:opacity-50"
                      >
                        ✓ Approve Draft
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={acting}
                        className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-medium text-xs rounded-lg transition disabled:opacity-50"
                      >
                        ✕ Reject & Rewrite
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Send Guard status banner */}
              {!isApproved && !isSent && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
                  <span>🛡️</span>
                  <span><strong>Send Guard Locked:</strong> This email cannot be sent via Gmail API until a human reviewer explicitly approves it.</span>
                </div>
              )}

              {/* Editable Subject */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Subject Line</label>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-medium focus:border-emerald-500/60 focus:outline-none"
                />
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
              <div className="flex items-center space-x-2 pt-1 border-b border-slate-800 pb-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : '💾 Save Edit as New Version'}
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition disabled:opacity-50"
                >
                  {regenerating ? 'Regenerating...' : '🔄 AI Regenerate (New Angle)'}
                </button>
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
