import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';

export default function SimulateReplyModal({
  isOpen,
  target,
  onClose,
  onSuccess,
  onShowToast
}) {
  const [replyText, setReplyText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [classification, setClassification] = useState(null);

  const setPreset = (type) => {
    if (type === 'INTERESTED') {
      setReplyText(
        `Hi Team,\n\nThanks for reaching out! We are definitely interested in supporting the ACM Hackathon. Could you send over the Gold tier deliverables deck? Let's connect on a 15-minute call this Thursday.`
      );
    } else if (type === 'DECLINED') {
      setReplyText(
        `Hello,\n\nThank you for thinking of us. Unfortunately our university sponsorship budget for this quarter is fully committed, so we will have to pass this year.`
      );
    } else {
      setReplyText(
        `Hi,\n\nI am currently out of office on business travel until next Tuesday. Please follow up with me next week.`
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPreset('INTERESTED');
      setClassification(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!replyText.trim()) {
      onShowToast('Please enter sponsor reply text to classify', 'warning');
      return;
    }

    setAnalyzing(true);
    onShowToast('Analyzing sponsor reply sentiment with AI...', 'info');
    try {
      const { res, data } = await api.classifyReply({
        replyText: replyText.trim(),
        companyName: target?.companyName || 'Sponsor Company',
        threadId: target?.threadId || `thread_${Date.now()}`
      });

      if (res.ok && data?.data) {
        setClassification(data.data);
      } else {
        onShowToast(data.message || 'Classification failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmOutcome = async () => {
    const label = classification?.suggestedLabel || 'INTERESTED';
    setConfirming(true);
    onShowToast(`Confirming reply outcome: ${label}...`, 'info');
    try {
      const { res, data } = await api.confirmReplyOutcome({
        threadId: target?.threadId || `thread_${Date.now()}`,
        outreachId: target?.outreachId,
        label,
        confirmedBy: 'Partnerships Director',
        notes: `Simulated inbound sponsor reply confirmed as ${label}`
      });

      if (res.ok) {
        onShowToast(`Outcome confirmed! Outreach status updated to ${label}.`, 'success');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        onShowToast(data.message || 'Confirmation failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setConfirming(false);
    }
  };

  const badgeColor = {
    INTERESTED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    DECLINED: 'bg-red-500/20 text-red-300 border-red-500/40',
    OTHER: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  }[classification?.suggestedLabel] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="text-base font-bold text-white">Simulate Sponsor Reply</h3>
              <p className="text-xs text-slate-400">Test AI Sentiment Classification & Human Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Preset Selector */}
          <div>
            <label className="block text-slate-300 mb-1">Choose Preset Response Template:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPreset('INTERESTED')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-left font-medium transition"
              >
                ✓ Interested (Call)
              </button>
              <button
                type="button"
                onClick={() => setPreset('DECLINED')}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-left font-medium transition"
              >
                ✕ Declined (Budget)
              </button>
              <button
                type="button"
                onClick={() => setPreset('AMBIGUOUS')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-left font-medium transition"
              >
                ⏳ Out of Office
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Sponsor Reply Text:</label>
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white resize-none font-mono focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition shadow-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <span>{analyzing ? 'Analyzing with AI...' : '🧠 Analyze Intent with AI'}</span>
          </button>

          {/* AI Output Box */}
          {classification && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Suggested Label:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${badgeColor}`}>
                    {classification.suggestedLabel}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Confidence: {classification.confidence || 'HIGH'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {classification.reason || 'AI classified intent based on sponsor message.'}
              </p>

              <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleConfirmOutcome}
                  disabled={confirming}
                  className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {confirming
                    ? 'Updating...'
                    : `Confirm Outcome '${classification.suggestedLabel}' & Update CRM`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
