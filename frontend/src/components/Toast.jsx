import React from 'react';

export default function Toast({ toast }) {
  if (!toast || !toast.visible) return null;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 transition-all duration-300 transform translate-y-0 opacity-100 bg-slate-900 border border-slate-700 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 max-w-md">
      <span className="text-base">{icons[toast.type] || 'ℹ️'}</span>
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
}
