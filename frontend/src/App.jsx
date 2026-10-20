import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import BackendBanner from './components/BackendBanner.jsx';
import Toast from './components/Toast.jsx';
import DashboardTab from './components/DashboardTab.jsx';
import SponsorsTab from './components/SponsorsTab.jsx';
import ApprovalTab from './components/ApprovalTab.jsx';
import OutreachTab from './components/OutreachTab.jsx';
import DetailsTab from './components/DetailsTab.jsx';

// Modals
import AddSponsorModal from './components/modals/AddSponsorModal.jsx';
import AssignOutreachModal from './components/modals/AssignOutreachModal.jsx';
import AddMemberModal from './components/modals/AddMemberModal.jsx';
import GmailModal from './components/modals/GmailModal.jsx';
import OutreachTimelineModal from './components/modals/OutreachTimelineModal.jsx';
import SimulateReplyModal from './components/modals/SimulateReplyModal.jsx';
import DemoSimulationModal from './components/modals/DemoSimulationModal.jsx';

import { api } from './services/api.js';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [backendErrorMsg, setBackendErrorMsg] = useState('');

  // Sponsors
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  // Toast
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  // Modals state
  const [addSponsorOpen, setAddSponsorOpen] = useState(false);
  const [assignOutreachOpen, setAssignOutreachOpen] = useState(false);
  const [assignPreselectedCompanyId, setAssignPreselectedCompanyId] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);

  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineOutreachId, setTimelineOutreachId] = useState(null);
  const [timelineCompanyName, setTimelineCompanyName] = useState('Sponsor');

  const [simulateReplyOpen, setSimulateReplyOpen] = useState(false);
  const [simulateTarget, setSimulateTarget] = useState({ outreachId: '', threadId: '', companyName: '' });

  const [demoSimulationOpen, setDemoSimulationOpen] = useState(false);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
      setBackendOffline(false);
    } catch (err) {
      setBackendOffline(true);
      setBackendErrorMsg(err.message);
    }
  }, []);

  // Fetch Gmail Status
  const fetchGmailStatus = useCallback(async () => {
    try {
      const gStatus = await api.getGmailStatus();
      setGmailStatus(gStatus);
    } catch {
      setGmailStatus({ authorized: false });
    }
  }, []);

  // Fetch Sponsors list
  const fetchSponsors = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const list = await api.getSponsors();
      setCompanies(list);
    } catch (err) {
      showToast(`Failed to load sponsors: ${err.message}`, 'error');
    } finally {
      setCompaniesLoading(false);
    }
  }, [showToast]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchGmailStatus();
    fetchSponsors();
  }, [fetchStats, fetchGmailStatus, fetchSponsors]);

  // Sponsor Actions
  const handleResearchCompany = async (companyId) => {
    showToast('Running AI Research & 6-factor scoring engine...', 'info');
    try {
      const { res, data } = await api.researchCompany(companyId);
      if (res.ok) {
        showToast(`AI Research completed! Score: ${data.score || 0}/100`, 'success');
        fetchSponsors();
        fetchStats();
      } else {
        showToast(data.message || 'Research failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGenerateDraft = async (companyId) => {
    showToast('Generating personalized AI email proposal...', 'info');
    try {
      const { res, data } = await api.generateDraft(companyId);
      if (res.ok) {
        if (data?.usedFallback) {
          showToast('AI generation failed, so a generic fallback template was used. Check GEMINI_API_KEY / model settings, then regenerate.', 'warning');
        } else {
          showToast('Email proposal draft created! Send Guard requires human review.', 'success');
        }
        setCurrentTab('approval');
        fetchStats();
      } else {
        showToast(data.message || 'Draft generation failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAssignOutreachFromSponsor = (companyId) => {
    setAssignPreselectedCompanyId(companyId);
    setAssignOutreachOpen(true);
  };

  const handleInspectCompany = (companyId) => {
    setSelectedCompanyId(companyId);
    setCurrentTab('details');
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this sponsor company?')) return;
    try {
      const { res, data } = await api.deleteCompany(companyId);
      if (res.ok) {
        showToast('Company removed successfully.', 'info');
        fetchSponsors();
        fetchStats();
      } else {
        showToast(data.message || 'Delete failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Outreach Handlers
  const handleOpenTimeline = (outreachId, companyName) => {
    setTimelineOutreachId(outreachId);
    setTimelineCompanyName(companyName || 'Sponsor');
    setTimelineModalOpen(true);
  };

  const handleOpenSimulateReply = (outreachId, threadId, companyName) => {
    setSimulateTarget({
      outreachId,
      threadId: threadId || `demo_thread_${Date.now()}`,
      companyName: companyName || 'Sponsor Company'
    });
    setSimulateReplyOpen(true);
  };

  const pendingApprovalsCount = stats?.emails?.pendingApproval ?? 0;

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />

      {/* Header & Navigation */}
      <Navbar
        currentTab={currentTab}
        onSwitchTab={setCurrentTab}
        pendingApprovalsCount={pendingApprovalsCount}
        gmailStatus={gmailStatus}
        onOpenGmailModal={() => setGmailModalOpen(true)}
        onOpenDemoModal={() => setDemoSimulationOpen(true)}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Backend Connection Alert */}
        <BackendBanner
          visible={backendOffline}
          errorMessage={backendErrorMsg}
          onRetry={() => {
            fetchStats();
            fetchGmailStatus();
            fetchSponsors();
          }}
        />

        {/* Tab 1: Dashboard */}
        {currentTab === 'dashboard' && (
          <DashboardTab
            stats={stats}
            onRefresh={() => {
              fetchStats();
              fetchGmailStatus();
            }}
            onSwitchTab={setCurrentTab}
            onOpenGmailModal={() => setGmailModalOpen(true)}
            onOpenAddSponsorModal={() => setAddSponsorOpen(true)}
          />
        )}

        {/* Tab 2: Sponsors Leaderboard */}
        {currentTab === 'sponsors' && (
          <SponsorsTab
            companies={companies}
            loading={companiesLoading}
            onOpenAddModal={() => setAddSponsorOpen(true)}
            onResearch={handleResearchCompany}
            onGenerateDraft={handleGenerateDraft}
            onAssign={handleAssignOutreachFromSponsor}
            onInspect={handleInspectCompany}
            onDelete={handleDeleteCompany}
          />
        )}

        {/* Tab 3: Approval Queue */}
        {currentTab === 'approval' && (
          <ApprovalTab
            onShowToast={showToast}
            onRefreshStats={fetchStats}
            onSwitchTab={(tab) => setCurrentTab(tab)}
            companies={companies}
          />
        )}

        {/* Tab 4: Outreach CRM */}
        {currentTab === 'outreach' && (
          <OutreachTab
            onOpenAssignModal={(compId) => {
              setAssignPreselectedCompanyId(compId || null);
              setAssignOutreachOpen(true);
            }}
            onOpenTimeline={handleOpenTimeline}
            onOpenSimulateReply={handleOpenSimulateReply}
            onShowToast={showToast}
            onRefreshStats={fetchStats}
          />
        )}

        {/* Tab 5: Thread & Details */}
        {currentTab === 'details' && (
          <DetailsTab
            selectedCompanyId={selectedCompanyId}
            onShowToast={showToast}
            onRefreshStats={() => {
              fetchStats();
              fetchSponsors();
            }}
          />
        )}
      </main>

      {/* Modals */}
      <AddSponsorModal
        isOpen={addSponsorOpen}
        onClose={() => setAddSponsorOpen(false)}
        onSuccess={() => {
          fetchSponsors();
          fetchStats();
        }}
        onShowToast={showToast}
      />

      <AssignOutreachModal
        isOpen={assignOutreachOpen}
        preselectedCompanyId={assignPreselectedCompanyId}
        onClose={() => {
          setAssignOutreachOpen(false);
          setAssignPreselectedCompanyId(null);
        }}
        onSuccess={() => {
          fetchStats();
          setCurrentTab('outreach');
        }}
        onOpenAddMember={() => setAddMemberOpen(true)}
        onShowToast={showToast}
      />

      <AddMemberModal
        isOpen={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onSuccess={() => {
          setAssignOutreachOpen(true);
        }}
        onShowToast={showToast}
      />

      <GmailModal
        isOpen={gmailModalOpen}
        gmailStatus={gmailStatus}
        onClose={() => setGmailModalOpen(false)}
        onRefreshStatus={async () => {
          await fetchGmailStatus();
          await fetchStats();
        }}
        onShowToast={showToast}
      />

      <OutreachTimelineModal
        isOpen={timelineModalOpen}
        outreachId={timelineOutreachId}
        companyName={timelineCompanyName}
        onClose={() => {
          setTimelineModalOpen(false);
          setTimelineOutreachId(null);
        }}
      />

      <SimulateReplyModal
        isOpen={simulateReplyOpen}
        target={simulateTarget}
        onClose={() => setSimulateReplyOpen(false)}
        onSuccess={() => {
          fetchStats();
          if (currentTab === 'details' && simulateTarget.threadId) {
            // refresh details
          }
        }}
        onShowToast={showToast}
      />

      <DemoSimulationModal
        isOpen={demoSimulationOpen}
        onClose={() => setDemoSimulationOpen(false)}
        onSuccess={() => {
          fetchStats();
          fetchSponsors();
        }}
        onShowToast={showToast}
      />
    </div>
  );
}
