// ─── Centralized High-Performance API Client for SponcyBot React Frontend ───────
// Features: Stale-While-Revalidate caching, in-flight request deduplication,
// unified bootstrap round-trip, and instant cache invalidation on mutations.

const clientCache = new Map(); // url -> { data, res, expiresAt }
const inFlightRequests = new Map(); // url -> Promise

export const invalidateCache = (prefix = '') => {
  if (!prefix) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (key.includes(prefix)) {
      clientCache.delete(key);
    }
  }
};

export const setCachedData = (url, data, ttlMs = 15000) => {
  const expiresAt = Date.now() + ttlMs;
  clientCache.set(url, { data, res: { ok: true, status: 200 }, expiresAt });
};

export async function safeFetchJson(url, options = {}) {
  // Support custom backend base URL if frontend is hosted separately
  const baseUrl = window.API_BASE_URL || localStorage.getItem('SPONCY_API_BASE_URL') || '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const method = (options.method || 'GET').toUpperCase();

  // 1. Client-Side Read Cache (GET requests without explicit bypass)
  if (method === 'GET' && !options.noCache) {
    const cached = clientCache.get(fullUrl);
    if (cached && Date.now() < cached.expiresAt) {
      return { res: cached.res, data: cached.data, fromCache: true };
    }

    // Request Deduplication: avoid firing multiple parallel HTTP fetches for the exact same URL
    if (inFlightRequests.has(fullUrl)) {
      return await inFlightRequests.get(fullUrl);
    }
  }

  // Automatically attach auth token if logged in
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('SPONCY_AUTH_TOKEN') : null;
  const mergedHeaders = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const finalOptions = { ...options, headers: mergedHeaders };

  const fetchPromise = (async () => {
    let res;
    try {
      res = await fetch(fullUrl, finalOptions);
    } catch (networkErr) {
      throw new Error(`Cannot reach backend server at ${fullUrl}: ${networkErr.message}. Ensure backend is running.`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const rawText = await res.text();
      const cleanSnippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

      let diagnosticMsg;
      if (res.status === 404) {
        diagnosticMsg = `Route not found (404): "${url}". Verify backend server routes.`;
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        diagnosticMsg = `Backend unavailable (${res.status}): Server is starting up or crashed. Verify MONGODB_URI and cloud logs.`;
      } else {
        diagnosticMsg = `Server returned non-JSON (${res.status}): "${cleanSnippet || 'Service Unavailable'}".`;
      }
      throw new Error(diagnosticMsg);
    }

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error(`Malformed JSON response from ${url}: ${parseErr.message}`);
    }

    // Cache successful GET responses in memory for 15 seconds
    if (method === 'GET' && res.ok && !options.noCache) {
      const ttl = options.ttlMs || 15000;
      clientCache.set(fullUrl, {
        res: { ok: res.ok, status: res.status },
        data,
        expiresAt: Date.now() + ttl
      });
    }

    return { res, data };
  })();

  if (method === 'GET' && !options.noCache) {
    inFlightRequests.set(fullUrl, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inFlightRequests.delete(fullUrl);
    }
  }

  return await fetchPromise;
}

// ─── Dashboard, Auth & Outreach API ─────────────────────────────────────────
export const api = {
  // Cache Management
  invalidateCache,
  setCachedData,
  clearCache: () => clientCache.clear(),

  // Unified bootstrap: loads stats, mailbox status, sponsor list, and user in 1 round-trip
  bootstrap: async () => {
    try {
      const { data } = await safeFetchJson('/api/bootstrap', { ttlMs: 15000 });
      if (data?.data) {
        const { stats, gmailStatus, sponsors, user } = data.data;

        // Seed individual client cache slots so subsequent tab clicks or queries are instant (0ms)
        if (stats) setCachedData('/gmail/stats', { data: stats });
        if (gmailStatus) setCachedData('/gmail/oauth/status', { data: gmailStatus });
        if (sponsors) setCachedData('/companies/rank', sponsors);
        if (user && typeof localStorage !== 'undefined') {
          localStorage.setItem('SPONCY_AUTH_USER', JSON.stringify(user));
        }

        return data.data;
      }
    } catch (e) {
      console.warn('[API] Bootstrap fallback to parallel fetching:', e.message);
    }

    // Fallback: parallel fetching if unified route is unavailable
    const [stats, gmailStatus, sponsors, user] = await Promise.all([
      api.getStats().catch(() => ({})),
      api.getGmailStatus().catch(() => ({ authorized: false })),
      api.getSponsors().catch(() => []),
      api.getMe().catch(() => null)
    ]);
    return { stats, gmailStatus, sponsors, user };
  },

  // Organizer Username & Password Authentication
  signup: async (payload) => {
    const { res, data } = await safeFetchJson('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok && data?.data?.token) {
      localStorage.setItem('SPONCY_AUTH_TOKEN', data.data.token);
      localStorage.setItem('SPONCY_AUTH_USER', JSON.stringify(data.data.user));
    }
    invalidateCache('/auth');
    return { res, data };
  },

  signin: async (usernameOrEmail, password) => {
    const { res, data } = await safeFetchJson('/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password })
    });
    if (res.ok && data?.data?.token) {
      localStorage.setItem('SPONCY_AUTH_TOKEN', data.data.token);
      localStorage.setItem('SPONCY_AUTH_USER', JSON.stringify(data.data.user));
    }
    invalidateCache('/auth');
    return { res, data };
  },

  getMe: async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('SPONCY_AUTH_TOKEN') : null;
    if (!token) return null;
    try {
      const { data } = await safeFetchJson('/auth/me');
      if (data?.data?.user) {
        localStorage.setItem('SPONCY_AUTH_USER', JSON.stringify(data.data.user));
        return data.data.user;
      }
      return null;
    } catch {
      localStorage.removeItem('SPONCY_AUTH_TOKEN');
      localStorage.removeItem('SPONCY_AUTH_USER');
      return null;
    }
  },

  signout: async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('SPONCY_AUTH_TOKEN');
      localStorage.removeItem('SPONCY_AUTH_USER');
    }
    invalidateCache('/auth');
    try {
      await safeFetchJson('/auth/signout', { method: 'POST' });
    } catch {}
    return { success: true };
  },

  getCurrentUser: () => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('SPONCY_AUTH_USER') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  // System Stats
  getStats: async (forceRefresh = false) => {
    const { data } = await safeFetchJson('/gmail/stats', { noCache: forceRefresh, ttlMs: 15000 });
    return data?.data || {};
  },

  // Gmail OAuth & Status
  getGmailStatus: async (forceRefresh = false) => {
    const { data } = await safeFetchJson('/gmail/oauth/status', { noCache: forceRefresh, ttlMs: 20000 });
    return data?.data || { authorized: false };
  },

  connectDemoAccount: async (email = 'sponsorships@hackathon.club') => {
    const { res, data } = await safeFetchJson('/gmail/oauth/demo-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    invalidateCache('/gmail');
    return { res, data };
  },

  disconnectGmail: async () => {
    const { res, data } = await safeFetchJson('/gmail/oauth/disconnect', { method: 'POST' });
    invalidateCache('/gmail');
    return { res, data };
  },

  // Sponsor Companies
  getSponsors: async (forceRefresh = false) => {
    try {
      const { data } = await safeFetchJson('/companies/rank', { noCache: forceRefresh, ttlMs: 30000 });
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.rankings)) return data.rankings;
      return [];
    } catch {
      const { data } = await safeFetchJson('/companies', { noCache: forceRefresh, ttlMs: 30000 });
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    }
  },

  getCompany: async (id) => {
    const { data } = await safeFetchJson(`/companies/${id}`, { ttlMs: 30000 });
    return data?.company || data?.data || data;
  },

  addCompany: async (payload) => {
    const { res, data } = await safeFetchJson('/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/companies');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  researchCompany: async (companyId) => {
    const { res, data } = await safeFetchJson('/companies/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    invalidateCache('/companies');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  deleteCompany: async (companyId) => {
    const { res, data } = await safeFetchJson(`/companies/${companyId}`, { method: 'DELETE' });
    invalidateCache('/companies');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  // Email Proposals & Approval Queue
  getEmails: async (forceRefresh = false) => {
    const { data } = await safeFetchJson('/emails', { noCache: forceRefresh, ttlMs: 15000 });
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.emails)) return data.data.emails;
    if (Array.isArray(data?.emails)) return data.emails;
    if (Array.isArray(data)) return data;
    return [];
  },

  getEmail: async (emailId) => {
    try {
      const { data } = await safeFetchJson(`/emails/${emailId}`, { ttlMs: 15000 });
      return data?.data?.email || data?.data || data;
    } catch {
      return null;
    }
  },

  getApprovalHistory: async (emailId) => {
    const { data } = await safeFetchJson(`/emails/${emailId}/approval-history`, { ttlMs: 15000 });
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.history)) return data.data.history;
    if (Array.isArray(data?.history)) return data.history;
    if (Array.isArray(data)) return data;
    return [];
  },

  generateDraft: async (companyId, options = {}) => {
    const payload = typeof companyId === 'object' ? companyId : { companyId, ...options };
    const { res, data } = await safeFetchJson('/emails/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/emails');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  approveEmail: async (emailId, reviewerName = 'Partnerships Director', options = {}) => {
    const { res, data } = await safeFetchJson(`/emails/${emailId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reviewerName,
        notes: 'Verified tier, ask, and unique personalization.',
        allowInitial: true,
        ...options
      })
    });
    invalidateCache('/emails');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  rejectEmail: async (emailId, reason, reviewerName = 'Partnerships Lead') => {
    const { res, data } = await safeFetchJson(`/emails/${emailId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName, reason })
    });
    invalidateCache('/emails');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  deleteEmail: async (emailId) => {
    const { res, data } = await safeFetchJson(`/emails/${emailId}`, {
      method: 'DELETE'
    });
    invalidateCache('/emails');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  deleteRejectedEmails: async () => {
    const { res, data } = await safeFetchJson('/emails/rejected', {
      method: 'DELETE'
    });
    invalidateCache('/emails');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  deleteAllDrafts: async () => {
    const { res, data } = await safeFetchJson('/emails/all-drafts', {
      method: 'DELETE'
    });
    invalidateCache('/emails');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  saveEmailEdit: async (payload) => {
    const { res, data } = await safeFetchJson('/emails/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/emails');
    return { res, data };
  },

  regenerateDraft: async (emailId, options = {}) => {
    let payload;
    if (typeof options === 'string') {
      payload = { emailId, customInstructions: options, preserveSubject: true };
    } else {
      payload = { emailId, preserveSubject: true, ...options };
    }
    const { res, data } = await safeFetchJson('/emails/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/emails');
    return { res, data };
  },

  sendEmail: async (emailId, to) => {
    const { res, data } = await safeFetchJson('/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, to })
    });
    invalidateCache('/emails');
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  // Outreach CRM
  getOutreach: async (mode = 'all', forceRefresh = false) => {
    const url = mode === 'due' ? '/outreach/pending-followups' : '/outreach';
    const { data } = await safeFetchJson(url, { noCache: forceRefresh, ttlMs: 15000 });
    if (mode === 'due') {
      if (Array.isArray(data?.pendingFollowUps)) return data.pendingFollowUps;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data)) return data;
      return [];
    }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.outreach)) return data.outreach;
    return [];
  },

  assignOutreach: async (payload) => {
    const { res, data } = await safeFetchJson('/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  registerFollowUp: async (outreachId, notes = 'Follow-up registered via CRM') => {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  updateOutreachStatus: async (outreachId, status) => {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason: 'Manual status update via dashboard' })
    });
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  closeOutreach: async (outreachId, reason) => {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  getOutreachTimeline: async (outreachId) => {
    const { data } = await safeFetchJson(`/outreach/${outreachId}`, { ttlMs: 15000 });
    return data?.timeline || data?.data?.timeline || (Array.isArray(data) ? data : []);
  },

  // Team Members
  getTeamMembers: async (forceRefresh = false) => {
    const { data } = await safeFetchJson('/team-members', { noCache: forceRefresh, ttlMs: 30000 });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.teamMembers)) return data.teamMembers;
    return [];
  },

  addTeamMember: async (payload) => {
    const { res, data } = await safeFetchJson('/team-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/team-members');
    return { res, data };
  },

  // Gmail Threads & AI Classification
  getThreads: async () => {
    const { data } = await safeFetchJson('/gmail/threads', { ttlMs: 15000 });
    return data?.data || [];
  },

  getThread: async (threadId) => {
    const { data } = await safeFetchJson(`/gmail/thread/${threadId}?mock=true`, { ttlMs: 15000 });
    return data?.data?.thread;
  },

  sendThreadReply: async (threadId, payload) => {
    const { res, data } = await safeFetchJson(`/gmail/thread/${threadId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/gmail/threads');
    invalidateCache(`/gmail/thread/${threadId}`);
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  simulateThreadReply: async (threadId, payload) => {
    const { res, data } = await safeFetchJson(`/gmail/thread/${threadId}/simulate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/gmail/threads');
    invalidateCache(`/gmail/thread/${threadId}`);
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  classifyReply: async (payload) => {
    const { res, data } = await safeFetchJson('/gmail/replies/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { res, data };
  },

  confirmReplyOutcome: async (payload) => {
    const { res, data } = await safeFetchJson('/gmail/replies/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache('/gmail/threads');
    invalidateCache('/outreach');
    invalidateCache('/gmail/stats');
    invalidateCache('/api/bootstrap');
    return { res, data };
  },

  // 12-Step Judge Demo Simulation
  runSimulation: async (payload) => {
    const { res, data } = await safeFetchJson('/gmail/demo/simulate-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    invalidateCache(); // Invalidate all after full demo simulation
    return { res, data };
  }
};
