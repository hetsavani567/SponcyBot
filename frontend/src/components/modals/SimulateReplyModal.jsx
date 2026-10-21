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
  const [selectedOutcome, setSelectedOutcome] = useState('INTERESTED');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [classification, setClassification] = useState(null);

  const presets = {
    INTERESTED: `Hi Team,\n\nThanks for reaching out! We are definitely interested in supporting your hackathon. Could you send over the sponsorship deliverables deck? Let's connect on a 15-minute call this Thursday.`,
    DECLINED: `Hello,\n\nThank you for thinking of us. Unfortunately our university sponsorship budget for this quarter is fully committed, so we will have to pass this year.`,
    OUT_OF_OFFICE: `Hi,\n\nI am currently out of office on business travel until next Tuesday with limited access to email. Please follow up with me next week.`,
    'WAITING FOR REPLY': `Hi Team,\n\nCould you clarify the expected attendee demographic and technical workshop requirements? We are reviewing internally.`
  };

  const handleSelectOutcome = (outcome) => {
    setSelectedOutcome(outcome);
    setReplyText(presets[outcome] || '');
    setClassification(null);
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedOutcome('INTERESTED');
      setReplyText(presets.INTERESTED);
      setClassification(null);
      setAnalyzing(false);
      setConfirming(false);
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
        const suggested = data.data.suggestedLabel;
        if (suggested) {
          if (['INTERESTED', 'APPROVED'].includes(suggested)) setSelectedOutcome('INTERESTED');
          else if (['DECLINED', 'DENIED'].includes(suggested)) setSelectedOutcome('DECLINED');
          else if (['OUT_OF_OFFICE', 'OUT OF OFFICE', 'OTHER'].includes(suggested)) setSelectedOutcome('OUT_OF_OFFICE');
          else setSelectedOutcome('WAITING FOR REPLY');
        }
        onShowToast(`AI suggested label: ${suggested}`, 'info');
      } else {
        onShowToast(data.message || 'Classification failed, using selected outcome', 'warning');
      }
    } catch (err) {
      onShowToast(`AI Analysis: ${err.message}`, 'warning');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmOutcome = async () => {
    const label = selectedOutcome || classification?.suggestedLabel || 'INTERESTED';
    setConfirming(true);
    onShowToast(`Confirming reply outcome: ${label}...`, 'info');
    try {
      const { res, data } = await api.confirmReplyOutcome({
        threadId: target?.threadId || `thread_${Date.now()}`,
        outreachId: target?.outreachId,
        label,
        confirmedBy: 'Partnerships Director',
        notes: replyText.trim() || `Sponsor inbound reply recorded as ${label}`
      });

      if (res.ok) {
        onShowToast(`Outcome confirmed! Outreach for ${target?.companyName || 'Sponsor'} updated to ${label}.`, 'success');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        onShowToast(data?.message || 'Confirmation failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">💬</span>
            <div>
              <h3 className="text-base font-bold text-white">Record Sponsor Reply</h3>
              <p className="text-xs text-slate-400">
                Log inbound response for <strong className="text-emerald-300">{target?.companyName || 'Sponsor'}</strong> &amp; update CRM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Outcome Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Select Sponsor Outcome / Status:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSelectOutcome('INTERESTED')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  selectedOutcome === 'INTERESTED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="text-xs">✓ Approved</div>
                <div className="text-[10px] text-emerald-400/80 font-normal mt-0.5">Interested / Meeting</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('DECLINED')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  selectedOutcome === 'DECLINED'
                    ? 'bg-red-500/20 text-red-300 border-red-500 font-bold shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="text-xs">✕ Denied</div>
                <div className="text-[10px] text-red-400/80 font-normal mt-0.5">Declined / Budget Full</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('OUT_OF_OFFICE')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  selectedOutcome === 'OUT_OF_OFFICE'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500 font-bold shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="text-xs">⏳ Out of Office</div>
                <div className="text-[10px] text-orange-400/80 font-normal mt-0.5">Auto-Reply Reschedule</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('WAITING FOR REPLY')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  selectedOutcome === 'WAITING FOR REPLY'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500 font-bold shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="text-xs">💬 General Reply</div>
                <div className="text-[10px] text-indigo-400/80 font-normal mt-0.5">Inquiry / In Review</div>
              </button>
            </div>
          </div>

          {/* Reply Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">Inbound Message Content:</label>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 underline disabled:opacity-50"
              >
                <span>{analyzing ? 'Analyzing...' : '🧠 AI Auto-Detect Intent'}</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white resize-none font-mono focus:outline-none focus:border-indigo-500/60"
              placeholder="Paste or edit sponsor's incoming message..."
            />
          </div>

          {/* AI Output Box if analyzed */}
          {classification && (
            <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-indigo-300 font-medium">AI Analysis:</span>
                <span className="font-bold text-white uppercase">{classification.suggestedLabel}</span>
                <span className="text-[11px] text-slate-400">({classification.reason || 'Detected from message'})</span>
              </div>
              <span className="text-[10px] text-indigo-400 font-mono">Confidence: {classification.confidence || 'HIGH'}</span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
          <button
            type="button"
            onClick={handleConfirmOutcome}
            disabled={confirming}
            className={`flex-1 px-4 py-2.5 font-semibold rounded-xl text-xs text-white transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 ${
              selectedOutcome === 'INTERESTED'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : selectedOutcome === 'DECLINED'
                ? 'bg-red-600 hover:bg-red-500'
                : selectedOutcome === 'OUT_OF_OFFICE'
                ? 'bg-orange-600 hover:bg-orange-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            <span>
              {confirming
                ? 'Updating Outreach Status...'
                : `✓ Confirm Sponsor Reply as '${
                    selectedOutcome === 'INTERESTED'
                      ? 'Approved (Interested)'
                      : selectedOutcome === 'DECLINED'
                      ? 'Denied (Declined)'
                      : selectedOutcome === 'OUT_OF_OFFICE'
                      ? 'Out of Office'
                      : 'Reply Received'
                  }' & Update CRM`}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
