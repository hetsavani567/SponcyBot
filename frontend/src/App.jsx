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
import AuthModal from './components/modals/AuthModal.jsx';
import DraftRequirementModal from './components/modals/DraftRequirementModal.jsx';
import TutorialModal from './components/modals/TutorialModal.jsx';

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
  const [selectedThreadId, setSelectedThreadId] = useState(null);

  // Live AI Drafting status for instant Approval Queue rendering
  const [draftingTarget, setDraftingTarget] = useState(null); // { companyId, companyName }
  const [newlyCreatedEmail, setNewlyCreatedEmail] = useState(null);
  const [preselectedEmailId, setPreselectedEmailId] = useState(null);

  // Toast
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  // Modals state
  const [addSponsorOpen, setAddSponsorOpen] = useState(false);
  const [assignOutreachOpen, setAssignOutreachOpen] = useState(false);
  const [assignPreselectedCompanyId, setAssignPreselectedCompanyId] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [outreachRefreshTrigger, setOutreachRefreshTrigger] = useState(0);

  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineOutreachId, setTimelineOutreachId] = useState(null);
  const [timelineCompanyName, setTimelineCompanyName] = useState('Sponsor');

  const [simulateReplyOpen, setSimulateReplyOpen] = useState(false);
  const [simulateTarget, setSimulateTarget] = useState({ outreachId: '', threadId: '', companyName: '' });

  const [demoSimulationOpen, setDemoSimulationOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [draftRequirementOpen, setDraftRequirementOpen] = useState(false);
  const [draftRequirementCompany, setDraftRequirementCompany] = useState(null);
  const [user, setUser] = useState(() => api.getCurrentUser());
  const [activeRole, setActiveRoleState] = useState(() => api.getActiveRole());
  const [researchingCompanyId, setResearchingCompanyId] = useState(null);

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

  // Initial load: unified single round-trip bootstrap for 70%+ faster page load
  useEffect(() => {
    let isMounted = true;
    setCompaniesLoading(true);

    api.bootstrap()
      .then(bootData => {
        if (!isMounted) return;
        if (bootData.stats) {
          setStats(bootData.stats);
          setBackendOffline(false);
        }
        if (bootData.gmailStatus) {
          setGmailStatus(bootData.gmailStatus);
        }
        if (bootData.sponsors && Array.isArray(bootData.sponsors)) {
          setCompanies(bootData.sponsors);
        }
        if (bootData.user) {
          setUser(bootData.user);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setBackendOffline(true);
        setBackendErrorMsg(err.message);
      })
      .finally(() => {
        if (isMounted) setCompaniesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Launch tutorial on first sign in if user has not completed it yet
  useEffect(() => {
    if (user && typeof localStorage !== 'undefined') {
      const completed = localStorage.getItem('SPONCY_TUTORIAL_COMPLETED');
      if (!completed) {
        const timer = setTimeout(() => {
          setTutorialOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handleSignOut = () => {
    api.signout();
    setUser(null);
    setActiveRoleState('Organizer');
    showToast('Signed out successfully.', 'info');
  };

  const handleSwitchRole = (newRole) => {
    api.setActiveRole(newRole);
    setActiveRoleState(newRole);
    if (user) {
      setUser(prev => (prev ? { ...prev, role: newRole } : { role: newRole, name: newRole }));
    }
    showToast(`Active role switched to: ${newRole}`, 'info');
  };

  // Sponsor Actions
  const handleResearchCompany = async (companyId) => {
    setResearchingCompanyId(companyId);
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
    } finally {
      setResearchingCompanyId(null);
    }
  };

  const handleOpenDraftModal = (companyId) => {
    const comp = companies.find(c => (c._id || c.id) === companyId);
    if (!comp) return;
    setDraftRequirementCompany(comp);
    setDraftRequirementOpen(true);
  };

  const handleConfirmGenerateDraft = async (companyId, requirements = {}) => {
    const comp = companies.find(c => (c._id || c.id) === companyId) || draftRequirementCompany;
    const compName = comp?.name || comp?.company || 'Sponsor';

    setDraftRequirementOpen(false);

    // Instantly transition to Approval queue with zero lag (0ms response)
    setCurrentTab('approval');
    setDraftingTarget({ companyId, companyName: compName });
    showToast(`⚡ Drafting unique AI proposal for ${compName} based on requirements...`, 'info');

    try {
      const { res, data } = await api.generateDraft(companyId, requirements);
      if (res.ok) {
        const createdEmail = data?.data?.email || data?.email;
        if (createdEmail) {
          if (!createdEmail.companyId || typeof createdEmail.companyId === 'string') {
            createdEmail.companyId = comp || { _id: companyId, name: compName };
          }
          setNewlyCreatedEmail(createdEmail);
          setPreselectedEmailId(createdEmail._id);
        }
        if (data?.usedFallback) {
          showToast('Draft created using resilient requirements engine. Review and approve in queue.', 'info');
        } else {
          showToast(`✨ Unique AI proposal draft for ${compName} created! Send Guard requires human review.`, 'success');
        }
        fetchStats();
      } else {
        showToast(data?.message || 'Draft generation failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDraftingTarget(null);
    }
  };

  const handleAssignOutreachFromSponsor = (companyId) => {
    setAssignPreselectedCompanyId(companyId);
    setAssignOutreachOpen(true);
  };

  const handleInspectCompany = (companyId) => {
    const id = typeof companyId === 'object' ? (companyId._id || companyId.id) : companyId;
    setSelectedCompanyId(id);
    setSelectedThreadId(null);
    setCurrentTab('details');
  };

  const handleViewThread = (companyId, threadId) => {
    if (companyId) setSelectedCompanyId(companyId);
    if (threadId) setSelectedThreadId(threadId);
    setCurrentTab('details');
  };

  const handleDeleteCompany = async (companyId, companyName = 'Sponsor') => {
    const currentRole = api.getActiveRole();
    if (!api.isOrganizer(currentRole)) {
      showToast('Permission Denied: Only Organizers can remove sponsor companies.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${companyName}? Only Organizers have permission.`)) return;
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

  const handleDemoSuccess = useCallback(() => {
    fetchStats();
    fetchSponsors();
    showToast('⚡ 12-Step Lifecycle Simulation completed successfully!', 'success');
  }, [fetchStats, fetchSponsors, showToast]);

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

      {/* Floating Action Cluster (Bottom-Left Corner): Guide above Run Demo */}
      <aside aria-label="Quick Actions" className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-2.5">
        {/* Guide Trigger Button (Directly ABOVE Run Demo) */}
        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          title="Open Interactive Walkthrough & SponcyBot Guide"
          aria-label="Open Interactive Guide"
          className="group relative flex items-center space-x-2 px-3.5 py-2 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-100 hover:text-white border border-slate-700/80 hover:border-emerald-400/80 shadow-xl shadow-black/40 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
          </span>
          <span className="text-xs font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
            Guide
          </span>
          <span className="hidden sm:inline-block text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            Tour
          </span>
        </button>

        {/* Run Demo Simulation Trigger */}
        <button
          type="button"
          onClick={() => setDemoSimulationOpen(true)}
          title="Run 12-Step Autonomous Sponsor Outreach Simulation"
          aria-label="Run Demo Simulation"
          className="group relative flex items-center space-x-2.5 px-3.5 py-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-100 hover:text-white border border-emerald-500/40 hover:border-emerald-400 shadow-xl shadow-emerald-500/20 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        >
          {/* Glowing pulse lightning icon */}
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md">
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            ⚡
          </span>

          {/* Label */}
          <div className="flex items-center space-x-1.5 text-left">
            <span className="text-xs font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
              Run Demo
            </span>
            <span className="hidden sm:inline-block text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              12 Steps
            </span>
          </div>
        </button>
      </aside>

      {/* Header & Navigation */}
      <Navbar
        currentTab={currentTab}
        onSwitchTab={setCurrentTab}
        pendingApprovalsCount={pendingApprovalsCount}
        gmailStatus={gmailStatus}
        user={user}
        activeRole={activeRole}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenTutorial={() => setTutorialOpen(true)}
        onSignOut={handleSignOut}
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
            onOpenDemoModal={() => setDemoSimulationOpen(true)}
          />
        )}

        {/* Tab 2: Sponsors Leaderboard */}
        {currentTab === 'sponsors' && (
          <SponsorsTab
            companies={companies}
            loading={companiesLoading}
            researchingCompanyId={researchingCompanyId}
            draftingCompanyId={draftingTarget?.companyId}
            onOpenAddModal={() => setAddSponsorOpen(true)}
            onResearch={handleResearchCompany}
            onGenerateDraft={handleOpenDraftModal}
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
            draftingTarget={draftingTarget}
            newlyCreatedEmail={newlyCreatedEmail}
            preselectedEmailId={preselectedEmailId}
            onDraftHandled={() => setNewlyCreatedEmail(null)}
            onOpenDraftRequirement={handleOpenDraftModal}
          />
        )}

        {/* Tab 4: Outreach CRM */}
        {currentTab === 'outreach' && (
          <OutreachTab
            refreshTrigger={outreachRefreshTrigger}
            onOpenAssignModal={(compId) => {
              setAssignPreselectedCompanyId(compId || null);
              setAssignOutreachOpen(true);
            }}
            onOpenTimeline={handleOpenTimeline}
            onOpenSimulateReply={handleOpenSimulateReply}
            onViewThread={handleViewThread}
            onShowToast={showToast}
            onRefreshStats={fetchStats}
          />
        )}

        {/* Tab 5: Thread & Details */}
        {currentTab === 'details' && (
          <DetailsTab
            selectedCompanyId={selectedCompanyId}
            selectedThreadId={selectedThreadId}
            companies={companies}
            onShowToast={showToast}
            onRefreshStats={() => {
              fetchStats();
              fetchSponsors();
            }}
            onSwitchTab={setCurrentTab}
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
          setOutreachRefreshTrigger(prev => prev + 1);
          if (currentTab === 'details' && simulateTarget.threadId) {
            // refresh details
          }
        }}
        onShowToast={showToast}
      />

      <DemoSimulationModal
        isOpen={demoSimulationOpen}
        onClose={() => setDemoSimulationOpen(false)}
        onSuccess={handleDemoSuccess}
        onShowToast={showToast}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          if (authenticatedUser?.role) {
            setActiveRoleState(authenticatedUser.role);
          }
          if (typeof localStorage !== 'undefined' && !localStorage.getItem('SPONCY_TUTORIAL_COMPLETED')) {
            setTutorialOpen(true);
          }
        }}
        onShowToast={showToast}
      />

      {/* Sponsor Requirement Modal for Unique AI Draft Generation */}
      <DraftRequirementModal
        isOpen={draftRequirementOpen}
        company={draftRequirementCompany}
        onClose={() => {
          setDraftRequirementOpen(false);
          setDraftRequirementCompany(null);
        }}
        onSubmit={handleConfirmGenerateDraft}
        loading={draftingTarget?.companyId === (draftRequirementCompany?._id || draftRequirementCompany?.id)}
      />

      {/* Mini Tutorial & Complete Workflow Walkthrough */}
      <TutorialModal
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onFinish={() => {
          setTutorialOpen(false);
          showToast('Welcome to SponcyBot! You are now ready to begin outreach.', 'success');
        }}
      />
    </div>
  );
}
