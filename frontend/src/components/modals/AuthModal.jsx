import React, { useState } from 'react';
import { api } from '../../services/api.js';

export default function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  onShowToast
}) {
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState('Sponsorship Lead');

  if (!isOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const { res, data } = await api.signin(usernameOrEmail, password);
      if (res.ok && data?.data?.user) {
        onShowToast(`Welcome back, ${data.data.user.name}!`, 'success');
        if (onAuthSuccess) onAuthSuccess(data.data.user);
        onClose();
      } else {
        setErrorMessage(data?.message || 'Invalid username or password.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!signupUsername.trim() || signupUsername.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { res, data } = await api.signup({
        name: signupName || signupUsername,
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        role: signupRole
      });

      if (res.ok && data?.data?.user) {
        onShowToast(`Account created! Welcome, ${data.data.user.name}.`, 'success');
        if (onAuthSuccess) onAuthSuccess(data.data.user);
        onClose();
      } else {
        setErrorMessage(data?.message || 'Failed to create account.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Sign up error.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = (uname, pass) => {
    setUsernameOrEmail(uname);
    setPassword(pass);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">🔐</span>
            <div>
              <h3 className="text-base font-bold text-white">Organizer Authentication</h3>
              <p className="text-xs text-slate-400">Username & Password Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold transition"
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMessage(''); }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              mode === 'signin'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMessage(''); }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              mode === 'signup'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mode 1: Sign In */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Username or Email</label>
              <input
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="e.g. organizer or organizer@club.com"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Verifying Credentials...' : 'Sign In as Organizer'}
            </button>

            {/* Quick Demo Credentials */}
            <div className="pt-2 border-t border-slate-800/80">
              <p className="text-[11px] text-slate-400 mb-2">Quick 1-Click Demo Organizer Login:</p>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('organizer', 'password123')}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-emerald-400 transition"
                >
                  ⚡ organizer / password123
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('admin', 'password123')}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-blue-400 transition"
                >
                  ⚡ admin / password123
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Mode 2: Sign Up */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Organizer Name</label>
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="e.g. Het Savani"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Username</label>
                <input
                  type="text"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="e.g. hetsavani"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Club Role</label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Sponsorship Lead">Sponsorship Lead</option>
                  <option value="Partnerships Director">Partnerships Director</option>
                  <option value="Outreach Coordinator">Outreach Coordinator</option>
                  <option value="Organizer">Organizer</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="organizer@college.edu"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Password (min 6 characters)</label>
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Registering Account...' : 'Create Organizer Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
