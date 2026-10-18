// ─── SponcyBot Demo UI Client Logic ─────────────────────────────────────────

let currentTab = 'dashboard';
let currentEmailId = null;
let currentCompanyId = null;
let currentThreadId = null;
let activeEmailsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  checkGmailStatus();
  fetchDashboardStats();
});

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
  }, 4000);
}

// ─── Tab Switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  ['dashboard', 'sponsors', 'approval', 'outreach', 'details'].forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (view) {
      if (t === tab) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
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

// ─── Gmail OAuth Status ─────────────────────────────────────────────────────
async function checkGmailStatus() {
  try {
    const res = await fetch('/gmail/oauth/status');
    const data = await res.json();
    const dot = document.getElementById('gmail-dot');
    const text = document.getElementById('gmail-status-text');

    if (data.success && data.data.authorized) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50';
      text.innerText = `Connected: ${data.data.email || 'Gmail'}`;
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      text.innerText = 'Gmail Offline (Click to connect)';
    }
  } catch (err) {
    console.warn('Gmail status check failed:', err);
  }
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────
async function fetchDashboardStats() {
  try {
    const res = await fetch('/gmail/stats');
    const resData = await res.json();
    if (resData.success && resData.data) {
      const d = resData.data;
      document.getElementById('stat-total-sponsors').innerText = d.sponsors?.total ?? 0;
      document.getElementById('stat-pending-approvals').innerText = d.emails?.pendingApproval ?? 0;
      document.getElementById('stat-emails-sent').innerText = d.emails?.totalSent ?? 0;
      document.getElementById('stat-total-outreach').innerText = d.outreach?.totalOutreach ?? 0;
      document.getElementById('stat-followups-due').innerText = d.outreach?.pendingFollowUpsDue ?? 0;
      document.getElementById('stat-meetings').innerText = d.outreach?.conversionsCount ?? 0;

      // Update badge
      const badge = document.getElementById('badge-pending-count');
      if (badge) {
        const count = d.emails?.pendingApproval || 0;
        badge.innerText = count;
        if (count > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ─── Screen 2: Sponsors ─────────────────────────────────────────────────────
async function loadSponsors() {
  const tbody = document.getElementById('sponsors-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Loading sponsors...</td></tr>';

  try {
    // Try rank endpoint first, fallback to all companies
    let res = await fetch('/companies/rank');
    if (!res.ok) res = await fetch('/companies');
    const companies = await res.json();

    if (!Array.isArray(companies) || companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-500">No sponsors found. Click "+ Add Sponsor Company" above!</td></tr>';
      return;
    }

    tbody.innerHTML = companies.map((c, idx) => {
      const tierBadgeColor = {
        Gold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        Silver: 'bg-slate-400/10 text-slate-300 border-slate-500/30',
        Bronze: 'bg-orange-500/10 text-orange-300 border-orange-500/30'
      }[c.recommendedTier] || 'bg-slate-800 text-slate-400 border-slate-700';

      const askIcon = {
        money: '💰 Cash',
        goodies: '🎁 Swag/Goodies',
        infra: '☁️ Cloud/Credits'
      }[c.recommendedAsk] || (c.recommendedAsk || 'General');

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-medium text-white">
            <div class="flex items-center space-x-2">
              <span class="text-slate-500 font-mono text-[10px]">#${idx + 1}</span>
              <span>${c.name}</span>
            </div>
            ${c.website ? `<a href="${c.website}" target="_blank" class="text-[11px] text-slate-500 hover:text-slate-400 underline">${c.website}</a>` : ''}
          </td>
          <td class="py-3 px-4 text-slate-400">${c.category || 'Other'}</td>
          <td class="py-3 px-4 font-mono font-semibold ${c.score >= 70 ? 'text-emerald-400' : 'text-slate-300'}">${c.score || 0}/100</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[11px] font-medium border ${tierBadgeColor}">
              ${c.recommendedTier || 'Bronze'}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-300 font-medium">${askIcon}</td>
          <td class="py-3 px-4 text-slate-400 text-[11px]">
            ${c.contactName ? `${c.contactName}<br>` : ''}
            <span class="text-slate-500">${c.contactEmail || 'No email registered'}</span>
          </td>
          <td class="py-3 px-4 text-right space-x-2">
            <button onclick="triggerDraftGeneration('${c._id}')" class="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded border border-emerald-500/30 transition text-[11px]">
              Generate Email
            </button>
            <button onclick="viewSponsorDeepDive('${c._id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition text-[11px]">
              Inspect &rarr;
            </button>
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

  try {
    const res = await fetch('/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Company '${payload.name}' added successfully!`, 'success');
      closeAddSponsorModal();
      form.reset();
      loadSponsors();
    } else {
      showToast(data.message || 'Failed to add sponsor', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function triggerDraftGeneration(companyId) {
  showToast('Generating personalized AI draft...', 'info');
  try {
    const res = await fetch('/emails/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    const data = await res.json();
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

// ─── Screen 3: Approval Queue ───────────────────────────────────────────────
async function loadPendingEmails() {
  const container = document.getElementById('drafts-list');
  container.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">Loading drafts...</div>';

  try {
    const res = await fetch('/emails');
    const data = await res.json();
    const emails = data.data?.emails || (Array.isArray(data) ? data : []);
    activeEmailsCache = emails;

    document.getElementById('queue-count-badge').innerText = `${emails.length} drafts`;

    if (emails.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500 text-center py-8">No drafts available. Generate one from the Sponsors screen!</div>';
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
            <span>Tier Ask: <strong class="text-slate-400">${em.askType || 'money'}</strong></span>
            <span>v${em.version || 1}</span>
          </div>
        </div>
      `;
    }).join('');

    // Select first email by default
    if (emails.length > 0) {
      selectEmail(emails[0]._id);
    }
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-red-400 text-center py-6">Error: ${err.message}</div>`;
  }
}

async function selectEmail(emailId) {
  currentEmailId = emailId;
  const detailContainer = document.getElementById('email-detail-container');
  const email = activeEmailsCache.find(e => e._id === emailId);
  if (!email) return;

  // Highlight selected
  document.querySelectorAll('[id^="draft-item-"]').forEach(el => el.classList.remove('border-emerald-500/50', 'bg-slate-800'));
  const activeEl = document.getElementById(`draft-item-${emailId}`);
  if (activeEl) activeEl.classList.add('border-emerald-500/50', 'bg-slate-800');

  // Fetch approval history
  let historyLogs = [];
  try {
    const histRes = await fetch(`/emails/${emailId}/approval-history`);
    const histData = await histRes.json();
    if (histData.success) historyLogs = histData.data || [];
  } catch (e) {}

  const isApproved = email.status === 'APPROVED';
  const isPending = email.status === 'PENDING_APPROVAL';

  detailContainer.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-mono uppercase px-2 py-0.5 rounded border ${isApproved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}">
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
  const reviewer = prompt('Reviewer Name (or leave blank for default):', 'Partnerships Director') || 'Partnerships Director';
  try {
    const res = await fetch(`/emails/${emailId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName: reviewer, notes: 'Verified tier, ask, and proof points' })
    });
    const data = await res.json();
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
  const reason = prompt('Reason for rejection (this will be sent to the AI writer loop):', 'Needs to highlight cloud credits instead of cash.');
  if (!reason) return;

  try {
    const res = await fetch(`/emails/${emailId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerName: 'Partnerships Lead', reason })
    });
    const data = await res.json();
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
    const res = await fetch('/emails/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, subject, body, notes: 'Human review adjustments' })
    });
    const data = await res.json();
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
    const res = await fetch('/emails/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, customInstructions: 'Emphasize student builder community' })
    });
    const data = await res.json();
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
  const to = prompt('Recipient email address (e.g. sponsor contact):', 'sponsorships@techcorp.io');
  if (!to) return;

  showToast('Send Guard verifying status === APPROVED...', 'info');

  try {
    const res = await fetch('/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, to, mock: true })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Email dispatched via Gmail! Thread ID: ${data.data.threadId}`, 'success');
      loadPendingEmails();
      fetchDashboardStats();
    } else {
      showToast(`Send Guard Blocked: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Screen 4: Outreach CRM ────────────────────────────────────────────────
async function loadOutreachList(mode = 'all') {
  const tbody = document.getElementById('outreach-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Loading outreach records...</td></tr>';

  try {
    const url = mode === 'due' ? '/outreach/pending-followups' : '/outreach';
    const res = await fetch(url);
    const data = await res.json();
    const list = mode === 'due' ? (data.pendingFollowUps || []) : (Array.isArray(data) ? data : []);

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">No ${mode === 'due' ? 'pending follow-ups due right now' : 'outreach records'}.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((o) => {
      const statusBadge = {
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

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-medium text-white">
            ${o.companyId?.name || 'Sponsor'}
          </td>
          <td class="py-3 px-4 text-slate-400">${o.memberId?.name || 'Alex Patel'}</td>
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
          <td class="py-3 px-4 text-right space-x-2">
            ${!isCapped && !['CLOSED', 'DECLINED'].includes(o.status) ? `
              <button onclick="registerFollowUp('${o._id}')" class="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded border border-blue-500/30 transition text-[11px]">
                Send Follow-up
              </button>
            ` : ''}
            ${o.threadId ? `
              <button onclick="openThread('${o.threadId}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition text-[11px]">
                View Thread
              </button>
            ` : ''}
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
    const res = await fetch(`/outreach/${outreachId}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Follow-up registered from dashboard' })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      loadOutreachList('all');
      fetchDashboardStats();
    } else {
      showToast(data.message || 'Follow-up blocked', 'warning');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Screen 5: Sponsor Details & Thread Viewer ──────────────────────────────
async function viewSponsorDeepDive(companyId) {
  currentCompanyId = companyId;
  switchTab('details');

  try {
    const res = await fetch(`/companies/${companyId}`);
    const data = await res.json();
    const company = data.company || data;

    document.getElementById('detail-company-title').innerText = company.name || 'Company Details';
    document.getElementById('detail-tier-badge').innerText = `Tier: ${company.recommendedTier || 'Bronze'}`;
    document.getElementById('detail-company-sub').innerText = `${company.category || 'Tech'} · Score: ${company.score || 0}/100`;

    document.getElementById('detail-research-text').innerText = company.research || 'No research available yet.';
    document.getElementById('detail-strategy-text').innerText = company.strategy || 'Direct partnership pitch with track branding.';
    document.getElementById('detail-ask-text').innerText = `${company.recommendedAsk || 'money'} (${company.whatToAsk || 'Sponsorship'})`;

    // Scores
    document.getElementById('score-eventFit').innerText = `${company.eventFit || 0}/25`;
    document.getElementById('score-sponsorshipEvidence').innerText = `${company.sponsorshipEvidence || 0}/20`;
    document.getElementById('score-educationCommunityFit').innerText = `${company.educationCommunityFit || 0}/15`;
    document.getElementById('score-productRelevance').innerText = `${company.productRelevance || 0}/15`;
    document.getElementById('score-audienceFit').innerText = `${company.audienceFit || 0}/15`;
    document.getElementById('score-sponsorshipPotential').innerText = `${company.sponsorshipPotential || 0}/10`;

    // Try finding associated outreach thread
    const outRes = await fetch(`/outreach?companyId=${companyId}`);
    const outList = await outRes.json();
    if (Array.isArray(outList) && outList[0] && outList[0].threadId) {
      openThread(outList[0].threadId);
    } else {
      openThread('demo_thread_sponsor');
    }
  } catch (err) {
    showToast(`Failed to load company details: ${err.message}`, 'error');
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
    const res = await fetch(`/gmail/thread/${threadId}?mock=true`);
    const data = await res.json();
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
    const res = await fetch('/gmail/replies/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: currentThreadId,
        label,
        confirmedBy: 'Partnerships Lead',
        notes: `Human confirmed ${label}`
      })
    });
    const data = await res.json();
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
    const res = await fetch('/gmail/demo/simulate-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'CloudScale Compute Systems',
        reviewerName: 'ACM Partnerships Lead',
        simulateReply: 'INTERESTED'
      })
    });
    const data = await res.json();

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
