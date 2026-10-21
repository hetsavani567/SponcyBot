import React, { useState, useEffect } from 'react';

const TUTORIAL_STEPS = [
  {
    step: 1,
    icon: '⚡',
    badge: 'Overview',
    title: 'Welcome to SponcyBot!',
    subtitle: 'Human-in-the-Loop AI Sponsorship Platform for Hackathons',
    description: 'SponcyBot streamlines your entire hackathon sponsorship outreach pipeline while keeping organizers in total control.',
    workflow: [
      { step: '1', title: 'Sponsors', desc: 'Discover & AI Score', icon: '🏢' },
      { step: '2', title: 'AI Drafts', desc: 'Custom Proposals', icon: '✍️' },
      { step: '3', title: 'Send Guard', desc: 'Human Review', icon: '🛡️' },
      { step: '4', title: 'Threads', desc: '3-Message Limit', icon: '💬' },
      { step: '5', title: 'CRM', desc: 'Pipeline Stages', icon: '📈' }
    ],
    highlight: '💡 Core Principle: No email ever leaves without your explicit review and sign-off.'
  },
  {
    step: 2,
    icon: '🏢',
    badge: 'Step 1: Discovery',
    title: 'Sponsors Directory & 6-Factor AI Scoring',
    subtitle: 'Identify and analyze premier tech sponsors for your event',
    description: 'Every sponsor is analyzed using our 6-Factor AI scoring engine to find ideal collegiate hackathon alignment.',
    points: [
      {
        icon: '📊',
        title: '6-Factor AI Fit Score (0-100)',
        text: 'Evaluates developer API utility, past collegiate sponsorships, student community alignment, and budget tier.'
      },
      {
        icon: '🔍',
        title: '1-Click Sponsor Inspection',
        text: 'Click "Inspect" on any sponsor to review deep company intelligence and automatically prepare personalized outreach in Thread & Details.'
      },
      {
        icon: '⚡',
        title: 'One-Click AI Proposals',
        text: 'Generate personalized drafts with custom ask tiers (cash bounties, cloud credits, or swag bundles).'
      }
    ],
    highlight: '🎯 Tip: Focus on sponsors with 80+ fit scores for maximum reply conversion.'
  },
  {
    step: 3,
    icon: '🛡️',
    badge: 'Step 2: Send Guard',
    title: 'Human-in-the-Loop Approval Queue',
    subtitle: 'Review, edit, and approve every outreach proposal',
    description: 'Send Guard guarantees human verification before emails are sent, protecting your club’s reputation.',
    points: [
      {
        icon: '🔒',
        title: 'Repetition Guard',
        text: 'Prevents robotic spam by ensuring each sponsor receives a uniquely tailored pitch with distinct angles.'
      },
      {
        icon: '✏️',
        title: 'Instant Inline Editing',
        text: 'Edit subject lines, tweak tier amounts, or customize the value proposition directly in the review card.'
      },
      {
        icon: '🔄',
        title: 'AI Regeneration',
        text: 'Not satisfied with a draft? Click "Regenerate" to create a fresh custom proposal with custom requirements.'
      }
    ],
    highlight: '🛡️ Safety: You can approve with 1-click or discard unwanted drafts safely.'
  },
  {
    step: 4,
    icon: '💬',
    badge: 'Step 3: Conversations',
    title: 'Thread & Details & 3-Message Limit',
    subtitle: 'Manage live sponsor email threads with deliverability protection',
    description: 'Chat directly with sponsors through real or simulated Gmail threads with built-in spam prevention.',
    points: [
      {
        icon: '🔒',
        title: 'Strict 3-Message Quota',
        text: 'To avoid spamming sponsors and protect email deliverability, each thread allows at most 3 outbound messages (Initial Pitch + 2 Follow-Ups).'
      },
      {
        icon: '🤖',
        title: 'Gemini Intent Classification',
        text: 'AI classifies inbound sponsor replies (INTERESTED, MEETING, or DECLINED) and suggests optimal next actions.'
      },
      {
        icon: '📅',
        title: '1-Click Meeting Confirmation',
        text: 'When a sponsor expresses interest, click "Confirm Meeting" to lock in Google Meet calls and advance your CRM stage.'
      }
    ],
    highlight: '⚡ Dual Modes: Connect real Gmail via OAuth or test seamlessly with 1-click Demo Simulation.'
  },
  {
    step: 5,
    icon: '📈',
    badge: 'Step 4: Pipeline',
    title: 'Outreach CRM & Role Permissions',
    subtitle: 'Stay on top of every conversation and coordinate your team',
    description: 'Track outreach status from initial contact to closed sponsorship deals.',
    points: [
      {
        icon: '📈',
        title: 'Lifecycle Stages',
        text: 'Track: Waiting for Reply ➔ Follow-Up 1 ➔ Meeting Booked ➔ Closed.'
      },
      {
        icon: '👑',
        title: 'Organizer Role',
        text: 'Full administrative access, manage sponsor leaderboard, and remove company profiles.'
      },
      {
        icon: '📋',
        title: 'Outreach Coordinator Role',
        text: 'Manage outreach communications, track CRM stages, and schedule follow-ups.'
      }
    ],
    highlight: '🚀 You are all set! Choose your role on signin to experience tailored permissions.'
  }
];

export default function TutorialModal({
  isOpen,
  onClose,
  onFinish
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    if (typeof localStorage !== 'undefined' && dontShowAgain) {
      localStorage.setItem('SPONCY_TUTORIAL_COMPLETED', 'true');
    }
    if (onFinish) onFinish();
    if (onClose) onClose();
  };

  const handleSkip = () => {
    if (typeof localStorage !== 'undefined' && dontShowAgain) {
      localStorage.setItem('SPONCY_TUTORIAL_COMPLETED', 'true');
    }
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-sm">
              {currentStep.icon}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold uppercase">
                  {currentStep.badge}
                </span>
                <span className="text-xs text-slate-400">
                  Step {currentStepIndex + 1} of {TUTORIAL_STEPS.length}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight mt-0.5">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            title="Close Tutorial"
            className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Progress Bar Dots */}
        <div className="flex items-center space-x-2">
          {TUTORIAL_STEPS.map((step, idx) => (
            <button
              key={step.step}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                idx === currentStepIndex
                  ? 'w-8 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  : idx < currentStepIndex
                  ? 'w-4 bg-emerald-500/40'
                  : 'w-2 bg-slate-800'
              }`}
              title={`Go to Step ${idx + 1}: ${step.title}`}
            />
          ))}
        </div>

        {/* Body Content */}
        <div className="space-y-4 py-1 flex-1">
          <div>
            <h4 className="text-sm font-semibold text-emerald-300">
              {currentStep.subtitle}
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Step 1 Visual Workflow Banner */}
          {currentStep.workflow && (
            <div className="grid grid-cols-5 gap-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              {currentStep.workflow.map((item) => (
                <div key={item.step} className="flex flex-col items-center space-y-1">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[11px] font-bold text-white">{item.title}</span>
                  <span className="text-[9px] text-slate-400">{item.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Points List */}
          {currentStep.points && (
            <div className="space-y-2.5">
              {currentStep.points.map((pt, i) => (
                <div key={i} className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60">
                  <span className="text-base shrink-0 mt-0.5">{pt.icon}</span>
                  <div className="text-xs">
                    <p className="font-semibold text-white">{pt.title}</p>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{pt.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Highlight Tip Banner */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
            {currentStep.highlight}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3.5">
          <label className="flex items-center space-x-2 cursor-pointer text-[11px] text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Don't show automatically next time</span>
          </label>

          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handleBack}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition shadow-md flex items-center space-x-1"
            >
              <span>{isLastStep ? 'Start Exploring SponcyBot 🚀' : 'Next ➔'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
