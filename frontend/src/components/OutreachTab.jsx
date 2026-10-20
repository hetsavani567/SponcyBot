import React, { useState, useEffect, useCallback } from 'react';
import { api, safeFetchJson } from '../services/api.js';

export default function OutreachTab({
  onOpenAssignModal,
  onOpenTimeline,
  onOpenSimulateReply,
  onShowToast,
  onRefreshStats,
  refreshTrigger = 0
}) {
  const [outreaches, setOutreaches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState('all');

  const loadOutreach = useCallback(async (mode = filterMode) => {
    setLoading(true);
    try {
      const data = await api.getOutreach(mode);
      setOutreaches(Array.isArray(data) ? data : []);
    } catch (err) {
      onShowToast(`Failed to load outreach records: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterMode, onShowToast]);

  useEffect(() => {
    loadOutreach(filterMode);
  }, [filterMode, loadOutreach, refreshTrigger]);

  const handleRegisterFollowUp = async (outreachId) => {
    try {
      const { res, data } = await api.registerFollowUp(outreachId);
      if (res.ok) {
        onShowToast(data.message || 'Follow-up registered successfully', 'success');
        loadOutreach();
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Follow-up blocked (max 2 limit reached)', 'warning');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleChangeStatus = async (outreachId) => {
    const allowed = ['WAITING FOR REPLY', 'INTERESTED', 'MEETING', 'DECLINED', 'CLOSED'];
    const newStatus = window.prompt(`Enter new status (${allowed.join(', ')}):`, 'INTERESTED');
    if (!newStatus || !allowed.includes(newStatus)) return;

    try {
      const { res, data } = await api.updateOutreachStatus(outreachId, newStatus);
      if (res.ok) {
        onShowToast(`Status updated to ${newStatus}`, 'success');
        loadOutreach();
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Status update failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleCloseOutreach = async (outreachId) => {
    const reason = window.prompt('Reason for closing outreach:', 'Unresponsive after max follow-ups') || 'Closed by organizer';
    try {
      const { res, data } = await api.closeOutreach(outreachId, reason);
      if (res.ok) {
        onShowToast('Outreach closed successfully.', 'info');
        loadOutreach();
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Failed to close outreach', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handlePollReplies = async () => {
    onShowToast('Polling inbox messages...', 'info');
    try {
      const { res, data } = await safeFetchJson('/gmail/messages?mock=true');
      if (res.ok) {
        onShowToast(`Inbox poll complete: ${data.count || 0} messages tracked.`, 'success');
        loadOutreach();
        if (onRefreshStats) onRefreshStats();
      } else {
        onShowToast(data.message || 'Failed to poll inbox', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleExportCSV = () => {
    onShowToast('Downloading Outreach Tracker CSV for Google Sheets...', 'info');
    window.open('/outreach/export/csv', '_blank');
  };

  return (
    <section className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Outreach CRM & Follow-Up Tracker</h2>
          <p className="text-xs text-slate-400">State machine enforcing max 2 follow-ups · Automated Outreach Engine</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenAssignModal()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs text-white rounded-lg font-medium transition shadow-sm flex items-center space-x-1"
          >
            <span>+ Assign Sponsor</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/30 text-xs font-medium transition shadow-sm flex items-center space-x-1"
            title="Download full outreach tracker CSV for Google Sheets or Excel"
          >
            <span>📊 Export to Sheets / CSV</span>
          </button>
          <button
            onClick={handlePollReplies}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg border border-slate-700 transition flex items-center space-x-1"
          >
            <span>📥 Check Replies</span>
          </button>
          <button
            onClick={() => setFilterMode('due')}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              filterMode === 'due'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20'
            }`}
          >
            ⏰ Due Follow-ups
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-xs rounded-lg transition border ${
              filterMode === 'all'
                ? 'bg-slate-800 text-white border-slate-600 font-semibold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
          >
            All Records
          </button>
        </div>
      </div>

      {/* Outreach CRM Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Owner (Team Member)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Follow-ups</th>
                <th className="py-3 px-4">Next Scheduled</th>
                <th className="py-3 px-4">Last Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    Loading outreach records...
                  </td>
                </tr>
              ) : outreaches.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    {filterMode === 'due'
                      ? 'No pending follow-ups due right now.'
                      : 'No outreach records found. Click "+ Assign Sponsor" to start!'}
                  </td>
                </tr>
              ) : (
                outreaches.map((o) => {
                  const statusBadge = {
                    DRAFT: 'bg-slate-700 text-slate-300 border-slate-600',
                    SENT: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                    'WAITING FOR REPLY': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    INTERESTED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                    MEETING: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                    'FOLLOW-UP 1': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                    'FOLLOW-UP 2': 'bg-pink-500/20 text-pink-300 border-pink-500/40',
                    DECLINED: 'bg-red-500/20 text-red-300 border-red-500/40',
                    CLOSED: 'bg-slate-700 text-slate-400 border-slate-600'
                  }[o.status] || 'bg-slate-800 text-slate-400';

                  const count = o.followUpCount || 0;
                  const isCapped = count >= 2;
                  const compName = o.companyId?.name || (typeof o.companyId === 'string' ? o.companyId : 'Sponsor Company');

                  return (
                    <tr key={o._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-white">
                        <span className="font-semibold">{compName}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {o.memberId?.name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${statusBadge}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-mono ${isCapped ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                          {count}/2 {isCapped ? '(MAX)' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {o.nextFollowUpAt ? new Date(o.nextFollowUpAt).toLocaleDateString() : (
                          <span className="text-slate-600">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {o.lastContactedAt ? new Date(o.lastContactedAt).toLocaleDateString() : 'Initial'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {!isCapped && !['CLOSED', 'DECLINED'].includes(o.status) ? (
                            <button
                              onClick={() => handleRegisterFollowUp(o._id)}
                              title="Send Follow-up (Strict Max 2)"
                              className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded border border-blue-500/30 transition text-[11px]"
                            >
                              Follow-up
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                              Capped
                            </span>
                          )}

                          <button
                            onClick={() => onOpenSimulateReply(o._id, o.threadId || '', compName)}
                            title="Simulate Sponsor Inbound Reply"
                            className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded border border-emerald-500/30 transition text-[11px]"
                          >
                            💬 Reply
                          </button>

                          <button
                            onClick={() => onOpenTimeline(o._id, compName)}
                            title="View Audit Event Log"
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition text-[11px]"
                          >
                            📜 Audit
                          </button>

                          <button
                            onClick={() => handleChangeStatus(o._id)}
                            title="Update Status Manually"
                            className="px-1.5 py-1 text-slate-400 hover:text-white rounded text-[11px]"
                          >
                            ⚙️
                          </button>

                          {o.status !== 'CLOSED' && (
                            <button
                              onClick={() => handleCloseOutreach(o._id)}
                              title="Close Outreach"
                              className="px-1.5 py-1 text-slate-500 hover:text-red-400 rounded text-[11px]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
