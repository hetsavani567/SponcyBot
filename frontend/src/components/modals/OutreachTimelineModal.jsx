import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';

export default function OutreachTimelineModal({
  isOpen,
  outreachId,
  companyName = 'Sponsor',
  onClose
}) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !outreachId) return;

    setLoading(true);
    setError(null);
    api.getOutreachTimeline(outreachId)
      .then((events) => {
        setTimeline(Array.isArray(events) ? events : []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, outreachId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Outreach Audit Trail</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-normal">
                {companyName}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Complete chronological history of events and status transitions
            </p>
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
            <p className="text-slate-500 text-center py-8">Loading audit trail...</p>
          ) : error ? (
            <p className="text-red-400 text-center py-8">Error loading audit: {error}</p>
          ) : timeline.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No audit events recorded for this outreach.
            </p>
          ) : (
            timeline.map((ev, idx) => (
              <div
                key={ev._id || idx}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start space-x-3"
              >
                <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  #{idx + 1}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">
                      {ev.eventType || 'STATUS_CHANGE'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{ev.description || 'Transitioned status'}</p>
                  <div className="text-[10px] text-slate-500">
                    {ev.fromStatus && (
                      <>
                        From: <strong className="text-slate-400">{ev.fromStatus}</strong> &rarr;{' '}
                      </>
                    )}
                    To: <strong className="text-emerald-400">{ev.toStatus || 'CURRENT'}</strong>
                    {ev.memberId?.name && (
                      <>
                        {' · '}Actor: <span className="text-slate-300">{ev.memberId.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
