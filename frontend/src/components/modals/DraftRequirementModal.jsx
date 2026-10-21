import React, { useState, useEffect } from 'react';

export default function DraftRequirementModal({
  isOpen,
  company,
  onClose,
  onSubmit,
  loading = false
}) {
  const [requirements, setRequirements] = useState('');
  const [askType, setAskType] = useState('money');
  const [tone, setTone] = useState('persuasive');
  const [eventName, setEventName] = useState('HackFest 2026');
  const [eventDates, setEventDates] = useState('November 14–16, 2026');

  useEffect(() => {
    if (company) {
      setAskType(company.recommendedAsk || 'money');
      // Pre-fill smart suggestion based on company intelligence if available
      const initialReq = company.whatToAsk || company.strategy || '';
      setRequirements(initialReq);
    } else {
      setRequirements('');
    }
  }, [company, isOpen]);

  if (!isOpen || !company) return null;

  const compName = company.name || company.company || 'Sponsor';
  const tier = company.recommendedTier || 'Silver';

  const quickChips = [
    { label: '💰 $5,000 Cash Track Bounty', text: 'Cash sponsorship of ₹1,50,000 / $5,000 for a dedicated Challenge Bounty track.' },
    { label: '☁️ Free Credits for 500 Builders', text: 'Free platform API/cloud credits and Pro access for all 500 builders during the 36-hour hackathon.' },
    { label: '🎁 Hardware Kits & Swag Hampers', text: 'Participant swag hampers, developer stickers, and winner prize hardware kits.' },
    { label: '🎙️ 45-Min Hands-on Tech Workshop', text: 'A dedicated 45-minute technical workshop and mentorship presence.' },
    { label: '🎯 Finalist Resumes & DevRel Hiring', text: 'Access to opt-in finalist resume database for engineering and DevRel recruitment.' },
    { label: '⚡ Midnight Fuel & Chill Lounge', text: 'Official 36-hour midnight energy and refueling station partner.' }
  ];

  const eventPresets = [
    { name: 'HackFest 2026', label: '🏆 HackFest 2026' },
    { name: 'ACM National Hackathon', label: '⚡ ACM National Hackathon' },
    { name: 'Global Builder Summit', label: '🌐 Global Builder Summit' }
  ];

  const datePresets = [
    'November 14–16, 2026',
    'December 5–7, 2026',
    'January 22–24, 2027',
    'February 19–21, 2027'
  ];

  const handleChipClick = (chipText) => {
    if (!requirements.trim()) {
      setRequirements(chipText);
    } else if (!requirements.includes(chipText)) {
      setRequirements((prev) => `${prev.trim()}\n• ${chipText}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cId = company._id || company.id;
    onSubmit(cId, {
      customInstructions: requirements.trim(),
      askType,
      tone,
      eventName: eventName.trim() || 'HackFest 2026',
      eventDates: eventDates.trim() || 'November 14–16, 2026'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl text-left text-xs max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base">✍️</span>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Customize Sponsor Requirements
              </h3>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Specify your requirements so Gemini generates a unique, tailored outreach proposal.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white text-base font-bold px-1"
          >
            &times;
          </button>
        </div>

        {/* Sponsor Context Banner */}
        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              {compName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white text-xs">{compName}</p>
              <p className="text-[10px] text-slate-400">{company.category || 'Technology'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Tier: {tier}
            </span>
            {company.score && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Score: {company.score}/100
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Requirement Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                <span>🎯 Sponsor Requirements & Goal</span>
                <span className="text-emerald-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Sent directly to AI prompt</span>
            </div>
            <textarea
              rows={4}
              required
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="e.g. Propose $5,000 cash sponsorship for the AI Hack Track, free API credits for all 500 builders, and opt-in recruiter access to top 20 finalist resumes..."
              className="w-full text-xs p-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition leading-relaxed resize-none"
            />
          </div>

          {/* Quick Requirement Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Quick Requirement Suggestions (Click to Add):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickChips.map((chip, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleChipClick(chip.text)}
                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[10px] text-slate-300 hover:text-white transition text-left"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event & Competition Customization */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1">
                <span>🏷️ Event & Hackathon Details</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Customizes AI Branding</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Event / Competition Name</label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. HackFest 2026"
                  className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {eventPresets.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setEventName(preset.name)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
                        eventName === preset.name
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Event Dates</label>
                <input
                  type="text"
                  required
                  value={eventDates}
                  onChange={(e) => setEventDates(e.target.value)}
                  placeholder="e.g. November 14–16, 2026"
                  className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {datePresets.map((dateStr, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setEventDates(dateStr)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
                        eventDates === dateStr
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {dateStr.split('–')[0] || dateStr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Options: Ask Type & Tone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Ask Category</label>
              <select
                value={askType}
                onChange={(e) => setAskType(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="money">💰 Cash Sponsorship ({tier} Tier)</option>
                <option value="infra">☁️ Cloud Credits & Developer Tools</option>
                <option value="goodies">🎁 Goodies, Swag & Hardware Kits</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Proposal Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="persuasive">Direct & Persuasive (Recommended)</option>
                <option value="developer">Developer & Tech-Centric</option>
                <option value="executive">Executive & ROI-Focused</option>
              </select>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !requirements.trim()}
              className="px-4 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
            >
              <span>{loading ? '⏳ Generating AI Draft...' : '✨ Generate Unique AI Draft'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
