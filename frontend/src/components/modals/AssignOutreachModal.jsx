import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';

export default function AssignOutreachModal({
  isOpen,
  preselectedCompanyId,
  onClose,
  onSuccess,
  onOpenAddMember,
  onShowToast
}) {
  const [companies, setCompanies] = useState([]);
  const [members, setMembers] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setDuplicateWarning('');
      return;
    }

    const loadData = async () => {
      setLoadingOptions(true);
      setDuplicateWarning('');
      try {
        const [compList, memberList] = await Promise.all([
          api.getSponsors().catch(() => []),
          api.getTeamMembers().catch(() => [])
        ]);

        setCompanies(Array.isArray(compList) ? compList : []);
        setMembers(Array.isArray(memberList) ? memberList : []);

        if (preselectedCompanyId) {
          setCompanyId(preselectedCompanyId);
        } else if (compList.length > 0) {
          setCompanyId(compList[0]._id || compList[0].id);
        }

        if (memberList.length > 0) {
          setMemberId(memberList[0]._id);
        }
      } catch (err) {
        onShowToast(`Failed to load options: ${err.message}`, 'error');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadData();
  }, [isOpen, preselectedCompanyId, onShowToast]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyId || !memberId) {
      onShowToast('Please select both a company and a team member', 'warning');
      return;
    }

    setSubmitting(true);
    setDuplicateWarning('');
    try {
      const { res, data } = await api.assignOutreach({
        companyId,
        memberId,
        notes: notes.trim()
      });

      if (res.status === 409) {
        setDuplicateWarning(
          data.message || 'Duplicate outreach prevented: An active outreach already exists for this company.'
        );
        onShowToast('Duplicate outreach blocked by system rule!', 'warning');
        return;
      }

      if (res.ok) {
        onShowToast('Sponsor assigned to outreach successfully!', 'success');
        setNotes('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        onShowToast(data.message || 'Failed to assign outreach', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📈</span>
            <h3 className="text-base font-bold text-white">Assign Sponsor Outreach</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Duplicate Outreach Warning Banner */}
        {duplicateWarning && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
            <div className="font-bold flex items-center space-x-1">
              <span>⚠️</span>
              <span>Duplicate Outreach Prevented!</span>
            </div>
            <p className="text-amber-200/90">{duplicateWarning}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Select Sponsor Company *</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              disabled={loadingOptions || submitting}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500/60"
            >
              {loadingOptions ? (
                <option value="">Loading companies...</option>
              ) : companies.length === 0 ? (
                <option value="">No companies found</option>
              ) : (
                companies.map((c) => {
                  const id = c._id || c.id;
                  return (
                    <option key={id} value={id}>
                      {c.name} ({c.category || 'Tech'}) - Tier: {c.recommendedTier || 'Silver'}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300">Assign to Team Member *</label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAddMember) onOpenAddMember();
                }}
                className="text-[11px] text-blue-400 hover:underline"
              >
                + New Member
              </button>
            </div>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              disabled={loadingOptions || submitting}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500/60"
            >
              {loadingOptions ? (
                <option value="">Loading team members...</option>
              ) : members.length === 0 ? (
                <option value="">No team members yet. Click "+ New Member" to add one.</option>
              ) : (
                members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.role || 'Coordinator'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Assignment Notes / Strategy</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Targeting Silver tier, focus on workshop track..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white resize-none focus:outline-none focus:border-blue-500/60"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingOptions}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Outreach Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
