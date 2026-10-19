import React, { useState } from 'react';
import { api } from '../../services/api.js';

export default function GmailModal({
  isOpen,
  gmailStatus,
  onClose,
  onRefreshStatus,
  onShowToast
}) {
  const [connectingDemo, setConnectingDemo] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!isOpen) return null;

  const isAuth = gmailStatus?.authorized;
  const isDemo = gmailStatus?.mode === 'demo' || gmailStatus?.email?.includes('demo') || gmailStatus?.email?.includes('hackathon.club');
  const accountEmail = gmailStatus?.email || 'None';
  const hasEnv = (gmailStatus?.hasClientId && gmailStatus?.hasClientSecret) ? 'Configured in .env' : 'Missing in .env (Demo Available)';

  const handleConnectDemo = async () => {
    setConnectingDemo(true);
    onShowToast('Connecting 1-Click Demo Mailbox...', 'info');
    try {
      const { res, data } = await api.connectDemoAccount('sponsorships@hackathon.club');
      if (res.ok) {
        onShowToast('Demo Gmail mailbox connected successfully!', 'success');
        if (onRefreshStatus) await onRefreshStatus();
      } else {
        onShowToast(data.message || 'Demo connection failed', 'error');
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setConnectingDemo(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { res, data } = await api.disconnectGmail();
      if (res.ok) {
        onShowToast('Gmail account disconnected.', 'info');
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">✉️</span>
            <div>
              <h3 className="text-base font-bold text-white">Gmail Integration & Auth</h3>
              <p className="text-xs text-slate-400">OAuth 2.0 & Demo Mode Connection Hub</p>
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
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Current Status:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isAuth
                  ? isDemo
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isAuth ? (isDemo ? 'Demo Mode Active' : 'OAuth Active') : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Sender Account:</span>
            <span className="font-mono text-white">{accountEmail}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">OAuth Credentials in .env:</span>
            <span className="text-slate-300">{hasEnv}</span>
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Connection Options
          </p>

          {/* Option 1: 1-Click Demo Connect */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500/60 transition space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                <span>⚡</span>
                <span>1-Click Demo Account (Recommended)</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Zero Setup
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Connects a simulated organizer mailbox (<code className="text-emerald-300">sponsorships@hackathon.club</code>). Perfect for testing and judges without Google Cloud console setup.
            </p>
            <button
              onClick={handleConnectDemo}
              disabled={connectingDemo}
              className="w-full mt-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm disabled:opacity-50"
            >
              {connectingDemo ? 'Connecting Demo Mailbox...' : 'Connect Demo Account Now'}
            </button>
          </div>

          {/* Option 2: Live Google Cloud OAuth */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <span>🌐</span>
                <span>Live Google Cloud OAuth 2.0</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                Real Gmail
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Authenticate via Google's consent screen. Requires <code className="text-slate-300">GMAIL_CLIENT_ID</code> and <code className="text-slate-300">GMAIL_CLIENT_SECRET</code> in <code className="text-slate-300">.env</code>.
            </p>
            <a
              href="/gmail/oauth/start"
              className="block text-center w-full mt-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition"
            >
              Launch Google OAuth Flow &rarr;
            </a>
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleDisconnect}
            disabled={disconnecting || !isAuth}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition disabled:opacity-40"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
          </button>
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
