// ─── SponcyBot Complete Frontend Client Logic ────────────────────────────────

let currentTab = 'dashboard';
let currentEmailId = null;
let currentCompanyId = null;
let currentThreadId = null;
let currentSimulateTarget = { outreachId: null, threadId: null, companyName: null, suggestedLabel: 'INTERESTED' };
let activeEmailsCache = [];
let companiesCache = [];
let teamMembersCache = [];

// ─── Resilient API Requester (Prevents Unexpected token 'T' crashes) ────────
async function safeFetchJson(url, options = {}) {
  // Support custom backend base URL if frontend is deployed separately
  const baseUrl = window.API_BASE_URL || localStorage.getItem('SPONCY_API_BASE_URL') || '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  let res;
  try {
    res = await fetch(fullUrl, options);
  } catch (networkErr) {
    updateBackendBanner(false, `Network connection error: Unable to reach backend at ${fullUrl}`);
    throw new Error(`Cannot connect to backend server: ${networkErr.message}. Ensure backend is running.`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    const cleanSnippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

    let diagnosticMsg;
    if (res.status === 404) {
      diagnosticMsg = `Route not found (HTTP 404): "${url}". If deployed, verify your Backend Root Directory and routes.`;
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      diagnosticMsg = `Backend unavailable (HTTP ${res.status}): Server is starting up or crashed. Verify MONGODB_URI and cloud logs.`;
    } else {
      diagnosticMsg = `Server returned HTML (${res.status}): "${cleanSnippet || 'The page could not be displayed'}". Expected JSON.`;
    }

    updateBackendBanner(false, diagnosticMsg);
    throw new Error(diagnosticMsg);
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    updateBackendBanner(false, `Malformed JSON received from ${url}: ${parseErr.message}`);
    throw new Error(`Failed to parse JSON from ${url}: ${parseErr.message}`);
  }

  updateBackendBanner(true);
  return { res, data };
}

function updateBackendBanner(isHealthy, message = '') {
  const banner = document.getElementById('backend-connection-banner');
  const msgEl = document.getElementById('backend-banner-message');
  if (!banner) return;

  if (isHealthy) {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
    if (msgEl && message) msgEl.innerText = message;
  }
}

// ─── Lifecycle Initialization ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  handleUrlQueryParams();
  checkGmailStatus();
  fetchDashboardStats();
});

function handleUrlQueryParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gmail_connected')) {
    const acct = urlParams.get('account') || 'Organizer Mailbox';
    showToast(`Gmail connected successfully for ${acct}!`, 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('gmail_error')) {
    showToast(`Gmail Connection Failed: ${urlParams.get('gmail_error')}`, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ─── Toast Notifications ───────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msg = document.getElementById('toast-message');

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  icon.innerText = icons[type] || 'ℹ️';
  msg.innerText = message;

  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 4200);
}

// ─── Tab Switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  ['dashboard', 'sponsors', 'approval', 'outreach', 'details'].forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (view) {
      if (t === tab) view.classList.remove('hidden');
      else view.classList.add('hidden');
    }
    if (navBtn) {
      if (t === tab) {
        navBtn.classList.add('bg-slate-800', 'text-white');
        navBtn.classList.remove('text-slate-400');
      } else {
        navBtn.classList.remove('bg-slate-800', 'text-white');
        navBtn.classList.add('text-slate-400');
      }
    }
  });

  if (tab === 'dashboard') fetchDashboardStats();
  if (tab === 'sponsors') loadSponsors();
  if (tab === 'approval') loadPendingEmails();
  if (tab === 'outreach') loadOutreachList('all');
}

// ─── Gmail OAuth & Demo Auth Management ─────────────────────────────────────
async function checkGmailStatus() {
  try {
    const { data } = await safeFetchJson('/gmail/oauth/status');
    const dot = document.getElementById('gmail-dot');
    const text = document.getElementById('gmail-status-text');

    const badge = document.getElementById('modal-gmail-badge');
    const acct = document.getElementById('modal-gmail-account');
    const envStatus = document.getElementById('modal-gmail-env-status');

    if (data.success && data.data?.authorized) {
      const email = data.data.email || 'sponsorships@hackathon.club';
      const isDemo = data.data.isDemo;

      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50';
      text.innerText = isDemo ? `Connected: ${email} (Demo)` : `Connected: ${email}`;

      if (badge) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        badge.innerText = isDemo ? 'Connected (Demo Sandbox)' : 'Connected (Live Google OAuth)';
      }
      if (acct) acct.innerText = email;
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
      text.innerText = 'Gmail Offline (Click to connect)';

      if (badge) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40';
        badge.innerText = 'Disconnected';
      }
      if (acct) acct.innerText = 'None (Not Connected)';
    }

    if (envStatus) {
      const hasCreds = Boolean(data.data?.hasGoogleCredentials);
      envStatus.innerHTML = hasCreds
        ? '<span class="text-emerald-400">Configured in .env</span>'
        : '<span class="text-amber-400">Unset (Using Demo Fallback)</span>';
    }

    return data.data;
  } catch (err) {
    console.warn('Gmail status check failed:', err.message);
  }
}

function openGmailModal() {
  checkGmailStatus();
  document.getElementById('modal-gmail').classList.remove('hidden');
}

function closeGmailModal() {
  document.getElementById('modal-gmail').classList.add('hidden');
}

async function connectDemoAccountViaUI() {
  showToast('Connecting demo organizer mailbox...', 'info');
  try {
    const { res, data } = await safeFetchJson('/gmail/oauth/demo-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sponsorships@hackathon.club' })
    });
    if (res.ok) {
      showToast('1-Click Demo Account Connected! Zero Google Cloud setup needed.', 'success');
      await checkGmailStatus();
      closeGmailModal();
    } else {
      showToast(data.message || 'Demo connection failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function disconnectGmailViaUI() {
  try {
    const { res, data } = await safeFetchJson('/gmail/oauth/disconnect', { method: 'POST' });
    if (res.ok) {
      showToast('Gmail account disconnected.', 'info');
      await checkGmailStatus();
    } else {
      showToast(data.message || 'Disconnect failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────
async function fetchDashboardStats() {
  try {
    const { data: resData } = await safeFetchJson('/gmail/stats');
    if (resData.success && resData.data) {
      const d = resData.data;
      document.getElementById('stat-total-sponsors').innerText = d.sponsors?.total ?? 0;
      document.getElementById('stat-pending-approvals').innerText = d.emails?.pendingApproval ?? 0;
      document.getElementById('stat-emails-sent').innerText = d.emails?.totalSent ?? 0;
      document.getElementById('stat-total-outreach').innerText = d.outreach?.totalOutreach ?? 0;
      document.getElementById('stat-followups-due').innerText = d.outreach?.pendingFollowUpsDue ?? 0;
      document.getElementById('stat-meetings').innerText = d.outreach?.conversionsCount ?? 0;

      // Update badge on Approval tab
      const badge = document.getElementById('badge-pending-count');
      if (badge) {
        const count = d.emails?.pendingApproval || 0;
        badge.innerText = count;
        if (count > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err.message);
  }
}

// ─── Screen 2: Sponsors (Intelligence & Research) ───────────────────────────
async function loadSponsors() {
  const tbody = document.getElementById('sponsors-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Loading sponsors...</td></tr>';

  try {
    let companies;
    try {
      const result = await safeFetchJson('/companies/rank');
      companies = result.data;
    } catch (e) {
      const fallback = await safeFetchJson('/companies');
      companies = fallback.data;
    }

    companiesCache = Array.isArray(companies) ? companies : [];

    if (!Array.isArray(companies) || companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-500">No sponsors found. Click "+ Add Sponsor Company" above!</td></tr>';
      return;
    }

    tbody.innerHTML = companies.map((c, idx) => {
      const compId = c._id || c.id;
      const tierBadgeColor = {
        Platinum: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
        Gold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        Silver: 'bg-slate-400/10 text-slate-300 border-slate-500/30',
        Bronze: 'bg-orange-500/10 text-orange-300 border-orange-500/30'
      }[c.recommendedTier] || 'bg-slate-800 text-slate-400 border-slate-700';

      const askIcon = {
        money: '💰 Cash',
        goodies: '🎁 Swag/Prizes',
        infra: '☁️ Cloud Credits'
      }[c.recommendedAsk] || (c.recommendedAsk || 'General');

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-medium text-white">
            <div class="flex items-center space-x-2">
              <span class="text-slate-500 font-mono text-[10px]">#${idx + 1}</span>
              <span class="font-semibold">${c.name || c.company}</span>
            </div>
            ${c.website ? `<a href="${c.website}" target="_blank" class="text-[11px] text-slate-500 hover:text-slate-300 underline block mt-0.5">${c.website}</a>` : ''}
          </td>
          <td class="py-3 px-4 text-slate-400">${c.category || c.industry || 'Technology'}</td>
          <td class="py-3 px-4">
            <span class="font-mono font-bold ${c.score >= 75 ? 'text-emerald-400' : c.score >= 60 ? 'text-blue-400' : 'text-slate-300'}">
              ${c.score || 0}/100
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[11px] font-medium border ${tierBadgeColor}">
              ${c.recommendedTier || 'Bronze'}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-300 font-medium">${askIcon}</td>
          <td class="py-3 px-4 text-slate-400 text-[11px]">
            ${c.contactName ? `<span class="text-slate-300">${c.contactName}</span><br>` : ''}
            <span class="text-slate-500">${c.contactEmail || 'No email registered'}</span>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end space-x-1.5">
              <button onclick="triggerCompanyResearch('${compId}')" title="Research company using Tavily + Gemini" class="px-2 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded border border-purple-500/30 transition text-[11px] flex items-center space-x-1">
                <span>🔍 AI Research</span>
              </button>
              <button onclick="triggerDraftGeneration('${compId}')" title="Generate AI proposal draft" class="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded border border-emerald-500/30 transition text-[11px]">
                ✍️ Draft
              </button>
              <button onclick="openAssignOutreachModal('${compId}')" title="Assign to team member" class="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded border border-blue-500/30 transition text-[11px]">
                👤 Assign
              </button>
              <button onclick="viewSponsorDeepDive('${compId}')" title="View 6-factor score breakdown" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition text-[11px]">
                Inspect &rarr;
              </button>
              <button onclick="deleteSponsorCompany('${compId}', '${c.name || c.company}')" title="Delete Sponsor" class="px-1.5 py-1 text-slate-500 hover:text-red-400 rounded transition text-[11px]">
                ✕
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-red-400">Error loading sponsors: ${err.message}</td></tr>`;
  }
}

function openAddSponsorModal() {
  document.getElementById('modal-add-sponsor').classList.remove('hidden');
}

function closeAddSponsorModal() {
  document.getElementById('modal-add-sponsor').classList.add('hidden');
}

async function submitAddSponsor(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const payload = {
    name: formData.get('name'),
    website: formData.get('website'),
    category: formData.get('category'),
    contactEmail: formData.get('contactEmail')
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Analyzing & Saving...';
  }

  showToast(`Adding and researching sponsor '${payload.name}'...`, 'info');

  try {
    const { res, data } = await safeFetchJson('/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(`Sponsor '${payload.name}' added with score ${data.score || 0}/100!`, 'success');
      closeAddSponsorModal();
      form.reset();
      await loadSponsors();
      fetchDashboardStats();
      const compId = data._id || data.id;
      if (compId) {
        viewSponsorDeepDive(compId);
      }
    } else {
      const errorMsg = data.error ? `${data.message}: ${data.error}` : (data.message || 'Failed to add sponsor');
      showToast(errorMsg, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Save Sponsor';
    }
  }
}

async function triggerCompanyResearch(companyId) {
  showToast('Researching sponsor with Tavily search + Gemini analysis...', 'info');
  try {
    const { res, data } = await safeFetchJson('/companies/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    if (res.ok) {
      const tier = data.recommendedTier || 'Silver';
      const score = data.score || 0;
      showToast(`Research complete for ${data.name}! Score: ${score}/100 · Tier: ${tier}`, 'success');
      loadSponsors();
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Research failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSponsorCompany(companyId, name) {
  if (!confirm(`Are you sure you want to remove '${name}' from sponsors?`)) return;
  try {
    const { res, data } = await safeFetchJson(`/companies/${companyId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Removed '${name}'`, 'info');
      loadSponsors();
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Failed to delete company', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function triggerDraftGeneration(companyId) {
  showToast('Generating personalized AI draft...', 'info');
  try {
    const { res, data } = await safeFetchJson('/emails/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    if (res.ok) {
      showToast('Draft generated in PENDING_APPROVAL status!', 'success');
      switchTab('approval');
    } else {
      showToast(data.message || 'Generation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Screen 3: Approval Queue (Human-in-the-Loop Send Guard) ────────────────
async function loadPendingEmails() {
  const container = document.getElementById('drafts-list');
  container.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">Loading drafts...</div>';

  try {
    const { data } = await safeFetchJson('/emails');
    const emails = data.data?.emails || (Array.isArray(data) ? data : []);
    activeEmailsCache = emails;

    document.getElementById('queue-count-badge').innerText = `${emails.length} drafts`;

    if (emails.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500 text-center py-8">No drafts available. Generate one from the Sponsors screen!</div>';
      document.getElementById('email-detail-container').innerHTML = `
        <div class="flex items-center justify-center h-full text-slate-500 text-xs py-24">
          Select an email draft from the left to inspect, edit, or approve.
        </div>
      `;
      return;
    }

    container.innerHTML = emails.map((em) => {
      const statusBadge = {
        PENDING_APPROVAL: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        SENT: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        DRAFT: 'bg-slate-700 text-slate-300 border-slate-600'
      }[em.status] || 'bg-slate-800 text-slate-400';

      return `
        <div onclick="selectEmail('${em._id}')" id="draft-item-${em._id}" class="p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 cursor-pointer transition text-left space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-white text-xs truncate max-w-[180px]">${em.subject || 'No Subject'}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase border ${statusBadge}">${em.status}</span>
          </div>
          <p class="text-[11px] text-slate-400 line-clamp-1">${(em.body || '').slice(0, 70)}...</p>
          <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1">
            <span>Ask: <strong class="text-slate-400">${em.askType || 'money'}</strong></span>
            <span>v${em.version || 1}</span>
          </div>
        </div>
      `;
    }).join('');

    const targetEmailId = currentEmailId && emails.some(e => e._id === currentEmailId)
      ? currentEmailId
      : emails[0]._id;

    selectEmail(targetEmailId);
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-red-400 text-center py-6">Error: ${err.message}</div>`;
  }
}

async function selectEmail(emailId) {
  currentEmailId = emailId;
  const detailContainer = document.getElementById('email-detail-container');
  const email = activeEmailsCache.find(e => e._id === emailId);
  if (!email) return;

  // Highlight selected item in sidebar
  document.querySelectorAll('[id^="draft-item-"]').forEach(el => el.classList.remove('border-emerald-500/50', 'bg-slate-800'));
  const activeEl = document.getElementById(`draft-item-${emailId}`);
  if (activeEl) activeEl.classList.add('border-emerald-500/50', 'bg-slate-800');

  // Fetch approval history
  let historyLogs = [];
  try {
    const { data: histData } = await safeFetchJson(`/emails/${emailId}/approval-history`);
    if (histData.success) historyLogs = histData.data || [];
  } catch (e) {}

  const isApproved = email.status === 'APPROVED';
  const isSent = email.status === 'SENT';

  detailContainer.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-mono uppercase px-2 py-0.5 rounded border ${isApproved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : isSent ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}">
              Status: ${email.status}
            </span>
            <span class="text-xs text-slate-400">Version: <strong>v${email.version || 1}</strong></span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Email ID: <span class="font-mono text-slate-500">${email._id}</span></p>
        </div>
        <div class="flex items-center space-x-2">
          ${isApproved ? `
            <button onclick="sendApprovedEmail('${email._id}')" class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center space-x-1.5">
              <span>🚀 Send via Gmail</span>
            </button>
          ` : isSent ? `
            <div class="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1">
              <span>✓ Dispatched to Gmail</span>
            </div>
          ` : `
            <button onclick="approveEmailDraft('${email._id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow-sm">
              ✓ Approve Draft
            </button>
            <button onclick="rejectEmailDraft('${email._id}')" class="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-medium text-xs rounded-lg transition">
              ✕ Reject & Rewrite
            </button>
          `}
        </div>
      </div>

      <!-- Send Guard status banner -->
      ${!isApproved && !isSent ? `
        <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
          <span>🛡️</span>
          <span><strong>Send Guard Locked:</strong> This email cannot be sent via Gmail API until a human reviewer explicitly approves it.</span>
        </div>
      ` : ''}

      <!-- Editable Subject -->
      <div class="space-y-1">
        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Subject Line</label>
        <input type="text" id="edit-subject" value="${email.subject || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-medium">
      </div>

      <!-- Editable Body -->
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Body</label>
          <span class="text-[10px] text-slate-500">Edit text before approving</span>
        </div>
        <textarea id="edit-body" rows="9" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono leading-relaxed resize-none">${email.body || ''}</textarea>
      </div>

      <!-- Quick Edit & Regenerate Controls -->
      <div class="flex items-center space-x-2 pt-1 border-b border-slate-800 pb-3">
        <button onclick="saveEditAsVersion('${email._id}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition">
          💾 Save Edit as New Version
        </button>
        <button onclick="regenerateDraft('${email._id}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition">
          🔄 AI Regenerate (New Angle)
        </button>
      </div>

      <!-- Audit Trail / Version History -->
      <div class="space-y-2">
        <h4 class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Approval Audit Trail</h4>
        <div class="space-y-1 max-h-32 overflow-y-auto">
          ${historyLogs.length === 0 ? '<p class="text-slate-500 text-[11px]">No approval actions recorded yet.</p>' : ''}
          ${historyLogs.map(l => `
            <div class="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
              <div class="flex items-center space-x-2">
                <span class="font-bold ${l.decision === 'APPROVED' ? 'text-emerald-400' : 'text-red-400'}">${l.decision}</span>
                <span class="text-slate-400">by ${l.reviewerName || 'Human'}</span>
                ${l.notes ? `<span class="text-slate-500 italic">"${l.notes}"</span>` : ''}
              </div>
              <span class="text-[10px] text-slate-500 font-mono">${new Date(l.decidedAt).toLocaleTimeString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

async function approveEmailDraft(emailId) {
  const reviewer = prompt('Reviewer Name (or press OK for default):', 'Partnerships Director') || 'Partnerships Director';
  try {
    const { res, data } = await safeFetchJson(`/emails/${emailId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName: reviewer, notes: 'Verified tier, ask, and value proposition.' })
    });
    if (res.ok) {
      showToast('Email approved! Send Guard now permits outbound send.', 'success');
      loadPendingEmails();
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Approval failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rejectEmailDraft(emailId) {
  const reason = prompt('Reason for rejection (this will guide the rewrite loop):', 'Needs to highlight cloud credits and student bounty track.');
  if (!reason) return;

  try {
    const { res, data } = await safeFetchJson(`/emails/${emailId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName: 'Partnerships Lead', reason })
    });
    if (res.ok) {
      showToast('Draft rejected and moved back to DRAFT for rewrite loop.', 'warning');
      loadPendingEmails();
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Rejection failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveEditAsVersion(emailId) {
  const subject = document.getElementById('edit-subject').value;
  const body = document.getElementById('edit-body').value;

  try {
    const { res, data } = await safeFetchJson('/emails/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, subject, body, notes: 'Human review adjustments' })
    });
    if (res.ok) {
      showToast('New version saved successfully!', 'success');
      loadPendingEmails();
    } else {
      showToast(data.message || 'Save failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function regenerateDraft(emailId) {
  showToast('Regenerating new draft with dynamic prompt angle...', 'info');
  try {
    const { res, data } = await safeFetchJson('/emails/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, customInstructions: 'Emphasize student builder community and resume books' })
    });
    if (res.ok) {
      showToast('New draft version created!', 'success');
      loadPendingEmails();
    } else {
      showToast(data.message || 'Regeneration failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function sendApprovedEmail(emailId) {
  const to = prompt('Recipient sponsor email address:', 'sponsorships@techcorp.io');
  if (!to) return;

  showToast('Send Guard checking status === APPROVED before dispatch...', 'info');

  try {
    const { res, data } = await safeFetchJson('/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, to })
    });
    if (res.ok) {
      showToast(`Email dispatched via Gmail! Thread ID: ${data.data?.threadId}`, 'success');
      loadPendingEmails();
      fetchDashboardStats();
    } else {
      showToast(`Send Guard Blocked: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Screen 4: Outreach CRM & Follow-Up Tracker ────────────────────────────
async function loadOutreachList(mode = 'all') {
  const tbody = document.getElementById('outreach-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Loading outreach records...</td></tr>';

  try {
    const url = mode === 'due' ? '/outreach/pending-followups' : '/outreach';
    const { data } = await safeFetchJson(url);
    const list = mode === 'due' ? (data.pendingFollowUps || []) : (Array.isArray(data) ? data : []);

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">No ${mode === 'due' ? 'pending follow-ups due right now' : 'outreach records'}. Click "+ Assign Sponsor" to start!</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((o) => {
      const statusBadge = {
        DRAFT: 'bg-slate-700 text-slate-300 border-slate-600',
        SENT: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        'WAITING FOR REPLY': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        INTERESTED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        MEETING: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        'FOLLOW-UP 1': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        'FOLLOW-UP 2': 'bg-pink-500/20 text-pink-300 border-pink-500/40',
        DECLINED: 'bg-red-500/20 text-red-300 border-red-500/40',
        CLOSED: 'bg-slate-700 text-slate-400 border-slate-600'
      }[o.status] || 'bg-slate-800 text-slate-400';

      const isCapped = (o.followUpCount || 0) >= 2;
      const compName = o.companyId?.name || 'Sponsor';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-medium text-white">
            <span class="font-semibold">${compName}</span>
          </td>
          <td class="py-3 px-4 text-slate-300">${o.memberId?.name || 'Unassigned'}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[11px] font-mono border ${statusBadge}">
              ${o.status}
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="font-mono ${isCapped ? 'text-red-400 font-bold' : 'text-slate-300'}">
              ${o.followUpCount || 0}/2 ${isCapped ? '(MAX)' : ''}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-400 text-[11px]">
            ${o.nextFollowUpAt ? new Date(o.nextFollowUpAt).toLocaleDateString() : '<span class="text-slate-600">None</span>'}
          </td>
          <td class="py-3 px-4 text-slate-400 text-[11px]">
            ${o.lastContactedAt ? new Date(o.lastContactedAt).toLocaleDateString() : 'Initial'}
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end space-x-1.5">
              ${!isCapped && !['CLOSED', 'DECLINED'].includes(o.status) ? `
                <button onclick="registerFollowUp('${o._id}')" title="Send Follow-up (Strict Max 2)" class="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded border border-blue-500/30 transition text-[11px]">
                  Follow-up
                </button>
              ` : `
                <span class="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">Capped</span>
              `}
              
              <button onclick="openSimulateReplyModal('${o._id}', '${o.threadId || ''}', '${compName}')" title="Simulate Sponsor Inbound Reply" class="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded border border-emerald-500/30 transition text-[11px]">
                💬 Reply
              </button>

              <button onclick="viewOutreachTimeline('${o._id}', '${compName}')" title="View Audit Event Log" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition text-[11px]">
                📜 Audit
              </button>

              <button onclick="changeOutreachStatus('${o._id}')" title="Update Status Manually" class="px-1.5 py-1 text-slate-400 hover:text-white rounded text-[11px]">
                ⚙️
              </button>

              ${o.status !== 'CLOSED' ? `
                <button onclick="closeOutreachPrompt('${o._id}')" title="Close Outreach" class="px-1.5 py-1 text-slate-500 hover:text-red-400 rounded text-[11px]">
                  ✕
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-red-400">Error: ${err.message}</td></tr>`;
  }
}

async function registerFollowUp(outreachId) {
  try {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Follow-up registered via CRM' })
    });
    if (res.ok) {
      showToast(data.message, 'success');
      loadOutreachList('all');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Follow-up blocked (max 2 limit reached)', 'warning');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changeOutreachStatus(outreachId) {
  const allowed = ['WAITING FOR REPLY', 'INTERESTED', 'MEETING', 'DECLINED', 'CLOSED'];
  const newStatus = prompt(`Enter new status (${allowed.join(', ')}):`, 'INTERESTED');
  if (!newStatus || !allowed.includes(newStatus)) return;

  try {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, reason: 'Manual status update via dashboard' })
    });
    if (res.ok) {
      showToast(`Status updated to ${newStatus}`, 'success');
      loadOutreachList('all');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Status update failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function closeOutreachPrompt(outreachId) {
  const reason = prompt('Reason for closing outreach:', 'Unresponsive after max follow-ups') || 'Closed by organizer';
  try {
    const { res, data } = await safeFetchJson(`/outreach/${outreachId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (res.ok) {
      showToast('Outreach closed successfully.', 'info');
      loadOutreachList('all');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Failed to close outreach', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function pollInboxReplies() {
  showToast('Polling inbox messages...', 'info');
  try {
    const { res, data } = await safeFetchJson('/gmail/messages?mock=true');
    if (res.ok) {
      showToast(`Inbox poll complete: ${data.count || 0} messages tracked.`, 'success');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Failed to poll inbox', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Assign Outreach Modal ──────────────────────────────────────────────────
async function openAssignOutreachModal(preselectedCompanyId = null) {
  const modal = document.getElementById('modal-assign-outreach');
  const compSelect = document.getElementById('assign-company-select');
  const memberSelect = document.getElementById('assign-member-select');
  const warningBox = document.getElementById('assign-duplicate-warning');

  warningBox.classList.add('hidden');
  modal.classList.remove('hidden');

  compSelect.innerHTML = '<option value="">Loading companies...</option>';
  memberSelect.innerHTML = '<option value="">Loading team members...</option>';

  try {
    // 1. Load companies
    let companies = [];
    try {
      const compRes = await safeFetchJson('/companies');
      companies = Array.isArray(compRes.data) ? compRes.data : [];
    } catch (e) {}
    companiesCache = companies;

    compSelect.innerHTML = companies.map(c => `
      <option value="${c._id || c.id}" ${preselectedCompanyId === (c._id || c.id) ? 'selected' : ''}>
        ${c.name} (${c.category || 'Tech'}) - Tier: ${c.recommendedTier || 'Silver'}
      </option>
    `).join('');

    // 2. Load team members
    let members = [];
    try {
      const memberRes = await safeFetchJson('/team-members');
      members = Array.isArray(memberRes.data) ? memberRes.data : [];
    } catch (e) {}
    teamMembersCache = members;

    if (teamMembersCache.length === 0) {
      memberSelect.innerHTML = '<option value="">No team members yet. Click "+ New Member" to add one.</option>';
    } else {
      memberSelect.innerHTML = teamMembersCache.map(m => `
        <option value="${m._id}">${m.name} (${m.role || 'Coordinator'})</option>
      `).join('');
    }
  } catch (err) {
    compSelect.innerHTML = '<option value="">Error loading list</option>';
  }
}

function closeAssignOutreachModal() {
  document.getElementById('modal-assign-outreach').classList.add('hidden');
}

async function submitAssignOutreach(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const payload = {
    companyId: formData.get('companyId'),
    memberId: formData.get('memberId'),
    notes: formData.get('notes')
  };

  const warningBox = document.getElementById('assign-duplicate-warning');
  const warningMsg = document.getElementById('assign-duplicate-message');

  try {
    const { res, data } = await safeFetchJson('/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      // DUPLICATE OUTREACH PREVENTED!
      warningBox.classList.remove('hidden');
      warningMsg.innerText = data.message || 'Duplicate outreach prevented: An active outreach already exists for this company.';
      showToast('Duplicate outreach blocked by system rule!', 'warning');
      return;
    }

    if (res.ok) {
      showToast('Sponsor assigned to outreach successfully!', 'success');
      closeAssignOutreachModal();
      form.reset();
      loadOutreachList('all');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Failed to assign outreach', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Add Team Member Modal ──────────────────────────────────────────────────
function openAddMemberModal() {
  document.getElementById('modal-add-member').classList.remove('hidden');
}

function closeAddMemberModal() {
  document.getElementById('modal-add-member').classList.add('hidden');
}

async function submitAddMember(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role')
  };

  try {
    const { res, data } = await safeFetchJson('/team-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast(`Team member '${payload.name}' added!`, 'success');
      closeAddMemberModal();
      form.reset();
      openAssignOutreachModal();
    } else {
      showToast(data.message || 'Failed to add team member', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Outreach Timeline / Audit Modal ────────────────────────────────────────
async function viewOutreachTimeline(outreachId, companyName = 'Sponsor') {
  const modal = document.getElementById('modal-outreach-timeline');
  const container = document.getElementById('timeline-events-container');
  const badge = document.getElementById('timeline-company-badge');

  badge.innerText = companyName;
  modal.classList.remove('hidden');
  container.innerHTML = '<p class="text-slate-500 text-center py-8">Loading audit trail...</p>';

  try {
    const { data } = await safeFetchJson(`/outreach/${outreachId}`);
    const events = data.timeline || [];

    if (events.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-center py-8">No audit events recorded for this outreach.</p>';
      return;
    }

    container.innerHTML = events.map((ev, idx) => `
      <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start space-x-3">
        <span class="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
          #${idx + 1}
        </span>
        <div class="flex-1 space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-white text-xs">${ev.eventType || 'STATUS_CHANGE'}</span>
            <span class="text-[10px] text-slate-500 font-mono">${new Date(ev.createdAt).toLocaleString()}</span>
          </div>
          <p class="text-slate-300 text-[11px]">${ev.description || 'Transitioned status'}</p>
          <div class="text-[10px] text-slate-500">
            ${ev.fromStatus ? `From: <strong class="text-slate-400">${ev.fromStatus}</strong> &rarr; ` : ''}
            To: <strong class="text-emerald-400">${ev.toStatus || 'CURRENT'}</strong>
            ${ev.memberId?.name ? ` · Actor: <span class="text-slate-300">${ev.memberId.name}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading audit: ${err.message}</p>`;
  }
}

function closeOutreachTimelineModal() {
  document.getElementById('modal-outreach-timeline').classList.add('hidden');
}

// ─── Simulate Reply & AI Classification Modal ───────────────────────────────
function openSimulateReplyModal(outreachId, threadId, companyName) {
  currentSimulateTarget = {
    outreachId,
    threadId: threadId || `demo_thread_${Date.now()}`,
    companyName: companyName || 'Sponsor Company',
    suggestedLabel: 'INTERESTED'
  };

  document.getElementById('modal-simulate-reply').classList.remove('hidden');
  document.getElementById('simulate-classification-result').classList.add('hidden');
  setReplyPreset('INTERESTED');
}

function closeSimulateReplyModal() {
  document.getElementById('modal-simulate-reply').classList.add('hidden');
}

function setReplyPreset(type) {
  const textarea = document.getElementById('simulate-reply-text');
  if (type === 'INTERESTED') {
    textarea.value = `Hi Team,\n\nThanks for reaching out! We are definitely interested in supporting the ACM Hackathon. Could you send over the Gold tier deliverables deck? Let's connect on a 15-minute call this Thursday.`;
  } else if (type === 'DECLINED') {
    textarea.value = `Hello,\n\nThank you for thinking of us. Unfortunately our university sponsorship budget for this quarter is fully committed, so we will have to pass this year.`;
  } else {
    textarea.value = `Hi,\n\nI am currently out of office on business travel until next Tuesday. Please follow up with me next week.`;
  }
}

async function runSimulateReplyClassification() {
  const replyText = document.getElementById('simulate-reply-text').value;
  if (!replyText.trim()) {
    showToast('Please enter sponsor reply text to classify', 'warning');
    return;
  }

  showToast('Analyzing sponsor reply sentiment with AI...', 'info');

  try {
    const { res, data } = await safeFetchJson('/gmail/replies/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replyText,
        companyName: currentSimulateTarget.companyName,
        threadId: currentSimulateTarget.threadId
      })
    });
    if (res.ok && data.data) {
      const cls = data.data;
      currentSimulateTarget.suggestedLabel = cls.suggestedLabel;

      const resultBox = document.getElementById('simulate-classification-result');
      const badge = document.getElementById('sim-result-badge');
      const conf = document.getElementById('sim-result-confidence');
      const reason = document.getElementById('sim-result-reason');
      const confirmBtn = document.getElementById('sim-confirm-btn');

      resultBox.classList.remove('hidden');
      badge.innerText = cls.suggestedLabel;
      conf.innerText = `Confidence: ${cls.confidence || 'HIGH'}`;
      reason.innerText = cls.reason || 'AI classified intent based on sponsor message.';

      const badgeColor = {
        INTERESTED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
        DECLINED: 'bg-red-500/20 text-red-300 border border-red-500/40',
        OTHER: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      }[cls.suggestedLabel] || 'bg-slate-800 text-slate-300';

      badge.className = `px-2 py-0.5 rounded text-[11px] font-bold font-mono ${badgeColor}`;
      confirmBtn.innerText = `Confirm Outcome '${cls.suggestedLabel}' & Update CRM`;
    } else {
      showToast(data.message || 'Classification failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmSimulatedOutcome() {
  const label = currentSimulateTarget.suggestedLabel || 'INTERESTED';
  showToast(`Confirming reply outcome: ${label}...`, 'info');

  try {
    const { res, data } = await safeFetchJson('/gmail/replies/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: currentSimulateTarget.threadId,
        outreachId: currentSimulateTarget.outreachId,
        label,
        confirmedBy: 'Partnerships Director',
        notes: `Simulated inbound sponsor reply confirmed as ${label}`
      })
    });
    if (res.ok) {
      showToast(`Outcome confirmed! Outreach status updated to ${label}.`, 'success');
      closeSimulateReplyModal();
      loadOutreachList('all');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Confirmation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Screen 5: Sponsor Deep Dive & Live Thread Viewer ───────────────────────
async function viewSponsorDeepDive(companyId) {
  currentCompanyId = companyId;
  switchTab('details');

  try {
    const { data } = await safeFetchJson(`/companies/${companyId}`);
    const company = data.company || data;

    const tier = company.recommendedTier || 'Bronze';
    const tierColor = {
      Platinum: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      Gold: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      Silver: 'bg-slate-400/20 text-slate-300 border-slate-500/40',
      Bronze: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
    }[tier] || 'bg-slate-800 text-slate-300 border-slate-700';

    const tierBadge = document.getElementById('detail-tier-badge');
    tierBadge.className = `text-xs px-2.5 py-0.5 rounded border font-semibold ${tierColor}`;
    tierBadge.innerText = `Tier: ${tier}`;

    document.getElementById('detail-company-title').innerText = company.name || company.company || 'Company Details';
    document.getElementById('detail-company-sub').innerText = `${company.category || company.industry || 'Technology'} · Score: ${company.score || 0}/100`;

    document.getElementById('detail-research-text').innerText = company.research || 'No research available yet. Click "🔍 Refresh AI Research" above.';
    document.getElementById('detail-strategy-text').innerText = company.strategy || 'Direct partnership pitch with track branding.';
    document.getElementById('detail-ask-text').innerText = `${company.recommendedAsk || 'money'} (${company.whatToAsk || 'Sponsorship'})`;

    // 6-Factor Scores
    document.getElementById('score-eventFit').innerText = `${company.eventFit || 0}/25`;
    document.getElementById('score-sponsorshipEvidence').innerText = `${company.sponsorshipEvidence || 0}/20`;
    document.getElementById('score-educationCommunityFit').innerText = `${company.educationCommunityFit || 0}/15`;
    document.getElementById('score-productRelevance').innerText = `${company.productRelevance || 0}/15`;
    document.getElementById('score-audienceFit').innerText = `${company.audienceFit || 0}/15`;
    document.getElementById('score-sponsorshipPotential').innerText = `${company.sponsorshipPotential || 0}/10`;

    // Try finding associated outreach thread
    let outList = [];
    try {
      const outRes = await safeFetchJson(`/outreach?companyId=${companyId}`);
      outList = Array.isArray(outRes.data) ? outRes.data : [];
    } catch (e) {}

    if (Array.isArray(outList) && outList[0] && outList[0].threadId) {
      openThread(outList[0].threadId);
    } else {
      currentThreadId = null;
      document.getElementById('thread-id-display').innerText = 'No thread active';
      document.getElementById('ai-suggestion-box').classList.add('hidden');
      document.getElementById('thread-messages-list').innerHTML = '<div class="text-xs text-slate-500 text-center py-16">No conversation messages recorded yet.</div>';
    }
  } catch (err) {
    showToast(`Failed to load company details: ${err.message}`, 'error');
  }
}

async function reResearchCurrentCompany() {
  if (!currentCompanyId) {
    showToast('No sponsor selected to refresh research.', 'warning');
    return;
  }
  showToast('Refreshing sponsor AI research...', 'info');
  try {
    const { res, data } = await safeFetchJson('/companies/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: currentCompanyId })
    });
    if (res.ok) {
      showToast(`Research updated! Score: ${data.score || 0}/100 · Tier: ${data.recommendedTier || 'Silver'}`, 'success');
      viewSponsorDeepDive(currentCompanyId);
      loadSponsors();
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Failed to refresh research', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function loadThreadByInput() {
  const val = document.getElementById('manual-thread-id').value;
  if (!val) return;
  openThread(val);
}

async function openThread(threadId) {
  currentThreadId = threadId;
  switchTab('details');
  document.getElementById('thread-id-display').innerText = `Thread: ${threadId}`;
  const container = document.getElementById('thread-messages-list');
  container.innerHTML = '<div class="text-xs text-slate-500 text-center py-10">Fetching thread from Gmail API...</div>';

  try {
    const { data } = await safeFetchJson(`/gmail/thread/${threadId}?mock=true`);
    const thread = data.data?.thread;

    if (!thread || !thread.messages || thread.messages.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500 text-center py-10">No messages found in this thread.</div>';
      return;
    }

    // AI Classification Box
    const suggestBox = document.getElementById('ai-suggestion-box');
    if (thread.suggestedLabel && thread.suggestedLabel !== 'PENDING_CLASSIFICATION') {
      suggestBox.classList.remove('hidden');
      document.getElementById('ai-suggested-label-badge').innerText = thread.suggestedLabel;
      document.getElementById('ai-confidence-badge').innerText = `Confidence: ${thread.confidence || 'HIGH'}`;
      document.getElementById('ai-reason-text').innerText = thread.classificationReason || 'AI analyzed sponsor intent.';
    } else {
      suggestBox.classList.add('hidden');
    }

    container.innerHTML = thread.messages.map(m => {
      const isSponsor = m.isFromSponsor;
      return `
        <div class="flex flex-col ${isSponsor ? 'items-start' : 'items-end'} space-y-1">
          <div class="flex items-center space-x-1.5 text-[10px] text-slate-500">
            <span>${isSponsor ? '🏢 Sponsor' : '⚡ Organizer'}</span>
            <span>·</span>
            <span>${new Date(m.date).toLocaleTimeString()}</span>
          </div>
          <div class="max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${isSponsor ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/30'}">
            <p>${m.body || m.snippet}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-red-400 text-center py-10">Error loading thread: ${err.message}</div>`;
  }
}

async function confirmOutcome(label) {
  if (!currentThreadId) return;
  try {
    const { res, data } = await safeFetchJson('/gmail/replies/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: currentThreadId,
        label,
        confirmedBy: 'Partnerships Lead',
        notes: `Human confirmed outcome: ${label}`
      })
    });
    if (res.ok) {
      showToast(`Reply outcome '${label}' confirmed! Outreach CRM updated.`, 'success');
      document.getElementById('ai-suggestion-box').classList.add('hidden');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Confirmation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── 12-Step Judge Walkthrough Simulation Modal ─────────────────────────────
async function triggerDemoSimulation() {
  const modal = document.getElementById('modal-demo');
  const container = document.getElementById('demo-steps-container');
  modal.classList.remove('hidden');
  container.innerHTML = '<div class="py-12 text-center text-slate-400 text-xs animate-pulse">Running live 12-step SponcyBot lifecycle simulation...</div>';

  try {
    const { res, data } = await safeFetchJson('/gmail/demo/simulate-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'CloudScale Compute Systems',
        reviewerName: 'ACM Partnerships Lead',
        simulateReply: 'INTERESTED'
      })
    });

    if (res.ok && data.data && data.data.timeline) {
      const steps = data.data.timeline;
      container.innerHTML = steps.map(s => {
        const ownerColor = {
          'Research': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          'Email AI': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          'Outreach CRM': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          'Gmail': 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }[s.owner] || 'bg-slate-800 text-slate-300';

        return `
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start space-x-3">
            <span class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-white shrink-0 mt-0.5">
              ${s.step}
            </span>
            <div class="flex-1 space-y-1">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-white text-xs">${s.title}</span>
                <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold border ${ownerColor}">${s.owner}</span>
              </div>
              <p class="text-[11px] text-slate-300">${s.details}</p>
            </div>
          </div>
        `;
      }).join('');
      fetchDashboardStats();
    } else {
      container.innerHTML = `<div class="py-8 text-center text-red-400 text-xs">Simulation failed: ${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="py-8 text-center text-red-400 text-xs">Error: ${err.message}</div>`;
  }
}

function closeDemoModal() {
  document.getElementById('modal-demo').classList.add('hidden');
}

