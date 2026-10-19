import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';

export default function DemoSimulationModal({
  isOpen,
  onClose,
  onSuccess,
  onShowToast
}) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const runDemo = async () => {
      setLoading(true);
      setError(null);
      setSteps([]);
      try {
        const { res, data } = await api.runSimulation({
          companyName: 'CloudScale Compute Systems',
          reviewerName: 'ACM Partnerships Lead',
          simulateReply: 'INTERESTED'
        });

        if (res.ok && data?.data?.timeline) {
          setSteps(data.data.timeline);
          if (onSuccess) onSuccess();
        } else {
          setError(data.message || 'Simulation execution failed');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    runDemo();
  }, [isOpen, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚡</span>
            <div>
              <h3 className="text-base font-bold text-white">SponcyBot 12-Step Lifecycle Simulation</h3>
              <p className="text-xs text-slate-400">Complete end-to-end autonomous sponsorship workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
              Running live 12-step SponcyBot lifecycle simulation across all engines...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-400 text-xs">
              Simulation failed: {error}
            </div>
          ) : steps.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No simulation steps received.
            </div>
          ) : (
            steps.map((s) => {
              const ownerColor = {
                'Research': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                'Email AI': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                'Outreach CRM': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                'Gmail': 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }[s.owner] || 'bg-slate-800 text-slate-300 border-slate-700';

              return (
                <div
                  key={s.step}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start space-x-3"
                >
                  <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-white shrink-0 mt-0.5">
                    {s.step}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-xs">{s.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold border ${ownerColor}`}>
                        {s.owner}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{s.details}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs rounded-lg transition shadow"
          >
            Close & Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
