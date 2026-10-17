import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import DashboardLayout from '../components/DashboardLayout.jsx';
import {
  preK1Curriculum,
  preK2Curriculum,
  initialCurriculumAssignments,
  initialTeacherModules,
  realTeachersList,
} from '../lib/curriculumData.js';
import { getLearnersForTeacher, getCdcForBarangay } from '../lib/learnersService.js';
import {
  IconPlus,
  IconSearch,
  IconMaterials,
  IconCheck,
  IconClose,
} from '../components/Icons.jsx';
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
  label,
  btnPrimary,
  btnSmall,
  btnAdd,
  delBtn,
  ageTag,
} from '../lib/ui.js';

const TABS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'curriculum', label: 'Curriculum Guide', icon: '📖' },
  { key: 'mylearners', label: 'My Learners', icon: '🧒' },
  { key: 'upload', label: 'Uploaded Materials', icon: '📁' },
  { key: 'announcements', label: 'Announcements', icon: '📢' },
  { key: 'submissions', label: 'Check Submissions', icon: '📝' },
  { key: 'progress', label: 'Student Progress', icon: '📈' },
  { key: 'profile', label: 'My Profile', icon: '🙍' },
];

export default function TeacherDashboard({ profile }) {
  const currentUserId = profile.id;
  const [activeTab, setActiveTab] = useState('overview');

  // Curriculum Guide Tab state
  const [curriculumLevel, setCurriculumLevel] = useState('PRE-K1');
  const [curriculumQuarter, setCurriculumQuarter] = useState('all');
  const [curriculumSearch, setCurriculumSearch] = useState('');

  // Uploaded Materials & Modules state
  const [localTeacherModules, setLocalTeacherModules] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      return saved ? JSON.parse(saved) : initialTeacherModules;
    } catch {
      return initialTeacherModules;
    }
  });

  const [categoryOptions, setCategoryOptions] = useState([]);
  const [matCategory, setMatCategory] = useState('');
  const [myMaterials, setMyMaterials] = useState([]);
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCurriculumLevel, setUploadCurriculumLevel] = useState('PRE-K1');
  const [uploadQuarter, setUploadQuarter] = useState(1);
  const [uploadWeek, setUploadWeek] = useState('Week 1');
  const [uploadTheme, setUploadTheme] = useState('TELL ME ABOUT YOURSELF');
  const [uploadSubTheme, setUploadSubTheme] = useState('I HAVE A NAME');
  const [uploadType, setUploadType] = useState('activity');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');

  // Uploaded Materials tab filters
  const [uploadedFilterLevel, setUploadedFilterLevel] = useState('all');
  const [uploadedFilterQuarter, setUploadedFilterQuarter] = useState('all');
  const [uploadedFilterType, setUploadedFilterType] = useState('all');
  const [uploadedSearch, setUploadedSearch] = useState('');

  // Announcements tab
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annStatusMsg, setAnnStatusMsg] = useState({ text: '', type: '' });
  const [announcements, setAnnouncements] = useState([]);

  // Submissions tab
  const [submissions, setSubmissions] = useState([]);

  // Progress tab
  const [progressRows, setProgressRows] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);

  // Profile tab
  const [myBarangay, setMyBarangay] = useState('');
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  // My Learners tab — auto-filtered by this teacher's assigned CDC
  const [myCdcName, setMyCdcName] = useState(null);
  const [myLearners, setMyLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(true);

  // --- Load categories into the dropdown ---
  const loadCategoryOptions = useCallback(async () => {
    const { data } = await supabase.from('categories').select('id, name, icon').order('name');
    setCategoryOptions(data || []);
    if (data && data.length && !matCategory) setMatCategory(data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Load my uploaded materials ---
  const loadMyMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, title, type, age_range, status, categories(name)')
      .eq('created_by', currentUserId)
      .order('created_at', { ascending: false });
    if (!error && data) setMyMaterials(data);
  }, [currentUserId]);

  // Flatten curriculum weeks for Curriculum Guide tab
  const flatCurriculumWeeks = useMemo(() => {
    const curr = curriculumLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;
    const list = [];
    curr.forEach((q) => {
      if (curriculumQuarter !== 'all' && q.quarterNumber !== parseInt(curriculumQuarter, 10)) {
        return;
      }
      q.weeks.forEach((w) => {
        const matchSearch =
          !curriculumSearch.trim() ||
          q.suggestedContent.toLowerCase().includes(curriculumSearch.toLowerCase()) ||
          q.theme.toLowerCase().includes(curriculumSearch.toLowerCase()) ||
          w.week.toLowerCase().includes(curriculumSearch.toLowerCase()) ||
          w.subTheme.toLowerCase().includes(curriculumSearch.toLowerCase()) ||
          (w.suggestedActivities || '').toLowerCase().includes(curriculumSearch.toLowerCase());

        if (matchSearch) {
          list.push({
            level: curriculumLevel,
            quarterNumber: q.quarterNumber,
            quarter: q.quarter,
            month: q.month,
            theme: q.theme,
            suggestedContent: q.suggestedContent,
            week: w.week,
            subTheme: w.subTheme,
            suggestedActivities: w.suggestedActivities,
          });
        }
      });
    });
    return list;
  }, [curriculumLevel, curriculumQuarter, curriculumSearch]);

  // Combined uploaded materials list
  const combinedUploadedMaterials = useMemo(() => {
    const teacherMods = (localTeacherModules || []).map((m) => ({
      id: m.id,
      title: m.title,
      level: m.level || 'Pre-K1',
      quarter: m.quarter || 1,
      week: m.week || 'Week 1',
      theme: m.theme || '',
      sub_theme: m.sub_theme || '',
      type: m.module_type?.toLowerCase().includes('video') ? 'video' : m.module_type?.toLowerCase().includes('worksheet') ? 'activity' : 'activity',
      formatLabel: m.module_type || 'Activity Worksheet',
      age_range: m.level === 'Pre-K1' ? '3.11' : '4.11',
      status: m.status || 'Approved',
      created_at: m.upload_date,
      content_text: m.description,
      isLocal: true,
    }));

    const sbMats = (myMaterials || []).map((m) => {
      const tagMatch = m.title?.match(/\[(Pre-K1|Pre-K2)?\s*Q?(\d+)?\s*(W[^\s\]]+|Week\s*[\d&]+)?\]/i);
      const parsedLevel = tagMatch?.[1] || (m.age_range?.includes('3') ? 'Pre-K1' : 'Pre-K2');
      const parsedQuarter = tagMatch?.[2] ? parseInt(tagMatch[2], 10) : 1;
      const parsedWeek = tagMatch?.[3] ? (tagMatch[3].startsWith('W') && !tagMatch[3].startsWith('Week') ? `Week ${tagMatch[3].slice(1)}` : tagMatch[3]) : 'Week 1';

      return {
        id: m.id,
        title: m.title,
        level: parsedLevel,
        quarter: parsedQuarter,
        week: parsedWeek,
        theme: m.categories?.name || 'Curriculum Lesson',
        sub_theme: '',
        type: m.type,
        formatLabel: m.type === 'activity' ? 'Activity Worksheet' : m.type === 'video' ? 'Video Lesson' : m.type === 'image' ? 'Visual Worksheet' : 'Reading Story',
        age_range: m.age_range,
        status: m.status || 'Approved',
        created_at: 'Recently',
        content_text: m.content_text,
        isLocal: false,
      };
    });

    const seenIds = new Set();
    const result = [];
    [...sbMats, ...teacherMods].forEach((item) => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push(item);
      }
    });
    return result;
  }, [myMaterials, localTeacherModules]);

  // Filtered uploaded materials
  const filteredUploadedMaterials = useMemo(() => {
    return combinedUploadedMaterials.filter((m) => {
      const matchLevel =
        uploadedFilterLevel === 'all' ||
        m.level.toLowerCase() === (uploadedFilterLevel === 'PRE-K1' ? 'pre-k1' : 'pre-k2');
      const matchQuarter =
        uploadedFilterQuarter === 'all' ||
        String(m.quarter) === String(uploadedFilterQuarter);
      const matchType =
        uploadedFilterType === 'all' || m.type === uploadedFilterType;
      const matchSearch =
        !uploadedSearch.trim() ||
        m.title.toLowerCase().includes(uploadedSearch.toLowerCase()) ||
        (m.sub_theme || '').toLowerCase().includes(uploadedSearch.toLowerCase()) ||
        (m.theme || '').toLowerCase().includes(uploadedSearch.toLowerCase());

      return matchLevel && matchQuarter && matchType && matchSearch;
    });
  }, [combinedUploadedMaterials, uploadedFilterLevel, uploadedFilterQuarter, uploadedFilterType, uploadedSearch]);

  // Open upload modal with pre-filled curriculum data
  const handleOpenUploadFromCurriculum = (item) => {
    setUploadCurriculumLevel(item.level);
    setUploadQuarter(item.quarterNumber);
    setUploadWeek(item.week);
    setUploadTheme(item.theme);
    setUploadSubTheme(item.subTheme);
    setUploadTitle(`[${item.level} Q${item.quarterNumber} ${item.week}] ${item.subTheme}`);
    setUploadDescription(item.suggestedActivities || '');
    setUploadType('activity');
    setUploadUrl('');
    setUploadMsg({ text: '', type: '' });
    setIsUploadModalOpen(true);
    setActiveTab('upload');
  };

  // Open clean new upload modal
  const handleOpenNewUpload = () => {
    const curr = preK1Curriculum[0];
    const firstWeek = curr.weeks[0];
    setUploadCurriculumLevel('PRE-K1');
    setUploadQuarter(1);
    setUploadWeek(firstWeek.week);
    setUploadTheme(curr.theme);
    setUploadSubTheme(firstWeek.subTheme);
    setUploadTitle(`[PRE-K1 Q1 ${firstWeek.week}] ${firstWeek.subTheme}`);
    setUploadDescription('');
    setUploadType('activity');
    setUploadUrl('');
    setUploadMsg({ text: '', type: '' });
    setIsUploadModalOpen(true);
  };

  // Modal Level change handler
  const handleModalLevelChange = (newLevel) => {
    setUploadCurriculumLevel(newLevel);
    const curr = newLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;
    const qObj = curr.find((q) => q.quarterNumber === parseInt(uploadQuarter, 10)) || curr[0];
    const wObj = qObj.weeks[0];
    setUploadWeek(wObj.week);
    setUploadTheme(qObj.theme);
    setUploadSubTheme(wObj.subTheme);
    setUploadTitle(`[${newLevel} Q${qObj.quarterNumber} ${wObj.week}] ${wObj.subTheme}`);
  };

  // Modal Quarter change handler
  const handleModalQuarterChange = (newQ) => {
    setUploadQuarter(newQ);
    const curr = uploadCurriculumLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;
    const qObj = curr.find((q) => q.quarterNumber === parseInt(newQ, 10)) || curr[0];
    const wObj = qObj.weeks[0];
    setUploadWeek(wObj.week);
    setUploadTheme(qObj.theme);
    setUploadSubTheme(wObj.subTheme);
    setUploadTitle(`[${uploadCurriculumLevel} Q${qObj.quarterNumber} ${wObj.week}] ${wObj.subTheme}`);
  };

  // Modal Week change handler
  const handleModalWeekChange = (newWeekStr) => {
    setUploadWeek(newWeekStr);
    const curr = uploadCurriculumLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;
    const qObj = curr.find((q) => q.quarterNumber === parseInt(uploadQuarter, 10)) || curr[0];
    const wObj = qObj.weeks.find((w) => w.week === newWeekStr) || qObj.weeks[0];
    if (wObj) {
      setUploadSubTheme(wObj.subTheme);
      setUploadTheme(qObj.theme);
      setUploadTitle(`[${uploadCurriculumLevel} Q${qObj.quarterNumber} ${wObj.week}] ${wObj.subTheme}`);
    }
  };

  // Handle Save Uploaded Material
  async function handleSaveMaterial(e) {
    if (e) e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadMsg({ text: '⚠️ Please enter a title for this material.', type: 'error' });
      return;
    }

    // 1. Insert to Supabase materials
    const catId = categoryOptions.length > 0 ? categoryOptions[0].id : null;
    try {
      await supabase.from('materials').insert({
        category_id: catId,
        type: uploadType,
        title: uploadTitle.trim(),
        age_range: uploadCurriculumLevel === 'PRE-K1' ? '3.11' : '4.11',
        content_url: uploadUrl.trim() || null,
        content_text: uploadDescription.trim() || null,
        created_by: currentUserId,
      });
    } catch (err) {
      console.warn('Note on Supabase insert:', err);
    }

    // 2. Insert to localTeacherModules for cross-dashboard visibility
    const newMod = {
      id: 'mod-' + Date.now(),
      title: uploadTitle.trim(),
      teacher_name: profile?.full_name || 'Teacher',
      teacher_id: currentUserId,
      cdc_name: myCdcName || profile?.cdc_name || 'Manolo Fortich CDC',
      barangay: myBarangay || profile?.barangay || 'Manolo Fortich',
      level: uploadCurriculumLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2',
      quarter: parseInt(uploadQuarter, 10),
      week: uploadWeek,
      sub_theme: uploadSubTheme,
      theme: uploadTheme,
      module_type: uploadType === 'activity' ? 'Activity Worksheet' : uploadType === 'video' ? 'Video Lesson' : uploadType === 'image' ? 'Worksheet Image' : 'Reading Story',
      file_type: uploadType.toUpperCase(),
      file_size: '2.4 MB',
      upload_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Approved',
      verified_by_mswd: true,
      description: uploadDescription.trim() || `${uploadCurriculumLevel} ${uploadWeek} ECCD learning activity on ${uploadSubTheme}`,
      content_url: uploadUrl.trim() || null,
      content_text: uploadDescription.trim() || null,
      downloads_count: 0,
      type: uploadType,
      is_custom_teacher_upload: true,
    };

    const updated = [newMod, ...localTeacherModules];
    setLocalTeacherModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
    } catch {
      // Ignored
    }

    loadMyMaterials();
    setUploadMsg({ text: '✅ Learning material uploaded and linked to Curriculum Guide!', type: 'ok' });
    setTimeout(() => {
      setIsUploadModalOpen(false);
      setUploadMsg({ text: '', type: '' });
    }, 1200);
  }

  // Delete material
  async function handleDeleteMaterial(mat) {
    if (!confirm(`Delete "${mat.title}"?`)) return;
    if (!mat.isLocal) {
      await supabase.from('materials').delete().eq('id', mat.id);
      loadMyMaterials();
    }
    const updated = localTeacherModules.filter((m) => m.id !== mat.id);
    setLocalTeacherModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
    } catch {
      // Ignored
    }
  }

  // --- Announcements ---
  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data);
  }, []);

  async function postAnnouncement() {
    if (!annTitle.trim() || !annMessage.trim()) {
      setAnnStatusMsg({ text: '⚠️ Please enter a title and message', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('announcements')
      .insert({ title: annTitle.trim(), message: annMessage.trim(), created_by: currentUserId });
    if (error) {
      setAnnStatusMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setAnnStatusMsg({ text: '✅ Announcement posted!', type: 'ok' });
      setAnnTitle('');
      setAnnMessage('');
      loadAnnouncements();
    }
  }

  async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  }

  // --- Submissions ---
  const loadSubmissions = useCallback(async () => {
    let list = [];
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, answer_text, status, profiles(full_name), materials(title)')
        .order('created_at', { ascending: false });
      if (!error && data) list = [...data];
    } catch {
      // fallback
    }

    try {
      const localStudentUploads = JSON.parse(localStorage.getItem('earlylearn_student_uploads') || '[]');
      const localSubs = localStudentUploads.map((u) => ({
        id: u.id,
        answer_text: `[${u.category || 'Artwork'}] ${u.title}: ${u.note || ''}`,
        status: u.status === 'Checked' ? 'checked' : 'submitted',
        profiles: { full_name: u.studentName || 'Student Test' },
        materials: { title: u.title },
        mediaUrl: u.mediaUrl,
        isStudentUpload: true,
      }));
      const existingIds = new Set(list.map((s) => s.id));
      localSubs.forEach((s) => {
        if (!existingIds.has(s.id)) list.push(s);
      });
    } catch {
      // ignore
    }

    setSubmissions(list);
  }, []);

  async function markChecked(id) {
    try {
      await supabase.from('submissions').update({ status: 'checked' }).eq('id', id);
    } catch {
      // ignore
    }
    try {
      const localStudentUploads = JSON.parse(localStorage.getItem('earlylearn_student_uploads') || '[]');
      const updated = localStudentUploads.map((u) => (u.id === id ? { ...u, status: 'Checked' } : u));
      localStorage.setItem('earlylearn_student_uploads', JSON.stringify(updated));
    } catch {
      // ignore
    }
    loadSubmissions();
  }

  // --- Progress ---
  const loadProgress = useCallback(async () => {
    const { data: students } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student');
    const { data: subs } = await supabase.from('submissions').select('student_id, status');

    setTotalStudents((students || []).length);

    const rows = (students || []).map((st) => {
      const mine = (subs || []).filter((s) => s.student_id === st.id);
      const checked = mine.filter((s) => s.status === 'checked').length;
      return { id: st.id, name: st.full_name || '-', submitted: mine.length, checked };
    });
    setProgressRows(rows);
  }, []);

  // --- My Profile ---
  const loadMyProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('barangay')
      .eq('id', currentUserId)
      .single();
    if (data?.barangay) setMyBarangay(data.barangay);
  }, [currentUserId]);

  async function saveBarangay() {
    if (!myBarangay) {
      setProfileMsg({ text: '⚠️ Please select a barangay first', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ barangay: myBarangay })
      .eq('id', currentUserId);
    if (error) setProfileMsg({ text: '❌ ' + error.message, type: 'error' });
    else setProfileMsg({ text: '✅ Barangay saved!', type: 'ok' });
  }

  // --- My Learners: find this teacher's CDC and Barangay, then list learners in that jurisdiction ---
  const loadMyLearners = useCallback(async () => {
    setLearnersLoading(true);

    let dbTeacher = null;
    try {
      const { data } = await supabase
        .from('teachers')
        .select('id, full_name, barangay, cdc_id, cdcs(id, name, barangay)')
        .eq('id', currentUserId)
        .single();
      dbTeacher = data;
    } catch {
      // ignore
    }

    const teacherName = profile?.full_name || '';
    const cleanTeacherName = teacherName.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();

    // Check if matched in real baseline teachers
    const baselineMatch = realTeachersList.find(
      (t) =>
        t.id === currentUserId ||
        (cleanTeacherName && t.full_name?.toLowerCase().includes(cleanTeacherName)) ||
        (profile?.email && t.email?.toLowerCase() === profile.email.toLowerCase())
    );

    const effectiveBarangay =
      myBarangay ||
      dbTeacher?.barangay ||
      profile?.barangay ||
      baselineMatch?.barangay ||
      '';

    const effectiveCdcId = dbTeacher?.cdc_id || null;

    let effectiveCdcName =
      dbTeacher?.cdcs?.name ||
      baselineMatch?.cdc_name ||
      '';

    if (!effectiveCdcName && effectiveBarangay) {
      effectiveCdcName = getCdcForBarangay(effectiveBarangay)?.name || `${effectiveBarangay} Child Development Center`;
    }

    setMyCdcName(effectiveCdcName || (effectiveBarangay ? `${effectiveBarangay} Child Development Center` : null));
    if (effectiveBarangay && !myBarangay) {
      setMyBarangay(effectiveBarangay);
    }

    // Load learners for this teacher's assigned barangay & CDC
    try {
      const learners = await getLearnersForTeacher({
        teacherId: currentUserId,
        teacherName: teacherName || baselineMatch?.full_name || '',
        barangay: effectiveBarangay,
        cdcName: effectiveCdcName,
        cdcId: effectiveCdcId,
      });

      setMyLearners(learners || []);
    } catch (err) {
      console.warn('Failed loading learners for teacher:', err);
      setMyLearners([]);
    } finally {
      setLearnersLoading(false);
    }
  }, [currentUserId, profile, myBarangay]);

  // Live synchronization: auto-reload learners when a student signs up or logs in
  useEffect(() => {
    function handleLearnerSync(e) {
      if (
        e.type === 'earlylearn_learners_updated' ||
        (e.type === 'storage' && e.key === 'earlylearn_registered_learners')
      ) {
        loadMyLearners();
      }
    }

    window.addEventListener('storage', handleLearnerSync);
    window.addEventListener('earlylearn_learners_updated', handleLearnerSync);
    return () => {
      window.removeEventListener('storage', handleLearnerSync);
      window.removeEventListener('earlylearn_learners_updated', handleLearnerSync);
    };
  }, [loadMyLearners]);

  useEffect(() => {
    loadCategoryOptions();
    loadMyMaterials();
    loadAnnouncements();
    loadSubmissions();
    loadProgress();
    loadMyProfile();
    loadMyLearners();
  }, [
    loadCategoryOptions,
    loadMyMaterials,
    loadAnnouncements,
    loadSubmissions,
    loadProgress,
    loadMyProfile,
    loadMyLearners,
  ]);

  const statusPillKind = (s) => ({ approved: 'checked', pending: 'submitted', rejected: 'submitted' }[s] || 'checked');
  const statusLabel = (s) => (s === 'rejected' ? '❌ rejected' : s || 'approved');

  return (
    <DashboardLayout
      logoSubtitle="Teacher"
      tabs={TABS}
      title="Teacher Dashboard"
      subtitle="Manolo Fortich, Bukidnon · EarlyLearn Hub"
      avatar="👩‍🏫"
      stats={[
        { label: 'Materials Uploaded', value: combinedUploadedMaterials.length || 0 },
        {
          label: 'Pending Submissions',
          value: submissions.filter((s) => s.status === 'submitted').length,
        },
        { label: 'Total Students', value: myLearners.length || totalStudents || 0 },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Welcome, Teacher!</h3>
          <p className="text-sm text-[#5c5342]">
            Use the menu on the left to upload materials/activities, post announcements, and
            check student submissions.
          </p>
        </div>
      )}

      {/* CURRICULUM GUIDE (PRE-K1 & PRE-K2 ASSIGNED BY MSWD) */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          {/* Header & Status Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                Official DepEd ECCD • MSWDO Manolo Fortich
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 m-0 mt-2 tracking-tight">
                Curriculum Guides &amp; Weekly Lesson Plans
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Official prescribed early childhood curriculum lessons assigned to your center by MSWDO Manolo Fortich.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                School Year 2026–2027 Active
              </span>
            </div>
          </div>

          {/* Controls: Level Tabs, Quarter Filter, Search */}
          <div className={cardBox}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              {/* Level Selector */}
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCurriculumLevel('PRE-K1')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    curriculumLevel === 'PRE-K1'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  PRE-K 1 (3.11 years old)
                </button>
                <button
                  type="button"
                  onClick={() => setCurriculumLevel('PRE-K2')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    curriculumLevel === 'PRE-K2'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  PRE-K 2 (4.11 years old)
                </button>
              </div>

              {/* Quarter Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-1">Quarter:</span>
                {['all', '1', '2', '3', '4'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setCurriculumQuarter(q)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border ${
                      curriculumQuarter === q
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {q === 'all' ? 'All Quarters' : `Q${q}`}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search theme or lesson..."
                  value={curriculumSearch}
                  onChange={(e) => setCurriculumSearch(e.target.value)}
                  className={`${input} py-1.5 text-xs`}
                />
              </div>
            </div>

            {/* Curriculum Table */}
            <div className="overflow-x-auto mt-4">
              <table className={table}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    <th className={`${th} w-16 text-center`}>Qtr</th>
                    <th className={`${th} w-20 text-center`}>Week</th>
                    <th className={th}>Suggested Content / Lesson</th>
                    <th className={`${th} bg-amber-50 text-amber-950 font-semibold border-l-2 border-amber-400`}>
                      THEME (FOCUS AREA)
                    </th>
                    <th className={th}>Sub-Themes / Competencies</th>
                    <th className={`${th} w-24 text-center`}>Month</th>
                    <th className={`${th} w-36 text-center`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flatCurriculumWeeks.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className={`${td} text-center font-bold text-xs text-slate-500`}>
                        Q{item.quarterNumber}
                      </td>
                      <td className={`${td} text-center whitespace-nowrap`}>
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.week}
                        </span>
                      </td>
                      <td className={`${td} font-medium text-slate-900`}>
                        {item.suggestedContent}
                      </td>
                      <td className={`${td} bg-amber-50/80 font-semibold text-amber-950 border-l-2 border-amber-400`}>
                        {item.theme}
                      </td>
                      <td className={`${td} text-xs text-slate-700 leading-relaxed font-medium`}>
                        {item.subTheme}
                      </td>
                      <td className={`${td} text-center text-xs text-slate-500 font-medium`}>
                        {item.month || '-'}
                      </td>
                      <td className={`${td} text-center`}>
                        <button
                          type="button"
                          onClick={() => handleOpenUploadFromCurriculum(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-900 hover:text-white rounded-md transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                          title={`Upload material aligned with ${item.week}`}
                        >
                          + Upload Module
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MY LEARNERS — auto-matched by CDC and Barangay */}
      {activeTab === 'mylearners' && (
        <div className={cardBox}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className={cardBoxTitle}>My Learners</h3>
              <p className="text-[12.5px] text-dash-ink-soft m-0">
                Showing learners assigned to <strong>{myCdcName || (myBarangay ? `${myBarangay} Child Development Center` : 'Child Development Center')}</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                👥 {myLearners.length} {myLearners.length === 1 ? 'Learner' : 'Learners'} Enrolled
              </span>
              <button
                type="button"
                onClick={loadMyLearners}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer flex items-center gap-1"
                title="Refresh learner list"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {learnersLoading && <p className="text-[13px] text-dash-ink-soft">Loading learners...</p>}

          {!learnersLoading && (
            <>
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>NAME</th>
                      <th className={th}>BIRTHDATE</th>
                      <th className={th}>PARENT</th>
                      <th className={th}>CONTACT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLearners.map((l) => (
                      <tr key={l.id}>
                        <td className={td}>
                          <div className="flex items-center gap-2">
                            <span>🧒</span>
                            <span className="font-bold text-slate-900">{l.full_name}</span>
                          </div>
                        </td>
                        <td className={td}>{l.birthdate || l.child_age || '-'}</td>
                        <td className={td}>{l.parent_name || '-'}</td>
                        <td className={td}>{l.parent_contact || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {myLearners.length === 0 && (
                <p className="text-[13px] mt-3 text-dash-ink-soft">
                  No learners recorded yet for {myCdcName || (myBarangay ? `${myBarangay} Child Development Center` : 'this Child Development Center')}.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* UPLOADED MATERIALS */}
      {activeTab === 'upload' && (
        <div className="space-y-5">
          {/* Header Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                <IconMaterials className="w-3.5 h-3.5 text-slate-500" />
                <span>Child Development Center Materials Repository</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 m-0 mt-2 tracking-tight">
                Uploaded Materials &amp; Activities
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Curriculum-aligned learning materials, activities, and worksheets created for your learners.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenNewUpload}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              <span>+ Upload New Material</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-medium text-slate-500 uppercase">Total Uploaded</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {combinedUploadedMaterials.length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-medium text-emerald-700 uppercase">Live to Students</div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {combinedUploadedMaterials.filter((m) => m.status === 'Approved' || m.status === 'approved').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-medium text-amber-700 uppercase">Pending Review</div>
              <div className="text-2xl font-bold text-amber-800 mt-1">
                {combinedUploadedMaterials.filter((m) => m.status !== 'Approved' && m.status !== 'approved').length}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-slate-700">Filter Materials:</span>

            {/* Level Filter */}
            <select
              value={uploadedFilterLevel}
              onChange={(e) => setUploadedFilterLevel(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none"
            >
              <option value="all">All Levels</option>
              <option value="PRE-K1">PRE-K 1 (3.11 y/o)</option>
              <option value="PRE-K2">PRE-K 2 (4.11 y/o)</option>
            </select>

            {/* Quarter Filter */}
            <select
              value={uploadedFilterQuarter}
              onChange={(e) => setUploadedFilterQuarter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none"
            >
              <option value="all">All Quarters</option>
              <option value="1">Quarter 1</option>
              <option value="2">Quarter 2</option>
              <option value="3">Quarter 3</option>
              <option value="4">Quarter 4</option>
            </select>

            {/* Type Filter */}
            <select
              value={uploadedFilterType}
              onChange={(e) => setUploadedFilterType(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none"
            >
              <option value="all">All Types</option>
              <option value="activity">✏️ Activity Worksheet</option>
              <option value="video">🎬 Video Lesson</option>
              <option value="image">🖼️ Worksheet / Image</option>
              <option value="text">📖 Reading Story</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search uploaded materials or lesson topic..."
                value={uploadedSearch}
                onChange={(e) => setUploadedSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none"
              />
              <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {(uploadedFilterLevel !== 'all' || uploadedFilterQuarter !== 'all' || uploadedFilterType !== 'all' || uploadedSearch) && (
              <button
                type="button"
                onClick={() => {
                  setUploadedFilterLevel('all');
                  setUploadedFilterQuarter('all');
                  setUploadedFilterType('all');
                  setUploadedSearch('');
                }}
                className="text-xs text-accent hover:underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Uploaded Materials Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    <th className="px-4 py-3">Material Title &amp; ECCD Lesson</th>
                    <th className="px-4 py-3">Curriculum Level &amp; Week</th>
                    <th className="px-4 py-3">Format / Type</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUploadedMaterials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{m.title}</div>
                        {m.sub_theme && (
                          <div className="text-[11px] text-amber-900 font-medium mt-0.5">
                            Lesson Theme: {m.sub_theme}
                          </div>
                        )}
                        {m.content_text && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {m.content_text}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold w-fit ${
                            m.level?.toLowerCase().includes('pre-k1')
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {m.level?.toUpperCase().includes('PRE-K') ? m.level : 'Pre-K1'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700">
                            Quarter {m.quarter} • {m.week}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          <span>{m.type === 'video' ? '🎬' : m.type === 'image' ? '🖼️' : m.type === 'text' ? '📖' : '✏️'}</span>
                          <span>{m.formatLabel}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          m.status === 'Approved' || m.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {m.status === 'Approved' || m.status === 'approved' ? 'Active / Visible' : 'Under Review'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(m)}
                          className="px-2.5 py-1 rounded text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUploadedMaterials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <div className="text-2xl mb-1">📂</div>
                        <div className="font-semibold text-xs">No uploaded materials match your filter</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Click "+ Upload New Material" or browse the Curriculum Guide to create one.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simple Upload Modal */}
          {isUploadModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 my-8">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 m-0">
                      Upload Curriculum Learning Material
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Directly assigned to official DepEd ECCD weekly lessons.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <IconClose className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveMaterial} className="space-y-3.5 text-xs">
                  {/* Step 1: Curriculum Level */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      1. Curriculum Level
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleModalLevelChange('PRE-K1')}
                        className={`py-2 px-3 rounded-lg font-semibold border text-left cursor-pointer transition-colors ${
                          uploadCurriculumLevel === 'PRE-K1'
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold">PRE-K 1</div>
                        <div className="text-[10.5px] opacity-80">3.11 years old (3 – 3.11)</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModalLevelChange('PRE-K2')}
                        className={`py-2 px-3 rounded-lg font-semibold border text-left cursor-pointer transition-colors ${
                          uploadCurriculumLevel === 'PRE-K2'
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold">PRE-K 2</div>
                        <div className="text-[10.5px] opacity-80">4.11 years old (4 – 4.11)</div>
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Quarter & Week */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        2. Quarter
                      </label>
                      <select
                        value={uploadQuarter}
                        onChange={(e) => handleModalQuarterChange(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none"
                      >
                        <option value={1}>Quarter 1</option>
                        <option value={2}>Quarter 2</option>
                        <option value={3}>Quarter 3</option>
                        <option value={4}>Quarter 4</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        3. ECCD Week &amp; Theme
                      </label>
                      <select
                        value={uploadWeek}
                        onChange={(e) => handleModalWeekChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none"
                      >
                        {availableWeeksForUploadModal.weeks.map((w) => (
                          <option key={w.week} value={w.week}>
                            {w.week}: {w.subTheme}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Step 3: Material Type */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      4. Activity / Material Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { type: 'activity', label: '✏️ Activity', desc: 'With submission' },
                        { type: 'video', label: '🎬 Video', desc: 'YouTube or link' },
                        { type: 'image', label: '🖼️ Worksheet', desc: 'Picture guide' },
                        { type: 'text', label: '📖 Story', desc: 'Story / text' },
                      ].map((t) => (
                        <button
                          key={t.type}
                          type="button"
                          onClick={() => setUploadType(t.type)}
                          className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                            uploadType === t.type
                              ? 'border-slate-900 bg-slate-50 font-bold text-slate-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div>{t.label}</div>
                          <div className="text-[10px] text-slate-400">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Material Title */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      5. Material Title
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. [Pre-K 1 Q1 W1] I Have A Name - Fun Writing Practice"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none"
                    />
                  </div>

                  {/* Step 5: Content URL */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      6. Resource / Video / Worksheet Link <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="url"
                      value={uploadUrl}
                      onChange={(e) => setUploadUrl(e.target.value)}
                      placeholder="https://youtube.com/... or cloud link"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 outline-none"
                    />
                  </div>

                  {/* Step 6: Instructions / Question */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      7. Activity Instructions or Question for Parent &amp; Learner
                    </label>
                    <textarea
                      rows={3}
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="e.g. Help your child trace their first name with crayons. Write what letters they recognized!"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 outline-none resize-none"
                    />
                  </div>

                  {uploadMsg.text && (
                    <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                      uploadMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      {uploadMsg.text}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs cursor-pointer"
                    >
                      Upload Material
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Post Announcement</h3>
          <label className={label}>Title</label>
          <input
            type="text"
            placeholder="e.g. No classes tomorrow"
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            className={input}
          />
          <label className={label}>Message</label>
          <textarea
            placeholder="Write the announcement details here..."
            value={annMessage}
            onChange={(e) => setAnnMessage(e.target.value)}
            className={`${input} min-h-[70px] resize-y`}
          />
          <button onClick={postAnnouncement} className={btnPrimary}>
            Post Announcement
          </button>
          {annStatusMsg.text && (
            <p className={annStatusMsg.type === 'error' ? msgError : msgOk}>{annStatusMsg.text}</p>
          )}

          <h3 className={`${cardBoxTitle} mt-7`}>Recent Announcements</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Message</th>
                  <th className={th}>Posted</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id}>
                    <td className={td}>{a.title}</td>
                    <td className={`${td} max-w-[260px]`}>{a.message}</td>
                    <td className={td}>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className={td}>
                      <button onClick={() => deleteAnnouncement(a.id)} className={delBtn}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Student Submissions</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Activity</th>
                  <th className={th}>Answer</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>{s.profiles?.full_name || '-'}</td>
                    <td className={td}>{s.materials?.title || '-'}</td>
                    <td className={td}>{s.answer_text || '-'}</td>
                    <td className={td}>
                      <span className={pillClass(s.status)}>{s.status}</span>
                    </td>
                    <td className={td}>
                      {s.status === 'submitted' && (
                        <button onClick={() => markChecked(s.id)} className={btnSmall}>
                          Mark Checked
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {submissions.length === 0 && (
            <p className="text-[13px] mt-3 text-dash-ink-soft">
              No submissions from students yet.
            </p>
          )}
        </div>
      )}

      {/* PROGRESS */}
      {activeTab === 'progress' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Student Progress</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>Checked</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>{r.name}</td>
                    <td className={td}>{r.submitted}</td>
                    <td className={td}>{r.checked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MY PROFILE */}
      {activeTab === 'profile' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>My Profile</h3>
          <label className={label}>Barangay</label>
          <select
            value={myBarangay}
            onChange={(e) => setMyBarangay(e.target.value)}
            className={input}
          >
            <option value="">— select your barangay —</option>
            {barangays.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button onClick={saveBarangay} className={btnPrimary}>
            Save
          </button>
          {profileMsg.text && (
            <p className={profileMsg.type === 'error' ? msgError : msgOk}>{profileMsg.text}</p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}