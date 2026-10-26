import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import DashboardLayout from '../components/DashboardLayout.jsx';
import {
  preK1Curriculum,
  preK2Curriculum,
  initialCurriculumAssignments,
  getCleanCurriculumAssignments,
  initialTeacherModules,
  realTeachersList,
  realCdcsList,
} from '../lib/curriculumData.js';
import { getLearnersForTeacher, getCdcForBarangay } from '../lib/learnersService.js';
import TeacherChildDevelopment from '../components/teacher/TeacherChildDevelopment.jsx';
import {
  IconPlus,
  IconSearch,
  IconMaterials,
  IconCheck,
  IconClose,
  IconTeachers,
  IconBuilding,
  IconPin,
  IconRefresh,
  IconUpload,
  IconTrash,
  IconEdit,
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
  { key: 'assigned_topics', label: 'Assigned Topics & Tasks', icon: '📋' },
  { key: 'mylearners', label: 'My Learners', icon: '🧒' },
  { key: 'child_development', label: 'Child Development', icon: '🌱' },
  { key: 'upload', label: 'Uploaded Materials', icon: '📁' },
  { key: 'announcements', label: 'Announcements', icon: '📢' },
  { key: 'submissions', label: 'Check Submissions', icon: '📝' },
  { key: 'progress', label: 'Student Progress', icon: '📈' },
  { key: 'profile', label: 'My Profile', icon: '👩‍🏫' },
];

export default function TeacherDashboard({ profile }) {
  const currentUserId = profile.id;
  const [activeTab, setActiveTab] = useState('overview');

  // MSWD Admin Assigned Topics & Tasks state (Real MSWDO deployments only)
  const [assignments, setAssignments] = useState(getCleanCurriculumAssignments);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const [activeAssignmentDeadline, setActiveAssignmentDeadline] = useState(null);
  const [topicStatusFilter, setTopicStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'expired'
  const [topicLevelFilter, setTopicLevelFilter] = useState('all');
  const [topicQuarterFilter, setTopicQuarterFilter] = useState('all');
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // Curriculum Guide Tab state (legacy fallback)
  const [curriculumLevel, setCurriculumLevel] = useState('PRE-K1');
  const [curriculumQuarter, setCurriculumQuarter] = useState('all');
  const [curriculumSearch, setCurriculumSearch] = useState('');

  // Uploaded Materials & Modules state (persisted per teacher)
  const [localTeacherModules, setLocalTeacherModules] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // Clean out any legacy mod-01 to mod-12 dummy items
      const filtered = parsed.filter((m) => m && m.id && !/^mod-0[1-9]$|^mod-1[0-2]$/.test(m.id));
      if (filtered.length !== parsed.length) {
        localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
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

  // Choose file & Drag file upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState('');
  const [uploadFileType, setUploadFileType] = useState('');
  const [uploadFilePreview, setUploadFilePreview] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

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

  // Profile tab states (personal info, barangay, and specific CDC)
  const [myFullName, setMyFullName] = useState(profile?.full_name || '');
  const [myContact, setMyContact] = useState(profile?.contact_number || '');
  const [myEmail, setMyEmail] = useState(profile?.email || '');
  const [myBarangay, setMyBarangay] = useState(profile?.barangay || '');
  const [myCdcId, setMyCdcId] = useState(profile?.cdc_id || '');
  const [myCdcName, setMyCdcName] = useState(profile?.cdc_name || null);
  const [customCdcMode, setCustomCdcMode] = useState(false);
  const [customCdcInput, setCustomCdcInput] = useState('');
  const [myBio, setMyBio] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  // My Learners tab — auto-filtered by this teacher's assigned CDC
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

  // Available weeks for Upload Modal based on level & quarter
  const availableWeeksForUploadModal = useMemo(() => {
    const curr = uploadCurriculumLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;
    const qObj = curr.find((q) => q.quarterNumber === parseInt(uploadQuarter, 10)) || curr[0];
    return qObj || { weeks: [] };
  }, [uploadCurriculumLevel, uploadQuarter]);

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
      file_name: m.file_name || null,
      file_size: m.file_size || null,
      file_type: m.file_type || null,
      content_url: m.content_url || null,
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
        file_name: m.file_name || null,
        file_size: m.file_size || null,
        file_type: m.file_type || null,
        content_url: m.content_url || null,
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

  // Handle File Chosen / Dropped for Upload
  const handleFileSelected = (file) => {
    if (!file) return;
    setUploadFile(file);
    setUploadFileName(file.name);

    const sizeFormatted =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : (file.size / 1024).toFixed(0) + ' KB';
    setUploadFileSize(sizeFormatted);

    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    setUploadFileType(ext);

    // Auto-detect format type
    const lowerExt = ext.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(lowerExt)) {
      setUploadType('image');
    } else if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(lowerExt)) {
      setUploadType('video');
    } else if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(lowerExt)) {
      setUploadType('file');
    }

    // Auto-fill title if currently blank or standard prefix
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!uploadTitle.trim() || uploadTitle.match(/^\[.*\]\s*$/)) {
      setUploadTitle(`[${uploadCurriculumLevel} Q${uploadQuarter} ${uploadWeek}] ${cleanName}`);
    }

    // Read file for preview / download URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setUploadFilePreview(dataUrl);
      setUploadUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSelectedFile = () => {
    setUploadFile(null);
    setUploadFileName('');
    setUploadFileSize('');
    setUploadFileType('');
    setUploadFilePreview(null);
    setIsDraggingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Open upload modal linked specifically to an admin assigned topic
  const handleOpenUploadForAssignedTopic = (asg) => {
    const isPast = Boolean(asg.deadline && new Date(asg.deadline + 'T23:59:59') < new Date());
    if (isPast) {
      alert(`⚠️ Cannot upload: The deadline for "${asg.topicTitle || asg.subTheme}" expired on ${asg.deadline}. New uploads are locked.`);
      return;
    }

    handleRemoveSelectedFile();
    setActiveAssignmentId(asg.id);
    setActiveAssignmentDeadline(asg.deadline || null);

    const resolvedLevel = asg.level === 'Pre-K2' ? 'PRE-K2' : 'PRE-K1';
    setUploadCurriculumLevel(resolvedLevel);

    const resolvedQuarter = asg.quarter || (asg.quarters && asg.quarters[0]) || 1;
    setUploadQuarter(resolvedQuarter);

    const resolvedWeek = asg.week || (Array.isArray(asg.weeks) ? asg.weeks[0] : 'Week 1');
    setUploadWeek(resolvedWeek);

    setUploadTheme(asg.theme || (resolvedLevel === 'PRE-K1' ? 'TELL ME ABOUT YOURSELF' : 'MORE ABOUT MYSELF AND MY SCHOOL'));
    const resolvedTopic = asg.topicTitle || asg.subTheme || 'Prescribed Lesson';
    setUploadSubTheme(resolvedTopic);
    setUploadTitle(`[${resolvedLevel} Q${resolvedQuarter} ${resolvedWeek}] ${resolvedTopic}`);
    setUploadDescription(asg.suggestedActivities || asg.suggestedContent || '');
    setUploadType('activity');
    setUploadUrl('');
    setUploadMsg({ text: '', type: '' });
    setIsUploadModalOpen(true);
  };

  // Open upload modal with pre-filled curriculum data
  const handleOpenUploadFromCurriculum = (item) => {
    handleRemoveSelectedFile();
    setActiveAssignmentId(null);
    setActiveAssignmentDeadline(null);
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
    handleRemoveSelectedFile();
    setActiveAssignmentId(null);
    setActiveAssignmentDeadline(null);
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

    const effectiveUrl = uploadFilePreview || uploadUrl.trim() || null;
    const effectiveFileName = uploadFileName || null;
    const effectiveFileSize = uploadFileSize || '2.4 MB';
    const effectiveFileType = uploadFileType || (uploadType === 'video' ? 'MP4' : uploadType === 'file' ? 'PDF' : uploadType.toUpperCase());

    // 1. Insert to Supabase materials
    const catId = categoryOptions.length > 0 ? categoryOptions[0].id : null;
    try {
      await supabase.from('materials').insert({
        category_id: catId,
        type: uploadType,
        title: uploadTitle.trim(),
        age_range: uploadCurriculumLevel === 'PRE-K1' ? '3.11' : '4.11',
        content_url: effectiveUrl,
        content_text: uploadDescription.trim() || null,
        created_by: currentUserId,
      });
    } catch (err) {
      console.warn('Note on Supabase insert:', err);
    }

    // 2. Insert to localTeacherModules for cross-dashboard visibility & activity monitoring
    const newMod = {
      id: 'mod-' + Date.now(),
      assignment_id: activeAssignmentId || null,
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
      module_type: uploadType === 'activity' ? 'Activity Worksheet' : uploadType === 'file' ? 'Official PDF Document' : uploadType === 'video' ? 'Video Lesson' : uploadType === 'image' ? 'Worksheet Image' : 'Reading Story',
      file_type: effectiveFileType,
      file_size: effectiveFileSize,
      file_name: effectiveFileName,
      upload_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Pending Review',
      verified_by_mswd: false,
      mswd_comments: '',
      description: uploadDescription.trim() || `${uploadCurriculumLevel} ${uploadWeek} ECCD learning activity on ${uploadSubTheme}`,
      content_url: effectiveUrl,
      content_text: uploadDescription.trim() || null,
      downloads_count: 0,
      type: uploadType,
      is_custom_teacher_upload: true,
    };

    const updated = [newMod, ...localTeacherModules];
    setLocalTeacherModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }

    // 3. If fulfilling an admin assigned topic, mark it as Completed!
    if (activeAssignmentId) {
      const updatedAssignments = assignments.map((a) =>
        a.id === activeAssignmentId
          ? {
              ...a,
              status: 'Completed',
              completedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            }
          : a
      );
      setAssignments(updatedAssignments);
      try {
        localStorage.setItem('earlylearn_curriculum_assignments', JSON.stringify(updatedAssignments));
        window.dispatchEvent(new CustomEvent('earlylearn_assignments_updated', { detail: updatedAssignments }));
      } catch (err) {
        console.warn('Failed saving assignment status:', err);
      }
    }

    loadMyMaterials();
    setUploadMsg({ text: '✅ Activity / file posted successfully! Marked topic as completed.', type: 'ok' });
    setTimeout(() => {
      setIsUploadModalOpen(false);
      setUploadMsg({ text: '', type: '' });
      setActiveAssignmentId(null);
      setActiveAssignmentDeadline(null);
      handleRemoveSelectedFile();
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

  // --- My Profile (Only Essential Volunteer Teacher Information) ---
  const loadMyProfile = useCallback(async () => {
    let loadedName = profile?.full_name || '';
    let loadedBarangay = profile?.barangay || '';
    let loadedContact = profile?.contact_number || '';
    let loadedEmail = profile?.email || '';
    let loadedCdcId = profile?.cdc_id || '';
    let loadedCdcName = profile?.cdc_name || '';
    let loadedBio = '';

    // 1. Check local storage overrides first
    try {
      const overrides = JSON.parse(localStorage.getItem('earlylearn_teacher_profiles_override') || '{}');
      const ov =
        overrides[currentUserId] ||
        (profile?.email && overrides[profile.email.toLowerCase()]) ||
        (loadedName && overrides[loadedName.trim().toLowerCase()]);
      if (ov) {
        if (ov.full_name) loadedName = ov.full_name;
        if (ov.barangay) loadedBarangay = ov.barangay;
        if (ov.contact_number) loadedContact = ov.contact_number;
        if (ov.email) loadedEmail = ov.email;
        if (ov.cdc_id) loadedCdcId = ov.cdc_id;
        if (ov.cdc_name) loadedCdcName = ov.cdc_name;
        if (ov.bio) loadedBio = ov.bio;
      }
    } catch {
      // ignore
    }

    // 2. Query Supabase profiles & teachers
    try {
      const { data: profData } = await supabase
        .from('profiles')
        .select('full_name, barangay')
        .eq('id', currentUserId)
        .single();
      if (profData?.full_name && !loadedName) loadedName = profData.full_name;
      if (profData?.barangay && !loadedBarangay) loadedBarangay = profData.barangay;

      const { data: teachData } = await supabase
        .from('teachers')
        .select('full_name, barangay, contact_number, email, cdc_id, cdcs(name)')
        .eq('id', currentUserId)
        .single();
      if (teachData) {
        if (teachData.full_name && !loadedName) loadedName = teachData.full_name;
        if (teachData.barangay && !loadedBarangay) loadedBarangay = teachData.barangay;
        if (teachData.contact_number && !loadedContact) loadedContact = teachData.contact_number;
        if (teachData.email && !loadedEmail) loadedEmail = teachData.email;
        if (teachData.cdc_id && !loadedCdcId) loadedCdcId = teachData.cdc_id;
        if (teachData.cdcs?.name && !loadedCdcName) loadedCdcName = teachData.cdcs.name;
      }
    } catch {
      // ignore
    }

    // 3. Fallback matching with realTeachersList if still blank
    if (!loadedBarangay || !loadedCdcName) {
      const match = realTeachersList.find(
        (t) =>
          t.id === currentUserId ||
          (t.email && profile?.email && t.email.toLowerCase() === profile.email.toLowerCase()) ||
          (t.full_name && loadedName && t.full_name.toLowerCase().includes(loadedName.toLowerCase()))
      );
      if (match) {
        if (!loadedName) loadedName = match.full_name;
        if (!loadedBarangay) loadedBarangay = match.barangay;
        if (!loadedCdcName) loadedCdcName = match.cdc_name;
        if (!loadedContact) loadedContact = match.contact_number;
        if (!loadedEmail) loadedEmail = match.email;
      }
    }

    setMyFullName(loadedName);
    setMyBarangay(loadedBarangay);
    setMyContact(loadedContact);
    setMyEmail(loadedEmail);
    setMyCdcId(loadedCdcId);
    setMyCdcName(loadedCdcName);
    setMyBio(loadedBio);
  }, [currentUserId, profile]);

  // Handle Save & Sync Teacher Profile (updates Supabase + local overrides + broadcasts to Admin)
  async function handleSaveTeacherProfile(e) {
    if (e) e.preventDefault();
    if (!myFullName.trim()) {
      setProfileMsg({ text: '⚠️ Palihug isulat ang imong kompleto nga Pangalan (Full Name).', type: 'error' });
      return;
    }
    if (!myBarangay) {
      setProfileMsg({ text: '⚠️ Palihug pilia ang imong Barangay nga gisilbihan.', type: 'error' });
      return;
    }

    const finalCdc = customCdcMode && customCdcInput.trim() ? customCdcInput.trim() : myCdcName;
    if (!finalCdc) {
      setProfileMsg({ text: '⚠️ Palihug pilia o isulat ang ngalan sa imong Child Development Center (CDC).', type: 'error' });
      return;
    }

    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });

    const updatedTeacher = {
      id: currentUserId,
      full_name: myFullName.trim(),
      email: myEmail.trim() || profile?.email || '',
      barangay: myBarangay,
      cdc_id: myCdcId || null,
      cdc_name: finalCdc,
      contact_number: myContact.trim() || null,
      bio: myBio.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // 1. Update Supabase profiles
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: updatedTeacher.full_name,
          barangay: updatedTeacher.barangay,
        })
        .eq('id', currentUserId);
    } catch (err) {
      console.warn('Note on Supabase profiles update:', err);
    }

    // 2. Upsert Supabase teachers table
    try {
      await supabase.from('teachers').upsert({
        id: currentUserId,
        full_name: updatedTeacher.full_name,
        email: updatedTeacher.email,
        barangay: updatedTeacher.barangay,
        cdc_id: updatedTeacher.cdc_id,
        contact_number: updatedTeacher.contact_number,
      });
    } catch (err) {
      console.warn('Note on Supabase teachers upsert:', err);
    }

    // 3. Save to localStorage overrides so it's always reliable across tabs
    try {
      const overrides = JSON.parse(localStorage.getItem('earlylearn_teacher_profiles_override') || '{}');
      overrides[currentUserId] = updatedTeacher;
      if (updatedTeacher.email) overrides[updatedTeacher.email.toLowerCase()] = updatedTeacher;
      if (updatedTeacher.full_name) overrides[updatedTeacher.full_name.toLowerCase()] = updatedTeacher;
      localStorage.setItem('earlylearn_teacher_profiles_override', JSON.stringify(overrides));
      localStorage.setItem('earlylearn_active_teacher_profile', JSON.stringify(updatedTeacher));
    } catch (err) {
      console.warn('Failed saving local overrides:', err);
    }

    // 4. Update component state and profile object
    if (profile) {
      profile.full_name = updatedTeacher.full_name;
      profile.barangay = updatedTeacher.barangay;
      profile.cdc_name = updatedTeacher.cdc_name;
      profile.contact_number = updatedTeacher.contact_number;
    }
    setMyCdcName(finalCdc);

    // 5. Broadcast to Admin Dashboard & other tabs
    window.dispatchEvent(new CustomEvent('earlylearn_teachers_updated', { detail: updatedTeacher }));
    window.dispatchEvent(new CustomEvent('earlylearn_teacher_profile_saved', { detail: updatedTeacher }));

    // 6. Reload learners for newly assigned CDC
    loadMyLearners();

    setProfileSaving(false);
    setProfileMsg({
      text: `✅ Malampusong na-save ang imong profile! Na-update na sa MSWDO Admin: ${finalCdc}, Brgy. ${myBarangay}.`,
      type: 'ok',
    });
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

    // Check local profile override first
    let override = null;
    try {
      const overrides = JSON.parse(localStorage.getItem('earlylearn_teacher_profiles_override') || '{}');
      override =
        overrides[currentUserId] ||
        (profile?.email && overrides[profile.email.toLowerCase()]);
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
      override?.barangay ||
      dbTeacher?.barangay ||
      profile?.barangay ||
      baselineMatch?.barangay ||
      '';

    const effectiveCdcId = override?.cdc_id || dbTeacher?.cdc_id || null;

    let effectiveCdcName =
      override?.cdc_name ||
      myCdcName ||
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

  // Live synchronization: auto-reload admin-assigned curriculum topics and modules
  useEffect(() => {
    function handleAssignmentsSync(e) {
      if (
        e.type === 'earlylearn_assignments_updated' ||
        (e.type === 'storage' && e.key === 'earlylearn_curriculum_assignments')
      ) {
        setAssignments(getCleanCurriculumAssignments());
      }
      if (
        e.type === 'earlylearn_modules_updated' ||
        (e.type === 'storage' && e.key === 'earlylearn_teacher_modules')
      ) {
        try {
          const savedMods = localStorage.getItem('earlylearn_teacher_modules');
          if (savedMods) setLocalTeacherModules(JSON.parse(savedMods));
        } catch (err) {
          console.warn('Failed syncing modules:', err);
        }
      }
    }

    window.addEventListener('storage', handleAssignmentsSync);
    window.addEventListener('earlylearn_assignments_updated', handleAssignmentsSync);
    window.addEventListener('earlylearn_modules_updated', handleAssignmentsSync);
    return () => {
      window.removeEventListener('storage', handleAssignmentsSync);
      window.removeEventListener('earlylearn_assignments_updated', handleAssignmentsSync);
      window.removeEventListener('earlylearn_modules_updated', handleAssignmentsSync);
    };
  }, []);

  // Filter assignments targeted to this logged-in teacher / CDC / Barangay (Real MSWDO deployments only)
  const myAssignedTopics = useMemo(() => {
    const teacherName = (myFullName || profile?.full_name || '').toLowerCase();
    const cleanName = teacherName.replace(/\s*\(.*?\)\s*/g, '').trim();
    const brgy = (myBarangay || profile?.barangay || '').toLowerCase();
    const cdc = (myCdcName || profile?.cdc_name || '').toLowerCase();

    return assignments.filter((a) => {
      const aTeacher = (a.teacherName || '').toLowerCase();
      const aBrgy = (a.barangay || '').toLowerCase();
      const aCdc = (a.cdcName || '').toLowerCase();

      const idMatch = a.teacherId && (a.teacherId === currentUserId || a.teacherId === profile?.id);
      const nameMatch = cleanName && (aTeacher.includes(cleanName) || cleanName.includes(aTeacher));
      const cdcMatch = cdc && (aCdc.includes(cdc) || cdc.includes(aCdc));
      const brgyMatch = brgy && (aBrgy.includes(brgy) || brgy.includes(aBrgy));
      const isUniversal =
        a.targetType === 'all' ||
        a.barangay === 'all' ||
        a.cdcName === 'All CDCs' ||
        a.teacherName === 'All Teachers';

      return idMatch || nameMatch || cdcMatch || brgyMatch || isUniversal;
    });
  }, [assignments, profile, currentUserId, myFullName, myBarangay, myCdcName]);

  // Enriched topics with deadline calculation and active filter matching
  const filteredAssignedTopics = useMemo(() => {
    return myAssignedTopics
      .map((asg) => {
        const isPastDeadline = Boolean(asg.deadline && new Date(asg.deadline + 'T23:59:59') < new Date());
        const matchingUpload = localTeacherModules.find(
          (m) =>
            m.assignment_id === asg.id ||
            (asg.topicTitle && m.sub_theme && m.sub_theme.toLowerCase() === asg.topicTitle.toLowerCase()) ||
            (asg.topicTitle && m.title && m.title.toLowerCase().includes(asg.topicTitle.toLowerCase()))
        );
        const isCompleted = asg.status === 'Completed' || Boolean(matchingUpload);

        return {
          ...asg,
          isPastDeadline,
          isCompleted,
          matchingUpload,
        };
      })
      .filter((asg) => {
        // Status filter
        if (topicStatusFilter === 'pending' && (asg.isCompleted || asg.isPastDeadline)) return false;
        if (topicStatusFilter === 'completed' && !asg.isCompleted) return false;
        if (topicStatusFilter === 'expired' && (!asg.isPastDeadline || asg.isCompleted)) return false;

        // Level filter
        if (topicLevelFilter !== 'all' && asg.level?.toLowerCase() !== topicLevelFilter.toLowerCase()) return false;

        // Quarter filter
        if (topicQuarterFilter !== 'all') {
          const qInt = parseInt(topicQuarterFilter, 10);
          const hasQ = asg.quarters ? asg.quarters.includes(qInt) : asg.quarter === qInt;
          if (!hasQ) return false;
        }

        // Search query
        if (topicSearchQuery.trim()) {
          const q = topicSearchQuery.toLowerCase();
          const match =
            (asg.topicTitle || '').toLowerCase().includes(q) ||
            (asg.subTheme || '').toLowerCase().includes(q) ||
            (asg.theme || '').toLowerCase().includes(q) ||
            (asg.suggestedActivities || '').toLowerCase().includes(q) ||
            (asg.notes || '').toLowerCase().includes(q) ||
            (asg.cdcName || '').toLowerCase().includes(q) ||
            (asg.barangay || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      });
  }, [myAssignedTopics, localTeacherModules, topicStatusFilter, topicLevelFilter, topicQuarterFilter, topicSearchQuery]);

  // Aggregate counts for assigned topics
  const assignedCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let expired = 0;

    myAssignedTopics.forEach((asg) => {
      const isPast = Boolean(asg.deadline && new Date(asg.deadline + 'T23:59:59') < new Date());
      const hasUpload = localTeacherModules.some(
        (m) =>
          m.assignment_id === asg.id ||
          (asg.topicTitle && m.sub_theme && m.sub_theme.toLowerCase() === asg.topicTitle.toLowerCase()) ||
          (asg.topicTitle && m.title && m.title.toLowerCase().includes(asg.topicTitle.toLowerCase()))
      );
      const isComp = asg.status === 'Completed' || hasUpload;

      if (isComp) completed++;
      else if (isPast) expired++;
      else pending++;
    });

    return { total: myAssignedTopics.length, pending, completed, expired };
  }, [myAssignedTopics, localTeacherModules]);

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

      {/* ASSIGNED TOPICS & TASKS (MSWD CURRICULUM ASSIGNMENTS WITH DEADLINE) */}
      {(activeTab === 'assigned_topics' || activeTab === 'curriculum') && (
        <div className="space-y-6">
          {/* Top Header & Status Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                <span>📋</span>
                <span>Official DepEd ECCD • MSWDO Manolo Fortich Assigned Topics</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 m-0 mt-2 tracking-tight">
                Assigned Topics &amp; Tasks
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Official curriculum topics and activities assigned by MSWDO Manolo Fortich with required deadlines.
                Review your tasks, decide when to complete them, and upload your activities or files before the deadline closes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                <span>🏫</span>
                <span>{myCdcName || 'Manolo Fortich Day Care Center'}</span>
              </span>
              {myBarangay && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  Brgy. {myBarangay}
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Assigned Topics
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {assignedCounts.total}
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">MSWD Deployed</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs">
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Open &amp; Pending
              </div>
              <div className="text-2xl font-bold text-amber-800 mt-1">
                {assignedCounts.pending}
              </div>
              <div className="text-[10.5px] text-amber-600 mt-0.5">Awaiting teacher upload</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Completed &amp; Submitted
              </div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {assignedCounts.completed}
              </div>
              <div className="text-[10.5px] text-emerald-600 mt-0.5">Verified / Live</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs">
              <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                Past Deadline (Locked)
              </div>
              <div className="text-2xl font-bold text-rose-800 mt-1">
                {assignedCounts.expired}
              </div>
              <div className="text-[10.5px] text-rose-600 mt-0.5">Upload closed</div>
            </div>
          </div>

          {/* Controls: Easy Navigation Status Tabs, Level & Quarter Selector, Search */}
          <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs space-y-3.5">
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setTopicStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  topicStatusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>All Topics</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${topicStatusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {assignedCounts.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTopicStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  topicStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <span>⏳ Open / Pending</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${topicStatusFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'}`}>
                  {assignedCounts.pending}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTopicStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  topicStatusFilter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                <span>✅ Completed</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${topicStatusFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
                  {assignedCounts.completed}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTopicStatusFilter('expired')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  topicStatusFilter === 'expired'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-900 hover:bg-rose-100'
                }`}
              >
                <span>⚠️ Past Deadline</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${topicStatusFilter === 'expired' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'}`}>
                  {assignedCounts.expired}
                </span>
              </button>
            </div>

            {/* Secondary Toolbar: Level, Quarter, Search */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {/* Level Selector */}
              <div>
                <select
                  value={topicLevelFilter}
                  onChange={(e) => setTopicLevelFilter(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="all">All Curriculum Levels</option>
                  <option value="Pre-K1">PRE-K 1 (3.11 years old)</option>
                  <option value="Pre-K2">PRE-K 2 (4.11 years old)</option>
                </select>
              </div>

              {/* Quarter Selector */}
              <div>
                <select
                  value={topicQuarterFilter}
                  onChange={(e) => setTopicQuarterFilter(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="all">All Quarters (Q1 - Q4)</option>
                  <option value="1">Quarter 1</option>
                  <option value="2">Quarter 2</option>
                  <option value="3">Quarter 3</option>
                  <option value="4">Quarter 4</option>
                </select>
              </div>

              {/* Instant Search Bar */}
              <div className="sm:col-span-2 relative">
                <IconSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search topic title, week, competencies, or notes..."
                  value={topicSearchQuery}
                  onChange={(e) => setTopicSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Assigned Topics Cards List */}
          <div className="space-y-4">
            {filteredAssignedTopics.map((item) => {
              const weekLabel = item.week || (Array.isArray(item.weeks) ? item.weeks.join(', ') : 'Week 1');
              const quarterNum = item.quarter || (item.quarters && item.quarters[0]) || 1;

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.isCompleted
                      ? 'bg-[#F9FCFA] border-emerald-300 shadow-xs'
                      : item.isPastDeadline
                      ? 'bg-[#FFF8F8] border-rose-300 shadow-xs'
                      : 'bg-white border-card-border hover:border-accent shadow-xs'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Topic Information */}
                    <div className="space-y-2 flex-1">
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                            item.level === 'Pre-K1'
                              ? 'bg-[#DCEBDD] text-[#2E6B38]'
                              : 'bg-[#E0EFFE] text-[#1E5B94]'
                          }`}
                        >
                          {item.level || 'Pre-K1'}
                        </span>

                        <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2.5 py-0.5 rounded-md">
                          Quarter {quarterNum} • {weekLabel}
                        </span>

                        {item.isCompleted ? (
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <span>✓</span>
                            <span>Completed &amp; Submitted</span>
                          </span>
                        ) : item.isPastDeadline ? (
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Deadline Passed (Locked)</span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <span>⏳</span>
                            <span>Open for Upload</span>
                          </span>
                        )}
                      </div>

                      {/* Topic Title */}
                      <h4 className="text-lg font-bold text-slate-900 m-0">
                        {item.topicTitle || item.subTheme || 'Prescribed ECCD Topic'}
                      </h4>

                      {/* Theme & Competency Focus */}
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-amber-900">
                          Focus: {item.subTheme || item.topicTitle}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          Theme: {item.theme || 'TELL ME ABOUT YOURSELF'}
                        </span>
                      </div>

                      {/* CDC and Barangay info */}
                      <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">🏫 {item.cdcName}</span>
                        <span>•</span>
                        <span>Brgy. {item.barangay}</span>
                        {item.assignedDate && (
                          <>
                            <span>•</span>
                            <span>Assigned: {item.assignedDate}</span>
                          </>
                        )}
                      </div>

                      {/* Suggested DepEd ECCD Activity Instructions */}
                      {(item.suggestedActivities || item.suggestedContent) && (
                        <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#EBE1CF] text-xs text-[#524430] leading-relaxed mt-2">
                          <span className="font-bold block text-slate-800 mb-0.5">
                            DepEd ECCD Suggested Content &amp; Activities:
                          </span>
                          {item.suggestedActivities || item.suggestedContent}
                        </div>
                      )}

                      {/* Admin Notes */}
                      {item.notes && (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                          <strong>Note from MSWDO Admin:</strong> {item.notes}
                        </div>
                      )}
                    </div>

                    {/* Right: Deadline Indicator & Action Button */}
                    <div className="flex flex-col items-start md:items-end justify-between gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      {/* Deadline Display */}
                      <div className="text-left md:text-right">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Submission Deadline
                        </div>
                        {item.deadline ? (
                          <div className="mt-1">
                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                                item.isCompleted
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : item.isPastDeadline
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                  : 'bg-amber-50 text-amber-900 border border-amber-300'
                              }`}
                            >
                              <span>📅</span>
                              <span>{item.deadline}</span>
                            </span>
                            <div className="text-[10.5px] mt-1 font-semibold">
                              {item.isCompleted ? (
                                <span className="text-emerald-700">✓ Submitted to MSWDO</span>
                              ) : item.isPastDeadline ? (
                                <span className="text-rose-600">⚠️ Deadline has expired</span>
                              ) : (
                                <span className="text-amber-700">⏳ You decide when to upload</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic mt-1">
                            Flexible schedule (No hard deadline)
                          </div>
                        )}
                      </div>

                      {/* Action Button: Locked if deadline past! */}
                      <div>
                        {item.isPastDeadline && !item.isCompleted ? (
                          <div className="flex flex-col items-start md:items-end gap-1">
                            <button
                              type="button"
                              disabled
                              className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-400 font-bold text-xs cursor-not-allowed flex items-center gap-1.5 opacity-60 shadow-none"
                              title="The deadline has already passed. Uploading is disabled for this assignment."
                            >
                              <span>🔒 Upload Closed (Deadline Passed)</span>
                            </button>
                            <span className="text-[10px] text-rose-600 font-bold">
                              Submission window expired on {item.deadline}
                            </span>
                          </div>
                        ) : item.isCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1">
                              <span>✓ Submitted</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('upload')}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                            >
                              View in Uploads →
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenUploadForAssignedTopic(item)}
                            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>📤 Upload Activity or File →</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAssignedTopics.length === 0 && (
              <div className="bg-white p-10 rounded-2xl border border-card-border text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-2xl flex items-center justify-center mx-auto">
                  📋
                </div>
                <div className="font-fraunces font-bold text-slate-800 text-base">
                  {myAssignedTopics.length === 0 ? 'No Topics or Tasks Assigned by MSWD Yet' : 'No Matching Assigned Topics Found'}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {myAssignedTopics.length === 0
                    ? 'When MSWDO Manolo Fortich deploys a curriculum topic, lesson plan requirement, or submission task with a deadline for you or your Day Care Center, it will automatically appear here in real time.'
                    : 'Try adjusting your status filter or search query.'}
                </p>
                {myAssignedTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopicStatusFilter('all');
                      setTopicLevelFilter('all');
                      setTopicQuarterFilter('all');
                      setTopicSearchQuery('');
                    }}
                    className="text-xs text-accent font-bold hover:underline cursor-pointer pt-1 inline-block"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
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
                      <th className={th}>ACTIONS</th>
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
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => setActiveTab('child_development')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>🌱</span>
                            <span>Assess ECCD</span>
                          </button>
                        </td>
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

      {/* CHILD DEVELOPMENT MONITORING */}
      {activeTab === 'child_development' && (
        <TeacherChildDevelopment
          teacherProfile={profile}
          teacherBarangay={myBarangay}
          cdcName={myCdcName}
          learners={myLearners}
          onRefreshLearners={loadMyLearners}
        />
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <IconUpload className="w-4 h-4" />
              <span>Upload New Material</span>
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
                        {m.file_name && (
                          <div className="text-[11px] text-blue-700 font-medium mt-1 flex items-center gap-1">
                            <span>📎</span>
                            <span className="font-semibold">{m.file_name}</span>
                            {m.file_size && <span className="text-slate-400">({m.file_size})</span>}
                          </div>
                        )}
                        {m.content_text && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {m.content_text}
                          </div>
                        )}
                        {m.mswd_comments && (
                          <div className="mt-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                            <span className="font-bold">💬 MSWD Review Note:</span> {m.mswd_comments}
                          </div>
                        )}
                        {m.revision_notes && (
                          <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900">
                            <span className="font-bold">⚠️ MSWD Revision Note:</span> {m.revision_notes}
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
                          m.status === 'Approved' || m.status === 'approved' || m.verified_by_mswd
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : m.status === 'Needs Revision'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {m.status === 'Approved' || m.status === 'approved' || m.verified_by_mswd
                            ? 'Approved by MSWD ✓'
                            : m.status === 'Needs Revision'
                            ? 'Needs Revision'
                            : 'Pending MSWD Review'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.content_url && (
                            <a
                              href={m.content_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={m.file_name || undefined}
                              className="px-2.5 py-1 rounded text-emerald-700 hover:bg-emerald-50 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="View / Download Material File"
                            >
                              <span>👁️</span>
                              <span>View File</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMaterial(m)}
                            className="px-2.5 py-1 rounded text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUploadedMaterials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <div className="text-2xl mb-1">📂</div>
                        <div className="font-semibold text-xs">No uploaded materials match your filter</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Click "Upload New Material" or browse the Curriculum Guide to create one.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simple Upload Modal with Drag & Drop and Choose File */}
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
                  {/* Assigned Topic Fulfillment Banner */}
                  {activeAssignmentId && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between">
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>🎯 Fulfilling Admin-Assigned Topic</span>
                        </div>
                        <div className="text-[11px] text-amber-800 mt-0.5">
                          {activeAssignmentDeadline ? `Official Deadline: ${activeAssignmentDeadline}` : 'No deadline set'} • Upon upload, this assignment will be marked as Completed.
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-200/70 text-amber-950">
                        Assigned by MSWDO
                      </span>
                    </div>
                  )}

                  {/* PROMINENT CHOOSE FILE & DRAG FILE DROPZONE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>📎</span>
                        <span>Upload File (Choose File &amp; Drag File)</span>
                      </label>
                      {uploadFileName && (
                        <button
                          type="button"
                          onClick={handleRemoveSelectedFile}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                        >
                          ✕ Remove File
                        </button>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.zip"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelected(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {!uploadFileName ? (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(true);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleFileSelected(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                          isDraggingFile
                            ? 'border-accent bg-amber-50/70 scale-[1.01]'
                            : 'border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl text-accent">
                          {isDraggingFile ? '📥' : '☁️'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs sm:text-sm m-0">
                            Drag &amp; drop file here, or{' '}
                            <span className="text-accent underline font-extrabold">choose file</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 mb-0">
                            PDF, Word, Excel, PowerPoint, Images (PNG/JPG), MP4 Video, Worksheets
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="mt-1 px-4 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>📁</span>
                          <span>Choose File</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {uploadFilePreview && ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(uploadFileType) ? (
                            <img
                              src={uploadFilePreview}
                              alt="Preview"
                              className="w-12 h-12 object-cover rounded-lg border border-emerald-200 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                              {uploadFileType || 'FILE'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate max-w-xs">
                              {uploadFileName}
                            </div>
                            <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-2 mt-0.5">
                              <span>{uploadFileSize}</span>
                              <span>•</span>
                              <span className="font-bold text-emerald-700">✓ Ready to upload</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveSelectedFile}
                            className="p-1 rounded-md hover:bg-rose-100 text-rose-600 cursor-pointer"
                            title="Remove file"
                          >
                            <IconClose className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

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
                      4. Post Format / Material Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { type: 'activity', label: '✏️ Activity', desc: 'Worksheet / task' },
                        { type: 'file', label: '📁 File / PDF', desc: 'Document / guide' },
                        { type: 'video', label: '🎬 Video', desc: 'Video demonstration' },
                        { type: 'image', label: '🖼️ Picture', desc: 'Visual card / craft' },
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
                      6. Resource / Video / Worksheet Link <span className="text-slate-400 font-normal">(optional if file is attached)</span>
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

      {/* MY PROFILE — Simplified & Volunteer-Friendly for Child Development Workers */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Educator Identity Header Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF5EE] border border-accent/20 text-accent flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
                👩‍🏫
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 m-0">
                    {myFullName || profile?.full_name || 'Volunteer Teacher / Day Care Worker'}
                  </h3>
                  <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-[#DCEBDD] text-[#2E6B38] border border-emerald-300">
                    Child Development Worker (CDW)
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  <span>Community Volunteer Educator • Municipality of Manolo Fortich</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2.5 py-0.5 rounded-md">
                    <IconBuilding className="w-3 h-3 text-amber-700" />
                    <span>{myCdcName || 'Child Development Center'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    <IconPin className="w-3 h-3 text-slate-500" />
                    <span>Brgy. {myBarangay || 'Manolo Fortich'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 max-w-sm">
              <span className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                <span>🌸</span>
                <span>Pahinumdom para sa Magtutudlo</span>
              </span>
              Kini nga profile dali ug yano ra gamiton. Siguroa lang nga insakto ang imong pangalan, numero sa selpon, ug ang sentro nga imong gisilbihan aron dali ka makontak sa MSWDO ug sa mga ginikanan.
            </div>
          </div>

          {/* Feedback Status Alert */}
          {profileMsg.text && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn ${
                profileMsg.type === 'error'
                  ? 'bg-rose-50 border border-rose-300 text-rose-800'
                  : 'bg-[#DCEBDD] border border-emerald-300 text-[#2E6B38]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{profileMsg.type === 'error' ? '⚠️' : '✅'}</span>
                <span>{profileMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileMsg({ text: '', type: '' })}
                className="text-slate-500 hover:text-slate-900 font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Clean & Essential Profile Form */}
          <form onSubmit={handleSaveTeacherProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Personal & Contact Information */}
              <div className="bg-white p-5 rounded-2xl border border-card-border shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-fraunces text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                    <span>👤</span>
                    <span>1. Imong Impormasyon (Personal Details)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Kompleto nga pangalan ug contact number para sa komunikasyon.
                  </p>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Kompleto nga Pangalan (Full Legal Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={myFullName}
                      onChange={(e) => setMyFullName(e.target.value)}
                      placeholder="e.g. Miche Tamayon Ladao"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#FFFDF8] font-bold text-slate-800 outline-none focus:border-accent text-sm"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Kini ang makita sa MSWDO Admin ug sa records sa imong mga estudyante.
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800">
                        Numero sa Selpon (Mobile / Phone Number) <span className="text-red-500">*</span>
                      </label>
                      {myContact && (
                        <button
                          type="button"
                          onClick={() => setMyContact('')}
                          className="text-[10.5px] text-rose-600 hover:underline cursor-pointer"
                        >
                          ✕ Hawani
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={myContact}
                      onChange={(e) => setMyContact(e.target.value)}
                      placeholder="e.g. 0917-889-2345"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#FFFDF8] font-semibold text-slate-800 outline-none focus:border-accent font-mono text-sm"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Importante kini aron makatawag o makatext ang MSWDO ug mga ginikanan.
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Email Address (Account Login)
                    </label>
                    <input
                      type="email"
                      value={myEmail}
                      onChange={(e) => setMyEmail(e.target.value)}
                      placeholder="e.g. teacher@earlylearn.ph"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-700 outline-none focus:border-accent"
                    />
                    <span className="text-[10.5px] text-slate-400 mt-1 block">
                      Gigamit para sa pagsulod sa EarlyLearn Hub (Username/Email).
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Day Care Center & Barangay Assignment */}
              <div className="bg-white p-5 rounded-2xl border border-card-border shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-fraunces text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                    <span>🏫</span>
                    <span>2. Sentro ug Barangay (Assigned Day Care)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ang barangay ug Child Development Center diin ikaw nagtudlo.
                  </p>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Barangay nga Gisilbihan (Assigned Barangay) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={myBarangay}
                      onChange={(e) => {
                        const newBrgy = e.target.value;
                        setMyBarangay(newBrgy);
                        const matchingCdcs = realCdcsList.filter(
                          (c) => c.barangay?.toLowerCase() === newBrgy?.toLowerCase()
                        );
                        if (matchingCdcs.length > 0) {
                          setMyCdcName(matchingCdcs[0].name);
                          setMyCdcId(matchingCdcs[0].id);
                          setCustomCdcMode(false);
                        } else if (newBrgy) {
                          setMyCdcName(`${newBrgy} Child Development Center`);
                          setMyCdcId(null);
                        }
                      }}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#FFFDF8] font-bold text-slate-800 outline-none focus:border-accent cursor-pointer text-sm"
                    >
                      <option value="">-- Pilia ang Imong Barangay (22 Barangays) --</option>
                      {barangays.map((b) => (
                        <option key={b} value={b}>
                          Barangay {b}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Pilia ang barangay sa Manolo Fortich diin nahimutang ang imong sentro.
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800">
                        Ngalan sa Sentro / CDC (Day Care Center) <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setCustomCdcMode(!customCdcMode)}
                        className="text-[10.5px] text-accent font-bold hover:underline cursor-pointer"
                      >
                        {customCdcMode ? '← Pilia sa Listahan' : '➕ Isulat ang Sentro'}
                      </button>
                    </div>

                    {!customCdcMode ? (
                      <select
                        value={myCdcName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMyCdcName(val);
                          const found = realCdcsList.find((c) => c.name === val);
                          if (found) setMyCdcId(found.id);
                        }}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#FFFDF8] font-bold text-slate-800 outline-none focus:border-accent cursor-pointer text-sm"
                      >
                        <option value="">-- Pilia ang Child Development Center --</option>
                        {realCdcsList
                          .filter(
                            (c) => !myBarangay || c.barangay?.toLowerCase() === myBarangay?.toLowerCase()
                          )
                          .map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        {myBarangay && (
                          <optgroup label="Ubang Sentro sa Manolo Fortich">
                            {realCdcsList
                              .filter(
                                (c) => c.barangay?.toLowerCase() !== myBarangay?.toLowerCase()
                              )
                              .map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name} (Brgy. {c.barangay})
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. SitIo Impahanong Child Development Center"
                        value={customCdcInput}
                        onChange={(e) => setCustomCdcInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#FFFDF8] font-bold text-slate-800 outline-none focus:border-accent text-sm"
                      />
                    )}
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Ang mga bata nga narehistro sa kini nga sentro maoy mogawas sa &quot;My Learners&quot;.
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Iskedyul sa Klase o Pahinumdom (Schedule / Short Note)
                    </label>
                    <textarea
                      rows={2}
                      value={myBio}
                      onChange={(e) => setMyBio(e.target.value)}
                      placeholder="e.g. Lunes hangtod Biyernes: Morning Session 8:00 AM - 10:30 AM"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-[#FFFDF8] font-medium text-slate-800 outline-none focus:border-accent resize-none text-xs leading-relaxed"
                    />
                    <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                      Opsyonal: Isulat kon unsa nga oras o adlaw ang inyong klase sa day care.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reassuring Summary Card: What MSWDO Admin Sees */}
            <div className="bg-[#FFFDF9] p-5 rounded-2xl border border-card-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Opisyal nga Impormasyon nga Makita sa MSWDO Admin</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                  ✓ Naka-konekta sa Sistema
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 p-4 rounded-xl bg-white border border-[#EBE1CF] text-xs">
                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase">👤 Kompleto nga Pangalan:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {myFullName || '(Wala pa mabutang)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase">📱 Numero sa Selpon:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {myContact || '(Wala pa mabutang)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase">📍 Barangay:</span>
                  <span className="font-bold text-slate-800">
                    {myBarangay ? `Brgy. ${myBarangay}` : '(Wala pa mapili)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase">🏫 Day Care Center (CDC):</span>
                  <span className="font-bold text-emerald-900">
                    {customCdcMode && customCdcInput.trim()
                      ? customCdcInput.trim()
                      : myCdcName || '(Wala pa mapili)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase">📧 Account Email:</span>
                  <span className="font-medium text-slate-700">
                    {myEmail || profile?.email || '(Default)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase">🕒 Iskedyul / Note:</span>
                  <span className="font-medium text-slate-700 truncate block">
                    {myBio || 'Regular Morning Session'}
                  </span>
                </div>
              </div>
            </div>

            {/* Simple Save & Reset Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={loadMyProfile}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                <span>I-balik sa Na-save (Reset)</span>
              </button>

              <button
                type="submit"
                disabled={profileSaving}
                className="px-6 py-3 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.01]"
              >
                <span>💾</span>
                <span>
                  {profileSaving ? 'Ginasave pa ang impormasyon...' : 'I-save ang Akong Impormasyon (Save Profile)'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}