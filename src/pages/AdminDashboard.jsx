import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import { isSuperAdminUser } from '../lib/roles.js';
import DashboardLayout from '../components/DashboardLayout.jsx';
import MswdOverview from '../components/admin/MswdOverview.jsx';
import EnrolleePopulation from '../components/admin/EnrolleePopulation.jsx';
import DaycareCenterMonitoring from '../components/admin/DaycareCenterMonitoring.jsx';
import ReportsGeneration from '../components/admin/ReportsGeneration.jsx';
import ProgramMonitoring from '../components/admin/ProgramMonitoring.jsx';
import CurriculumGuides from '../components/admin/CurriculumGuides.jsx';
import ManageTeachers from './ManageTeachers.jsx';
import ManageUsers from './ManageUsers.jsx';
import {
  baselineCdcs,
  baselineActivityReports,
} from '../lib/mswdData.js';
import {
  realTeachersList,
  realCdcsList,
  cleanTeacherDisplayName,
  isDummyTeacherAccount,
  purgeDummyTeacherAccountsFromLocalStorage,
  fetchSyncedTeachersList,
} from '../lib/curriculumData.js';
import {
  getStoredLearners,
  getLocalCachedEccdAssessments,
  fetchEccdAssessmentsFromSupabase,
  isPlaceholderStudentName,
} from '../lib/learnersService.js';
import { fetchAdminDashboardSummary } from '../lib/dashboardService.js';
import NotificationBell from '../components/NotificationBell.jsx';
import {
  Button,
  Card,
  Table,
  Badge,
  EmptyState,
  StatCardSkeleton,
  Toast,
} from '../components/ui/index.js';
import {
  cardBox,
  cardBoxTitle,
  table,
  th,
  td,
  pillClass,
  msgOk,
  msgError,
  input,
  btnAdd,
  delBtn,
  ageTag,
} from '../lib/ui.js';
import Icon, {
  IconOverview,
  IconUsers,
  IconTeachers,
  IconLearners,
  IconCategories,
  IconMaterials,
  IconApprovals,
  CATEGORY_ICON_OPTIONS,
  resolveCategoryIconKey,
} from '../components/Icons.jsx';

const TABS = [
  { key: 'overview', label: 'MSWD Overview', icon: <IconOverview className="w-4 h-4" /> },
  { key: 'enrollees', label: 'Enrollee Population', icon: <IconLearners className="w-4 h-4" /> },
  { key: 'centers', label: 'Daycare Centers', icon: <IconTeachers className="w-4 h-4" /> },
  { key: 'reports', label: 'Reports Generation', icon: <IconMaterials className="w-4 h-4" /> },
  { key: 'programs', label: 'Activity Monitoring', icon: <IconOverview className="w-4 h-4" /> },
  { key: 'curriculum', label: 'Curriculum Guides', icon: <IconMaterials className="w-4 h-4" /> },
  { key: 'teachers', label: 'Manage Teachers', icon: <IconTeachers className="w-4 h-4" /> },
  { key: 'categories', label: 'Categories', icon: <IconCategories className="w-4 h-4" /> },
];

export default function AdminDashboard({ profile }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [dbSummary, setDbSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Core MSWD Datasets (Real Data from MSWDO Manolo Fortich)
  const [cdcs, setCdcs] = useState(realCdcsList);
  const [learners, setLearners] = useState(() => {
    return getStoredLearners().filter(
      (l) => !isPlaceholderStudentName(l.full_name) && l.id !== 'lrn-real-001'
    );
  });
  const [teachers, setTeachers] = useState(realTeachersList);
  const [assessments, setAssessments] = useState(getLocalCachedEccdAssessments);
  const [activityReports, setActivityReports] = useState(baselineActivityReports);

  // Users tab
  const [profiles, setProfiles] = useState([]);
  const [usersMsg, setUsersMsg] = useState({ text: '', type: '' });

  // Categories tab
  const [categories, setCategories] = useState([]);
  const [newCatIcon, setNewCatIcon] = useState('book');
  const [newCatName, setNewCatName] = useState('');
  const [catMsg, setCatMsg] = useState({ text: '', type: '' });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catContents, setCatContents] = useState([]);
  const [catContentsMsg, setCatContentsMsg] = useState('');

  // Materials tab
  const [materials, setMaterials] = useState([]);

  // Approvals tab
  const [approvals, setApprovals] = useState([]);

  // --- Load CDCs from Supabase, merging with realCdcsList ---
  const loadCdcs = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('cdcs').select('*').order('barangay, name');
      if (!error && data && data.length > 0) {
        const existingNames = new Set(data.map((c) => (c.name || '').toLowerCase()));
        const filteredBaseline = realCdcsList.filter((b) => !existingNames.has((b.name || '').toLowerCase()));
        setCdcs([...data, ...filteredBaseline]);
      } else {
        setCdcs(realCdcsList);
      }
    } catch {
      setCdcs(realCdcsList);
    }
  }, []);

  // --- Load Real Learners from Supabase & Local Registration Records ---
  const loadLearners = useCallback(async () => {
    try {
      const stored = getStoredLearners().filter(
        (l) => !isPlaceholderStudentName(l.full_name) && l.id !== 'lrn-real-001'
      );
      const { data, error } = await supabase
        .from('learners')
        .select('id, full_name, birthdate, barangay, cdc_id, parent_name, parent_contact, cdcs(name)')
        .order('full_name');

      let combined = [...stored];
      if (!error && data && data.length > 0) {
        const existingIds = new Set(combined.map((l) => l.id));
        const formattedData = data.map((l) => ({
          ...l,
          cdc_name: l.cdcs?.name || `${l.barangay || 'Municipal'} Child Development Center`,
          enrollment_status: l.enrollment_status || 'Enrolled',
          age: 3,
        }));
        formattedData.forEach((l) => {
          if (!existingIds.has(l.id)) {
            combined.push(l);
          }
        });
      }
      combined = combined.filter(
        (l) => !isPlaceholderStudentName(l.full_name) && l.id !== 'lrn-real-001'
      );
      setLearners(combined);
    } catch {
      const stored = getStoredLearners().filter(
        (l) => !isPlaceholderStudentName(l.full_name) && l.id !== 'lrn-real-001'
      );
      setLearners(stored);
    }
  }, []);

  // --- Load Teachers / CDWs merging with realTeachersList and real-time profile edits ---
  const loadTeachers = useCallback(async () => {
    try {
      const synced = await fetchSyncedTeachersList(supabase);
      setTeachers(synced);
    } catch {
      setTeachers(realTeachersList);
    }
  }, []);

  // --- Load Users ---
  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, barangay')
        .order('full_name');

      if (error || !data) {
        setUsersMsg({ text: error?.message || 'Failed to load users', type: 'error' });
        return;
      }
      const cleanData = data.filter((u) => {
        if (isDummyTeacherAccount(u)) {
          if (u.id) {
            supabase.from('profiles').delete().eq('id', u.id).then(() => { }).catch(() => { });
          }
          return false;
        }
        return true;
      });
      setProfiles(cleanData);
    } catch {
      setProfiles([]);
    }
  }, []);

  // --- Load Categories ---
  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('created_at');
      if (!error && data) setCategories(data);
    } catch {
      setCategories([]);
    }
  }, []);

  async function addCategory() {
    const cleanIconKey = resolveCategoryIconKey(newCatIcon, 'book');
    if (!cleanIconKey || !newCatName.trim()) {
      setCatMsg({ text: 'Please select an icon key and enter a category name', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('categories')
      .insert({ icon: cleanIconKey, name: newCatName.trim() });
    if (error) {
      setCatMsg({ text: error.message, type: 'error' });
    } else {
      setCatMsg({ text: 'Category added!', type: 'ok' });
      setNewCatIcon('book');
      setNewCatName('');
      loadCategories();
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) loadCategories();
  }

  async function showCategoryContents(category) {
    setSelectedCategory(category);
    setCatContentsMsg('');
    const { data, error } = await supabase
      .from('materials')
      .select('title, type, age_range')
      .eq('category_id', category.id)
      .order('created_at', { ascending: false });

    if (error) {
      setCatContentsMsg(error.message);
      setCatContents([]);
      return;
    }
    if (!data || data.length === 0) {
      setCatContentsMsg(`No materials yet in "${category.name}". Teachers will upload these.`);
      setCatContents([]);
      return;
    }
    setCatContents(data);
  }

  // --- Load Materials ---
  const loadMaterials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, title, type, age_range, status, categories(name)')
        .order('created_at', { ascending: false });
      if (!error && data) setMaterials(data);
    } catch {
      setMaterials([]);
    }
  }, []);

  async function deleteMaterial(id) {
    if (!confirm('Delete this material?')) return;
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (!error) {
      loadMaterials();
      loadApprovals();
    }
  }

  // --- Load Approvals ---
  const loadApprovals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, title, type, categories(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!error && data) setApprovals(data);
      else setApprovals([]);
    } catch {
      setApprovals([]);
    }
  }, []);

  async function decideApproval(id, action) {
    const { error } = await supabase.from('materials').update({ status: action }).eq('id', id);
    if (!error) {
      loadApprovals();
      loadMaterials();
    }
  }

  // --- Handlers for Child Records (Core Function 1) ---
  async function handleAddLearner(newLearnerData) {
    const tempId = 'lrn-' + Date.now();
    const created = {
      id: tempId,
      ...newLearnerData,
    };

    setLearners((prev) => [created, ...prev]);

    try {
      await supabase.from('learners').insert({
        full_name: newLearnerData.full_name,
        birthdate: newLearnerData.birthdate,
        barangay: newLearnerData.barangay,
        cdc_id: newLearnerData.cdc_id || null,
        parent_name: newLearnerData.parent_name || null,
        parent_contact: newLearnerData.parent_contact || null,
      });
    } catch {
      // optimistic update retained
    }
  }

  async function handleUpdateLearner(id, updates) {
    setLearners((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );

    try {
      await supabase.from('learners').update(updates).eq('id', id);
    } catch {
      // handled
    }
  }

  async function handleDeleteLearner(id) {
    setLearners((prev) => prev.filter((l) => l.id !== id));
    try {
      await supabase.from('learners').delete().eq('id', id);
    } catch {
      // handled
    }
  }

  // --- Handlers for Program Monitoring (Core Function 4) ---
  function handleVerifyReport(id) {
    setActivityReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, mswd_verified: true } : r))
    );
  }

  const loadAssessments = useCallback(async () => {
    try {
      const synced = await fetchEccdAssessmentsFromSupabase({ migrateLocal: true });
      setAssessments(synced);
    } catch {
      setAssessments(getLocalCachedEccdAssessments());
    }
  }, []);

  // Live synchronization: auto-reload when learners register or teachers record assessments or profile updates
  useEffect(() => {
    function handleSync(e) {
      if (
        e.type === 'earlylearn_learners_updated' ||
        (e.type === 'storage' && e.key === 'earlylearn_registered_learners')
      ) {
        loadLearners();
      }
      if (
        e.type === 'earlylearn_assessments_updated' ||
        (e.type === 'storage' && e.key === 'earlylearn_teacher_eccd_assessments')
      ) {
        loadAssessments();
      }
      if (
        e.type === 'earlylearn_teachers_updated' ||
        e.type === 'earlylearn_teacher_profile_saved' ||
        (e.type === 'storage' && e.key === 'earlylearn_teacher_profiles_override')
      ) {
        loadTeachers();
      }
    }
    window.addEventListener('storage', handleSync);
    window.addEventListener('earlylearn_learners_updated', handleSync);
    window.addEventListener('earlylearn_assessments_updated', handleSync);
    window.addEventListener('earlylearn_teachers_updated', handleSync);
    window.addEventListener('earlylearn_teacher_profile_saved', handleSync);

    let channel;
    try {
      channel = supabase
        .channel('mswd-admin-live-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teachers' }, () => {
          loadTeachers();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          loadTeachers();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
          loadTeachers();
        })
        .subscribe();
    } catch {
      // Realtime channel optional fallback
    }

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_learners_updated', handleSync);
      window.removeEventListener('earlylearn_assessments_updated', handleSync);
      window.removeEventListener('earlylearn_teachers_updated', handleSync);
      window.removeEventListener('earlylearn_teacher_profile_saved', handleSync);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadLearners, loadTeachers, loadAssessments]);

  useEffect(() => {
    setSummaryLoading(true);
    fetchAdminDashboardSummary()
      .then((data) => setDbSummary(data))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
    loadCdcs();
    loadLearners();
    loadTeachers();
    loadAssessments();
    loadUsers();
    loadCategories();
    loadMaterials();
    loadApprovals();
  }, [
    loadCdcs,
    loadLearners,
    loadTeachers,
    loadAssessments,
    loadUsers,
    loadCategories,
    loadMaterials,
    loadApprovals,
  ]);

  const pendingVerificationCount = learners.filter(
    (l) => l.enrollment_status === 'Pending Verification'
  ).length;

  const statusPillKind = (s) =>
    ({ approved: 'teacher', pending: 'admin', rejected: 'student' }[s] || 'teacher');

  const isSuperAdmin = isSuperAdminUser(profile);
  const visibleTabs = isSuperAdmin
    ? [
        ...TABS,
        { key: 'users', label: 'Manage Users', icon: <IconUsers className="w-4 h-4" /> },
      ]
    : TABS;

  return (
    <DashboardLayout
      logoSubtitle={isSuperAdmin ? 'Superadmin' : 'MSWD Admin'}
      tabs={visibleTabs}
      title={isSuperAdmin ? 'Municipal Superadmin Governance' : 'MSWD Admin Dashboard'}
      subtitle={
        isSuperAdmin
          ? 'Supreme Municipal System Administration, User Control & ECCD Oversight • Manolo Fortich'
          : 'Municipal Social Welfare and Development Office • Manolo Fortich, Bukidnon'
      }
      avatar={isSuperAdmin ? 'SA' : 'AD'}
      userName={profile?.full_name || (isSuperAdmin ? 'Municipal Superadmin' : 'MSWD Administrator')}
      userEmail={profile?.email || ''}
      roleBadge={isSuperAdmin ? 'Municipal Superadmin' : 'MSWD Administrator'}
      isSuperAdmin={isSuperAdmin}
      notificationSlot={profile?.id ? <NotificationBell userId={profile.id} /> : null}
      stats={[
        {
          label: 'Registered Children (3.11 – 4.11 y/o)',
          value: learners.length,
          sublabel: 'Active portal registrations',
          icon: 'learners',
          tone: 'leaf',
          onClick: () => setActiveTab('enrollees'),
        },
        {
          label: 'Daycare Centers (CDCs)',
          value: cdcs.length,
          sublabel: 'Across 22 barangays',
          icon: 'school',
          tone: 'gold',
          onClick: () => setActiveTab('centers'),
        },
        {
          label: 'Child Dev Workers / Teachers',
          value: teachers.length,
          sublabel: 'Accredited CDTs & Aides',
          icon: 'teachers',
          tone: 'info',
          onClick: () => setActiveTab('teachers'),
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ---------------------------------------------------- */}
      {/* OVERVIEW (EXECUTIVE SUMMARY)                        */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'overview' && (
        summaryLoading && !dbSummary ? (
          <StatCardSkeleton count={4} />
        ) : (
          <MswdOverview
            profile={profile}
            learnersCount={dbSummary?.total_students ?? 0}
            cdcsCount={dbSummary?.total_cdcs ?? 0}
            teachersCount={dbSummary?.total_teachers ?? 0}
            pendingVerificationCount={dbSummary?.pending_materials ?? 0}
            assessmentsCount={dbSummary?.total_assessments ?? 0}
            onNavigateTab={setActiveTab}
          />
        )
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. POPULATION OF ENROLLEES IN EACH BARANGAY          */}
      {/* ---------------------------------------------------- */}
      {(activeTab === 'enrollees' || activeTab === 'children') && (
        <EnrolleePopulation
          learners={learners}
          cdcs={cdcs}
          onAddLearner={handleAddLearner}
          onUpdateLearner={handleUpdateLearner}
          onDeleteLearner={handleDeleteLearner}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. DAYCARE CENTER MONITORING                         */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'centers' && (
        <DaycareCenterMonitoring
          cdcs={cdcs}
          learners={learners}
          teachers={teachers}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. REPORTS GENERATION                                */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'reports' && (
        <ReportsGeneration
          learners={learners}
          cdcs={cdcs}
          teachers={teachers}
          assessments={assessments}
          activityReports={activityReports}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. PROGRAM MONITORING                                */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'programs' && (
        <ProgramMonitoring
          cdcs={cdcs}
          activityReports={activityReports}
          onVerifyReport={handleVerifyReport}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* CURRICULUM GUIDES (PRE-K1 & PRE-K2 + ASSIGNMENTS)   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'curriculum' && (
        <CurriculumGuides
          onNavigateToActivityMonitoring={() => setActiveTab('programs')}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MANAGE TEACHERS (BARANGAY, CDC, CREDENTIALS)         */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'teachers' && <ManageTeachers />}

      {/* ---------------------------------------------------- */}
      {/* MANAGE USERS & CREATE ADMIN (SUPERADMIN)             */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'users' && isSuperAdmin && <ManageUsers currentUser={profile} />}

      {/* ---------------------------------------------------- */}
      {/* CATEGORIES MANAGEMENT                                */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'categories' && (
        <div className="space-y-5">
          <Card
            icon="categories"
            title="Learning Categories"
            subtitle="Manage official learning categories and ASCII icon keys. Select any category card to inspect its uploaded materials."
            accentBar
          >
            {categories.length === 0 ? (
              <EmptyState
                icon="categories"
                title="No categories configured yet"
                description="Add your first learning category below using one of the official EarlyLearn Hub icon keys."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {categories.map((c) => {
                  const iconKey = resolveCategoryIconKey(c.icon, 'book');
                  const isSelected = selectedCategory?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => showCategoryContents(c)}
                      className={`group rounded-2xl p-4 text-center relative cursor-pointer transition-all min-w-0 border ${
                        isSelected
                          ? 'bg-brand-leaf-tint border-brand-leaf-deep shadow-xs'
                          : 'bg-ui-surface-subtle border-ui-border hover:border-brand-leaf/60 hover:bg-ui-surface'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategory(c.id);
                        }}
                        aria-label={`Delete ${c.name}`}
                        title={`Delete ${c.name}`}
                        className="absolute top-2 right-2 cursor-pointer text-ui-ink-muted hover:text-status-error hover:bg-status-error-bg rounded-lg border-none bg-transparent p-1 transition-colors"
                      >
                        <Icon name="close" size={13} />
                      </button>
                      <div className="w-11 h-11 rounded-xl bg-ui-surface border border-ui-border text-brand-leaf-deep flex items-center justify-center mx-auto shadow-2xs group-hover:scale-105 transition-transform">
                        <Icon name={iconKey} size={21} label={c.name} />
                      </div>
                      <div className="text-xs sm:text-[13px] font-extrabold mt-2.5 text-ui-ink truncate">
                        {c.name}
                      </div>
                      <div className="text-[10.5px] font-mono text-ui-ink-muted mt-0.5 truncate">
                        {iconKey}
                      </div>
                      <div className="h-1 w-6 bg-brand-yellow rounded-full mx-auto mt-2" />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-ui-border flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-brand-leaf-tint border border-brand-leaf/30 text-brand-leaf-deep flex items-center justify-center shrink-0">
                  <Icon name={resolveCategoryIconKey(newCatIcon, 'book')} size={18} />
                </span>
                <select
                  aria-label="Category icon key"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className={`${input} w-[195px] cursor-pointer`}
                >
                  {CATEGORY_ICON_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} ({opt.key})
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="New category name (e.g. Science & Nature)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={`${input} flex-1 min-w-[180px]`}
              />
              <Button variant="primary" icon="plus" onClick={addCategory}>
                Add Category
              </Button>
            </div>

            {catMsg.text && (
              <div className="mt-3">
                <Toast
                  floating={false}
                  type={catMsg.type === 'error' ? 'error' : 'success'}
                  message={catMsg.text}
                  onClose={() => setCatMsg({ text: '', type: '' })}
                />
              </div>
            )}
          </Card>

          {selectedCategory && (
            <Card
              icon={resolveCategoryIconKey(selectedCategory.icon, 'book')}
              title={`${selectedCategory.name} — Uploaded Materials`}
              subtitle={`Icon key: ${resolveCategoryIconKey(selectedCategory.icon, 'book')}`}
              action={<Badge variant="primary">{catContents.length} item(s)</Badge>}
            >
              {catContentsMsg ? (
                <EmptyState icon="folder-open" title={selectedCategory.name} description={catContentsMsg} />
              ) : (
                <Table
                  keyField="title"
                  columns={[
                    {
                      key: 'title',
                      label: 'Title',
                      render: (m) => <span className="font-bold text-ui-ink">{m.title}</span>,
                    },
                    {
                      key: 'type',
                      label: 'Type',
                      render: (m) => <Badge variant="neutral">{m.type}</Badge>,
                    },
                    {
                      key: 'age_range',
                      label: 'Age Cohort',
                      render: (m) => <Badge variant="gold">{m.age_range || '3–4 y/o'}</Badge>,
                    },
                  ]}
                  data={catContents}
                />
              )}
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}