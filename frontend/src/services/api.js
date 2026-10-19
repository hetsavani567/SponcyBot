// ─── Centralized API Client for SponcyBot React Frontend ───────────────────

export async function safeFetchJson(url, options = {}) {
  // Support custom backend base URL if frontend is hosted separately
  const baseUrl = window.API_BASE_URL || localStorage.getItem('SPONCY_API_BASE_URL') || '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  let res;
  try {
    res = await fetch(fullUrl, options);
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

  return { res, data };
}

// ─── Dashboard & Gmail API ─────────────────────────────────────────────────
export const api = {
  // System Stats
  getStats: async () => {
    const { data } = await safeFetchJson('/gmail/stats');
    return data?.data || {};
  },

  // Gmail OAuth & Status
  getGmailStatus: async () => {
    const { data } = await safeFetchJson('/gmail/oauth/status');
    return data?.data || { authorized: false };
  },

  connectDemoAccount: async (email = 'sponsorships@hackathon.club') => {
    const { res, data } = await safeFetchJson('/gmail/oauth/demo-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return { res, data };
  },

  disconnectGmail: async () => {
    const { res, data } = await safeFetchJson('/gmail/oauth/disconnect', { method: 'POST' });
    return { res, data };
  },

  // Sponsor Companies
  getSponsors: async () => {
    try {
      const { data } = await safeFetchJson('/companies/rank');
      return Array.isArray(data) ? data : [];
    } catch {
      const { data } = await safeFetchJson('/companies');
      return Array.isArray(data) ? data : [];
    }
  },

  getCompany: async (id) => {
    const { data } = await safeFetchJson(`/companies/${id}`);
    return data.company || data;
  },

  addCompany: async (payload) => {
    const { res, data } = await safeFetchJson('/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { res, data };
  },

  researchCompany: async (companyId) => {
    const { res, data } = await safeFetchJson('/companies/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    return { res, data };
  },

  deleteCompany: async (companyId) => {
    const { res, data } = await safeFetchJson(`/companies/${companyId}`, { method: 'DELETE' });
    return { res, data };
  },

  // Email Proposals & Approval Queue
  getEmails: async () => {
    const { data } = await safeFetchJson('/emails');
    return data?.data?.emails || (Array.isArray(data) ? data : []);
  },

  getApprovalHistory: async (emailId) => {
    const { data } = await safeFetchJson(`/emails/${emailId}/approval-history`);
    return data?.data || [];
  },

  generateDraft: async (companyId) => {
    const { res, data } = await safeFetchJson('/emails/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    return { res, data };
  },

  approveEmail: async (emailId, reviewerName = 'Partnerships Director') => {
    const { res, data } = await safeFetchJson(`/emails/${emailId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName, notes: 'Verified tier, ask, and value proposition.' })
    });
    return { res, data };
  },

  rejectEmail: async (emailId, reason, reviewerName = 'Partnerships Lead') => {
    const { res, data } = await safeFetchJson(`/emails/${emailId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName, reason })
    });
    return { res, data };
  },

  saveEmailEdit: async (payload) => {
    const { res, data } = await safeFetchJson('/emails/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { res, data };
  },

  regenerateDraft: async (emailId, customInstructions) => {
    const { res, data } = await safeFetchJson('/emails/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, customInstructions })
    });
    return { res, data };
  },

  sendEmail: async (emailId, to) => {
    const { res, data } = await safeFetchJson('/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, to })
    });
    return { res, data };
  },

  // Outreach CRM
  getOutreach: async (mode = 'all') => {
    const url = mode === 'due' ? '/outreach/pending-followups' : '/outreach';
    const { data } = await safeFetchJson(url);
    return mode === 'due' ? (data.pendingFollowUps || []) : (Array.isArray(data) ? data : []);
  },

  assignOutreach: async (payload) => {
    const { res, data } = await safeFetchJson('/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { res, data };
  },

  registerFollowUp: async (outreachId, notes = 'Follow-up registered via CRM') => {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    return { res, data };
  },

  updateOutreachStatus: async (outreachId, status) => {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason: 'Manual status update via dashboard' })
    });
    return { res, data };
  },

  closeOutreach: async (outreachId, reason) => {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return { res, data };
  },

  getOutreachTimeline: async (outreachId) => {
    const { data } = await safeFetchJson(`/outreach/${outreachId}`);
    return data.timeline || [];
  },

  // Team Members
  getTeamMembers: async () => {
    const { data } = await safeFetchJson('/team-members');
    return Array.isArray(data) ? data : [];
  },

  addTeamMember: async (payload) => {
    const { res, data } = await safeFetchJson('/team-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { res, data };
  },

  // Gmail Threads & AI Classification
  getThread: async (threadId) => {
    const { data } = await safeFetchJson(`/gmail/thread/${threadId}?mock=true`);
    return data?.data?.thread;
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
    return { res, data };
  },

  // 12-Step Judge Demo Simulation
  runSimulation: async (payload) => {
    const { res, data } = await safeFetchJson('/gmail/demo/simulate-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { res, data };
  }
};
