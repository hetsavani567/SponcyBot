import React from 'react';

export default function BackendBanner({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
      <div className="flex items-start sm:items-center space-x-3">
        <span className="text-xl">⚠️</span>
        <div>
          <strong className="font-semibold text-white">Backend Connection Notice:</strong>{' '}
          <span className="text-amber-300">{message}</span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            If deployed on Render/Vercel, ensure your backend server is active, Root Directory is set to{' '}
            <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">backend</code>, and{' '}
            <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">MONGODB_URI</code> is added in the cloud dashboard.
          </p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition whitespace-nowrap text-xs shadow shrink-0"
      >
        Retry Connection
      </button>
    </div>
  );
}
