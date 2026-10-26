import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import DashboardLayout from '../components/DashboardLayout.jsx';
import MswdOverview from '../components/admin/MswdOverview.jsx';
import EnrolleePopulation from '../components/admin/EnrolleePopulation.jsx';
import DaycareCenterMonitoring from '../components/admin/DaycareCenterMonitoring.jsx';
import ReportsGeneration from '../components/admin/ReportsGeneration.jsx';
import ProgramMonitoring from '../components/admin/ProgramMonitoring.jsx';
import CurriculumGuides from '../components/admin/CurriculumGuides.jsx';
import ManageTeachers from './ManageTeachers.jsx';
import {
  baselineCdcs,
  baselineActivityReports,
} from '../lib/mswdData.js';
import {
  realTeachersList,
  realCdcsList,
} from '../lib/curriculumData.js';
import { getStoredLearners } from '../lib/learnersService.js';
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
import {
  IconOverview,
  IconUsers,
  IconTeachers,
  IconLearners,
  IconCategories,
  IconMaterials,
  IconApprovals,
} from '../components/Icons.jsx';

const TABS = [
  { key: 'overview', label: 'MSWD Overview', icon: <IconOverview className="w-4 h-4" /> },
  { key: 'enrollees', label: '1. Enrollee Population', icon: <IconLearners className="w-4 h-4" /> },
  { key: 'centers', label: '2. Daycare Centers', icon: <IconTeachers className="w-4 h-4" /> },
  { key: 'reports', label: '3. Reports Generation', icon: <IconMaterials className="w-4 h-4" /> },
  { key: 'programs', label: '4. Activity Monitoring', icon: <IconOverview className="w-4 h-4" /> },
  { key: 'curriculum', label: 'Curriculum Guides', icon: <IconMaterials className="w-4 h-4" /> },
  { key: 'teachers', label: 'Manage Teachers', icon: <IconTeachers className="w-4 h-4" /> },
  { key: 'categories', label: 'Categories', icon: <IconCategories className="w-4 h-4" /> },
];

export default function AdminDashboard({ profile }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Core MSWD Datasets (Real Data from MSWDO Manolo Fortich)
  const [cdcs, setCdcs] = useState(realCdcsList);
  const [learners, setLearners] = useState(() => {
    return getStoredLearners().filter(
      (l) => (l.full_name || '').trim().toLowerCase() !== 'hannah mae tion' && l.id !== 'lrn-real-001'
    );
  });
  const [teachers, setTeachers] = useState(realTeachersList);
  const [assessments, setAssessments] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_eccd_assessments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activityReports, setActivityReports] = useState(baselineActivityReports);

  // Users tab
  const [profiles, setProfiles] = useState([]);
  const [usersMsg, setUsersMsg] = useState({ text: '', type: '' });

  // Categories tab
  const [categories, setCategories] = useState([]);
  const [newCatIcon, setNewCatIcon] = useState('');
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
        (l) => (l.full_name || '').trim().toLowerCase() !== 'hannah mae tion' && l.id !== 'lrn-real-001'
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
        (l) => (l.full_name || '').trim().toLowerCase() !== 'hannah mae tion' && l.id !== 'lrn-real-001'
      );
      setLearners(combined);
    } catch {
      const stored = getStoredLearners().filter(
        (l) => (l.full_name || '').trim().toLowerCase() !== 'hannah mae tion' && l.id !== 'lrn-real-001'
      );
      setLearners(stored);
    }
  }, []);

  // --- Load Teachers / CDWs merging with realTeachersList and real-time profile edits ---
  const loadTeachers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('teachers')
        .select('id, full_name, barangay, contact_number, email, cdc_id, cdcs(name)')
        .order('full_name');

      let combined = [];
      if (data && data.length > 0) {
        const existingNames = new Set(data.map((t) => (t.full_name || '').toLowerCase()));
        const nonDuplicateBaseline = realTeachersList.filter(
          (b) => !existingNames.has((b.full_name || '').toLowerCase())
        );
        combined = [...data, ...nonDuplicateBaseline];
      } else {
        combined = [...realTeachersList];
      }

      try {
        const overrides = JSON.parse(localStorage.getItem('earlylearn_teacher_profiles_override') || '{}');
        combined = combined.map((t) => {
          const override =
            overrides[t.id] ||
            (t.email && overrides[t.email.toLowerCase()]) ||
            (t.full_name && overrides[t.full_name.toLowerCase()]);
          if (override) {
            return {
              ...t,
              full_name: override.full_name || t.full_name,
              barangay: override.barangay || t.barangay,
              cdc_name: override.cdc_name || t.cdc_name,
              cdc_id: override.cdc_id || t.cdc_id,
              cdcs: override.cdc_name ? { name: override.cdc_name, barangay: override.barangay } : t.cdcs,
              contact_number: override.contact_number || t.contact_number,
              email: override.email || t.email,
            };
          }
          return t;
        });

        Object.values(overrides).forEach((ov) => {
          if (ov && ov.id && !combined.some((t) => t.id === ov.id || (ov.email && t.email === ov.email))) {
            combined.unshift({
              id: ov.id,
              full_name: ov.full_name,
              barangay: ov.barangay,
              cdc_name: ov.cdc_name,
              cdc_id: ov.cdc_id,
              cdcs: { name: ov.cdc_name, barangay: ov.barangay },
              contact_number: ov.contact_number,
              email: ov.email,
            });
          }
        });
      } catch {
        // ignore
      }

      setTeachers(combined);
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
        setUsersMsg({ text: '❌ ' + (error?.message || 'Failed to load users'), type: 'error' });
        return;
      }
      setProfiles(data);
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
    if (!newCatIcon.trim() || !newCatName.trim()) {
      setCatMsg({ text: '⚠️ Please enter both an icon and a name', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('categories')
      .insert({ icon: newCatIcon.trim(), name: newCatName.trim() });
    if (error) {
      setCatMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setCatMsg({ text: '✅ Added!', type: 'ok' });
      setNewCatIcon('');
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
      setCatContentsMsg('❌ ' + error.message);
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
        try {
          const saved = localStorage.getItem('earlylearn_teacher_eccd_assessments');
          if (saved) setAssessments(JSON.parse(saved));
        } catch {
          // ignore
        }
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
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_learners_updated', handleSync);
      window.removeEventListener('earlylearn_assessments_updated', handleSync);
      window.removeEventListener('earlylearn_teachers_updated', handleSync);
      window.removeEventListener('earlylearn_teacher_profile_saved', handleSync);
    };
  }, [loadLearners, loadTeachers]);

  useEffect(() => {
    loadCdcs();
    loadLearners();
    loadTeachers();
    loadUsers();
    loadCategories();
    loadMaterials();
    loadApprovals();
  }, [
    loadCdcs,
    loadLearners,
    loadTeachers,
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

  const isSuperAdmin = profile?.role === 'superadmin' || profile?.isSuperAdmin;

  return (
    <DashboardLayout
      logoSubtitle={isSuperAdmin ? 'Superadmin' : 'MSWD Admin'}
      tabs={TABS}
      title={isSuperAdmin ? 'Municipal Superadmin Governance' : 'MSWD Admin Dashboard'}
      subtitle={
        isSuperAdmin
          ? 'Supreme Municipal System Administration, User Control & ECCD Oversight • Manolo Fortich'
          : 'Municipal Social Welfare and Development Office • Manolo Fortich, Bukidnon'
      }
      avatar={profile?.full_name ? profile.full_name.slice(0, 2).toUpperCase() : (isSuperAdmin ? 'SA' : 'AD')}
      roleBadge={isSuperAdmin ? 'Municipal Superadmin' : 'MSWD Administrator'}
      isSuperAdmin={isSuperAdmin}
      stats={[
        { label: 'Registered Children (3.11 – 4.11 y/o)', value: learners.length },
        { label: 'Daycare Centers (CDCs)', value: cdcs.length },
        { label: 'Child Dev Workers / Teachers', value: teachers.length },
        { label: 'ECCD Attendance Avg', value: '92.8%' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ---------------------------------------------------- */}
      {/* OVERVIEW (EXECUTIVE SUMMARY)                        */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'overview' && (
        <MswdOverview
          profile={profile}
          learnersCount={learners.length}
          cdcsCount={cdcs.length}
          teachersCount={teachers.length}
          pendingVerificationCount={pendingVerificationCount}
          assessmentsCount={assessments.length}
          onNavigateTab={setActiveTab}
        />
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
      {/* CATEGORIES MANAGEMENT                                */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'categories' && (
        <>
          <div className={cardBox}>
            <h3 className={cardBoxTitle}>Learning Categories</h3>
            <p className="text-[13px] text-[#8a7f66] -mt-2.5 mb-4">
              Select a category to inspect its learning materials.
            </p>
            <div className="flex gap-3 flex-wrap">
              {categories.map((c) => (
                <div
                  key={c.id}
                  onClick={() => showCategoryContents(c)}
                  className="bg-[#FFFDF8] border border-card-border rounded-2xl px-3.5 pt-4.5 pb-3.5 text-center w-[108px] relative cursor-pointer"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCategory(c.id);
                    }}
                    className="absolute top-1.5 right-2 cursor-pointer text-[#ccc] text-xs border-none bg-transparent hover:text-danger"
                  >
                    ✕
                  </button>
                  <div className="text-[34px]">{c.icon}</div>
                  <div className="text-[13px] font-bold mt-2 text-[#4A4030]">{c.name}</div>
                  <div className="h-[3px] w-5 bg-gold rounded mx-auto mt-1.5" />
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 mt-4 flex-wrap">
              <input
                type="text"
                placeholder="Icon (e.g. 🚗)"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className={`${input} w-[110px]`}
              />
              <input
                type="text"
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={`${input} flex-1 min-w-[160px]`}
              />
              <button onClick={addCategory} className={btnAdd}>
                + Add Category
              </button>
            </div>
            {catMsg.text && (
              <p className={catMsg.type === 'error' ? msgError : msgOk}>{catMsg.text}</p>
            )}
          </div>

          {selectedCategory && (
            <div className={cardBox}>
              <h3 className={cardBoxTitle}>
                {selectedCategory.icon} {selectedCategory.name} — Uploaded Materials
              </h3>
              {catContentsMsg ? (
                <p className="text-[13px] text-dash-ink-soft">{catContentsMsg}</p>
              ) : (
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>Title</th>
                      <th className={th}>Type</th>
                      <th className={th}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catContents.map((m, idx) => (
                      <tr key={idx}>
                        <td className={td}>{m.title}</td>
                        <td className={td}>{m.type}</td>
                        <td className={td}>
                          <span className={ageTag}>{m.age_range || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}