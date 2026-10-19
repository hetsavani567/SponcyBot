import React, { useState } from 'react';
import { api } from '../../services/api.js';

export default function AddSponsorModal({ isOpen, onClose, onSuccess, onShowToast }) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('Cloud & Developer Tools');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Company name is required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { res, data } = await api.addCompany({
        name: name.trim(),
        website: website.trim(),
        category,
        contactEmail: contactEmail.trim()
      });

      if (res.ok) {
        onShowToast(`Company "${name}" added successfully!`, 'success');
        setName('');
        setWebsite('');
        setContactEmail('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        onShowToast(data.message || 'Failed to add sponsor', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Add New Sponsor</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Supabase Inc"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://supabase.com"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500/60"
            >
              <option value="Technology">Technology</option>
              <option value="Cloud & Developer Tools">Cloud & Developer Tools</option>
              <option value="AI & Data">AI & Data</option>
              <option value="Finance">Finance</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="sponsorships@supabase.com"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500/60"
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
              disabled={submitting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Sponsor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
