import React, { useState } from 'react';
import { api } from '../../services/api.js';

export default function GmailModal({
  isOpen,
  gmailStatus,
  onClose,
  onRefreshStatus,
  onShowToast
}) {
  const [senderEmail, setSenderEmail] = useState(gmailStatus?.email || 'sponsorships@hackathon.club');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!isOpen) return null;

  const isAuth = gmailStatus?.authorized;
  const currentEmail = gmailStatus?.email || 'sponsorships@hackathon.club';

  const handleSaveMailbox = async (e) => {
    if (e) e.preventDefault();
    if (!senderEmail.trim() || !senderEmail.includes('@')) {
      onShowToast('Please enter a valid sender email address.', 'error');
      return;
    }
    setConnecting(true);
    try {
      const { res, data } = await api.connectDemoAccount(senderEmail.trim());
      if (res.ok) {
        onShowToast(`Outbound mailbox set to ${senderEmail}!`, 'success');
        if (onRefreshStatus) await onRefreshStatus();
        onClose();
      } else {
        onShowToast(data.message || 'Failed to update mailbox', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { res, data } = await api.disconnectGmail();
      if (res.ok) {
        onShowToast('Mailbox disconnected.', 'info');
        if (onRefreshStatus) await onRefreshStatus();
      } else {
        onShowToast(data.message || 'Disconnect failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">✉️</span>
            <div>
              <h3 className="text-base font-bold text-white">Outreach Sender Mailbox</h3>
              <p className="text-xs text-slate-400">Configure outbound email identity for sponsorship proposals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Live Status Card */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Mailbox Dispatch Status:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isAuth
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {isAuth ? '✓ Mailbox Active & Verified' : 'Standby'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Active Sender:</span>
            <span className="font-mono text-emerald-400 font-medium">{currentEmail}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Dispatch Mode:</span>
            <span className="text-slate-300">Automated AI Outreach Dispatcher</span>
          </div>
        </div>

        {/* Mailbox Setup Form */}
        <form onSubmit={handleSaveMailbox} className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-200">
              Configure Sender Email Address
            </label>
            <p className="text-[11px] text-slate-400">
              Enter the official email address (e.g., student club or sponsorship team) that will appear in the <code>From:</code> header of all personalized sponsor pitch emails.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="sponsorships@hackathon.club"
                required
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={connecting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm disabled:opacity-50 shrink-0"
              >
                {connecting ? 'Saving...' : 'Set Mailbox'}
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400">Quick Presets:</span>
            <button
              type="button"
              onClick={() => setSenderEmail('sponsorships@hackathon.club')}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition"
            >
              sponsorships@hackathon.club
            </button>
            <button
              type="button"
              onClick={() => setSenderEmail('organizer@hackathon.org')}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition"
            >
              organizer@hackathon.org
            </button>
          </div>
        </form>

        {/* Secondary Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting || !isAuth}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition disabled:opacity-40"
          >
            {disconnecting ? 'Resetting...' : 'Reset Mailbox'}
          </button>
          <button
            type="button"
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
