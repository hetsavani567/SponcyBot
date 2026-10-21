import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';

export default function DemoSimulationModal({
  isOpen,
  onClose,
  onSuccess,
  onShowToast
}) {
  const [steps, setSteps] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  // Keep stable reference to onSuccess to prevent infinite re-render loops
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const timerRef = useRef(null);
  const hasTriggeredRef = useRef(false);

  const startSimulation = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setLoading(true);
    setError(null);
    setSteps([]);
    setVisibleCount(0);
    setIsComplete(false);

    try {
      const { res, data } = await api.runSimulation({
        companyName: 'CloudScale Compute Systems',
        reviewerName: 'ACM Partnerships Lead',
        simulateReply: 'INTERESTED'
      });

      if (res.ok && data?.data?.timeline && Array.isArray(data.data.timeline)) {
        const fullTimeline = data.data.timeline;
        setSteps(fullTimeline);
        setLoading(false);

        // Progressively reveal steps smoothly (130ms per step) for an engaging live simulation
        let currentIdx = 0;
        timerRef.current = setInterval(() => {
          currentIdx += 1;
          setVisibleCount(currentIdx);

          if (currentIdx >= fullTimeline.length) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            setIsComplete(true);
            if (onSuccessRef.current) {
              onSuccessRef.current();
            }
          }
        }, 130);
      } else {
        setLoading(false);
        setError(data?.message || 'Simulation execution failed');
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Simulation execution failed');
    }
  };

  const handleFastForward = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setVisibleCount(steps.length);
    setIsComplete(true);
    if (!isComplete && onSuccessRef.current) {
      onSuccessRef.current();
    }
  };

  // Run strictly once when isOpen transitions to true
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      hasTriggeredRef.current = false;
      setSteps([]);
      setVisibleCount(0);
      setLoading(false);
      setError(null);
      setIsComplete(false);
      return;
    }

    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      startSimulation();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSteps = steps.length || 12;
  const progressPercent = steps.length > 0 ? Math.min(100, Math.round((visibleCount / totalSteps) * 100)) : 10;
  const activeStep = steps[visibleCount - 1];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[88vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-sm">
              ⚡
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">SponcyBot 12-Step Lifecycle Simulation</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {isComplete ? 'COMPLETED' : loading ? 'RUNNING' : 'STEP-BY-STEP'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous workflow · Send Guard security · Gmail dispatch · Meeting booked</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center transition"
          >
            &times;
          </button>
        </div>

        {/* Live Progress Bar */}
        <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              {loading
                ? 'Initializing Simulation Engine...'
                : isComplete
                ? '✅ All 12 Stages Successfully Executed'
                : `Simulating Step ${visibleCount} of ${totalSteps}: ${activeStep?.title || 'Processing...'}`}
            </span>
            <span className="font-mono text-emerald-400 font-bold text-[11px]">
              {loading ? '...' : `${progressPercent}%`}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Scrollable Timeline */}
        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 text-xs min-h-[260px]">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-400 text-xs font-medium">
                Executing full-stack lifecycle across Research, Gemini AI, Send Guard & Outreach CRM...
              </p>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-lg flex items-center justify-center mx-auto">
                ⚠️
              </div>
              <p className="text-red-400 text-xs font-semibold">Simulation failed: {error}</p>
              <button
                type="button"
                onClick={startSimulation}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition"
              >
                🔄 Retry Simulation
              </button>
            </div>
          ) : steps.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No simulation steps received.
            </div>
          ) : (
            <>
              {steps.slice(0, visibleCount).map((s) => {
                const ownerColor = {
                  'Research': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  'Email AI': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                  'Outreach CRM': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                  'Gmail': 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }[s.owner] || 'bg-slate-800 text-slate-300 border-slate-700';

                return (
                  <div
                    key={s.step}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3 transition-all duration-200 hover:border-slate-700"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-white shrink-0 mt-0.5">
                      {s.step}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs">{s.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${ownerColor}`}>
                          {s.owner}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{s.details}</p>
                    </div>
                  </div>
                );
              })}

              {isComplete && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs mt-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-lg">🎉</span>
                    <div>
                      <p className="font-bold text-emerald-200">Simulation Complete: Meeting Booked!</p>
                      <p className="text-[11px] text-emerald-400/90">
                        Golden Rule verified: AI drafted ➔ Human approved ➔ Gmail dispatched ➔ Meeting scheduled.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center space-x-2">
            {!loading && steps.length > 0 && !isComplete && (
              <button
                type="button"
                onClick={handleFastForward}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
              >
                ⏩ Fast-Forward
              </button>
            )}
            {!loading && steps.length > 0 && (
              <button
                type="button"
                onClick={startSimulation}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <span>🔄</span>
                <span>Replay Demo</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-md shadow-emerald-500/20"
          >
            {isComplete ? 'Done & Return to Dashboard' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
