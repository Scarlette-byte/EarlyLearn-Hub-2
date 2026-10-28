import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import DashboardLayout from '../components/DashboardLayout.jsx';
import {
  preK1Curriculum,
  preK2Curriculum,
  getCleanCurriculumAssignments,
  extractMswdTopicChoices,
  realTeachersList,
  realCdcsList,
} from '../lib/curriculumData.js';
import { getLearnersForTeacher, getCdcForBarangay } from '../lib/learnersService.js';
import TeacherChildDevelopment from '../components/teacher/TeacherChildDevelopment.jsx';
import TeacherUploadModal from '../components/teacher/TeacherUploadModal.jsx';
import {
  IconSearch,
  IconMaterials,
  IconClose,
  IconBuilding,
  IconPin,
  IconRefresh,
  IconUpload,
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
  delBtn,
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
  const [uploadWeek, setUploadWeek] = useState('');
  const [uploadTheme, setUploadTheme] = useState('');
  const [uploadSubTheme, setUploadSubTheme] = useState('');
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
  const [uploadedFilterStatus, setUploadedFilterStatus] = useState('all'); // 'all' | 'pending' | 'approved' | 'posted' | 'rejected'
  const [uploadedFilterLevel, setUploadedFilterLevel] = useState('all');
  const [uploadedFilterQuarter, setUploadedFilterQuarter] = useState('all');
  const [uploadedFilterType, setUploadedFilterType] = useState('all');
  const [uploadedSearch, setUploadedSearch] = useState('');

  // Post Approved Activity to Student Dashboard Modal state
  const [postingMaterial, setPostingMaterial] = useState(null);
  const [selectedTargetStudentId, setSelectedTargetStudentId] = useState('all');
  const [postModalMsg, setPostModalMsg] = useState({ text: '', type: '' });

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

  // Filter assignments targeted to this logged-in teacher / CDC / Barangay (Real MSWDO deployments only)
  const myAssignedTopics = useMemo(() => {
    const teacherName = (myFullName || profile?.full_name || '').toLowerCase();
    const cleanName = teacherName.replace(/\s*\(.*?\)\s*/g, '').trim();
    const brgy = (myBarangay || profile?.barangay || '').toLowerCase();
    const cdc = (myCdcName || profile?.cdc_name || '').toLowerCase();

    return assignments.filter((a) => {
      if (
        !a ||
        !a.topicTitle ||
        a.topicTitle === 'Prescribed ECCD Topic' ||
        a.assignedDate === '2026-10-17' ||
        a.isDummy ||
        /^asg-0[1-9]|^asg-1[0-5]|^asg-07-.*|^asg-test-.*$/.test(a.id)
      ) {
        return false;
      }

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

  // Choices for "3. ECCD Week & Theme" based ONLY on what MSWD assigned to this teacher
  const mswdTopicChoices = useMemo(() => {
    return extractMswdTopicChoices(myAssignedTopics);
  }, [myAssignedTopics]);

  // --- Load categories into the dropdown ---
  const loadCategoryOptions = useCallback(async () => {
    const { data } = await supabase.from('categories').select('id, name, icon').order('name');
    setCategoryOptions(data || []);
    if (data && data.length && !matCategory) setMatCategory(data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Load my uploaded materials from Supabase ---
  const loadMyMaterials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, title, type, age_range, status, content_url, content_text, created_at, categories(name)')
        .eq('created_by', currentUserId)
        .order('created_at', { ascending: false });
      if (!error && data) setMyMaterials(data);
    } catch {
      // ignore
    }
  }, [currentUserId]);

  // Real-time Supabase sync for materials status (notified when Admin approves/rejects)
  useEffect(() => {
    loadMyMaterials();

    let channel;
    try {
      channel = supabase
        .channel('teacher-dashboard-materials-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
          loadMyMaterials();
        })
        .subscribe();
    } catch {}

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadMyMaterials]);

  // Combined uploaded materials list (merges Supabase materials + localTeacherModules for MSWD status & student post status)
  const combinedUploadedMaterials = useMemo(() => {
    const localMap = new Map();
    (localTeacherModules || []).forEach((m) => {
      if (m && m.id) localMap.set(m.id, m);
    });

    const teacherMods = (localTeacherModules || [])
      .filter((m) => {
        const tName = (myFullName || profile?.full_name || '').toLowerCase().trim();
        if (m.teacher_id && m.teacher_id === currentUserId) return true;
        if (tName && m.teacher_name && m.teacher_name.toLowerCase().includes(tName)) return true;
        return !m.teacher_id || m.teacher_id === currentUserId;
      })
      .map((m) => {
        const isRejected = m.status === 'Rejected' || m.status === 'Needs Revision' || m.status === 'rejected' || m.status === 'needs_revision';
        const isApproved = !isRejected && (m.status === 'Approved' || m.status === 'approved' || m.verified_by_mswd === true);
        return {
          id: m.id,
          assignment_id: m.assignment_id || null,
          title: m.title,
          level: m.level || 'Pre-K1',
          quarter: m.quarter || 1,
          week: m.week || 'Week 1',
          theme: m.theme || '',
          sub_theme: m.sub_theme || '',
          type: m.module_type?.toLowerCase().includes('video')
            ? 'video'
            : m.module_type?.toLowerCase().includes('worksheet')
            ? 'activity'
            : m.type || 'activity',
          formatLabel: m.module_type || 'Activity Worksheet',
          age_range: m.level === 'Pre-K1' ? '3.11' : '4.11',
          status: isRejected ? 'Rejected' : isApproved ? 'Approved' : 'Pending Review',
          verified_by_mswd: isApproved,
          posted_to_students: Boolean(m.posted_to_students),
          target_student_id: m.target_student_id || null,
          target_student_name: m.target_student_name || null,
          posted_at: m.posted_at || null,
          mswd_comments: m.mswd_comments || '',
          revision_notes: m.revision_notes || '',
          created_at: m.upload_date,
          content_text: m.description,
          file_name: m.file_name || null,
          file_size: m.file_size || null,
          file_type: m.file_type || null,
          content_url: m.content_url || null,
          isLocal: true,
        };
      });

    const sbMats = (myMaterials || []).map((m) => {
      let meta = {};
      let cleanDescription = m.content_text || '';
      if (m.content_text && m.content_text.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(m.content_text);
          if (parsed && parsed.__metadata) {
            meta = parsed;
            cleanDescription = parsed.description || '';
          }
        } catch {}
      }
      const localMatch = localMap.get(m.id);
      const tagMatch = m.title?.match(/\[(Pre-K1|Pre-K2)?\s*Q?(\d+)?\s*(W[^\s\]]+|Week\s*[\d&]+)?\]/i);
      const parsedLevel = tagMatch?.[1] || (m.age_range?.includes('3') ? 'Pre-K1' : 'Pre-K2');
      const parsedQuarter = tagMatch?.[2] ? parseInt(tagMatch[2], 10) : 1;
      const parsedWeek = tagMatch?.[3]
        ? tagMatch[3].startsWith('W') && !tagMatch[3].startsWith('Week')
          ? `Week ${tagMatch[3].slice(1)}`
          : tagMatch[3]
        : 'Week 1';

      const isRejected =
        m.status === 'needs_revision' ||
        m.status === 'rejected' ||
        localMatch?.status === 'Rejected' ||
        localMatch?.status === 'Needs Revision';
      const isApproved =
        !isRejected &&
        (m.status === 'approved' ||
          localMatch?.status === 'Approved' ||
          localMatch?.verified_by_mswd === true);

      return {
        id: m.id,
        assignment_id: meta.assignment_id || localMatch?.assignment_id || null,
        title: m.title,
        level: meta.level || localMatch?.level || parsedLevel,
        quarter: meta.quarter || localMatch?.quarter || parsedQuarter,
        week: meta.week || localMatch?.week || parsedWeek,
        theme: meta.theme || localMatch?.theme || m.categories?.name || 'Curriculum Lesson',
        sub_theme: meta.sub_theme || localMatch?.sub_theme || '',
        type: m.type,
        formatLabel:
          m.type === 'activity'
            ? 'Activity Worksheet / PDF'
            : m.type === 'video'
            ? 'Video Lesson'
            : m.type === 'image'
            ? 'Visual Worksheet'
            : 'Reading Story',
        age_range: m.age_range,
        status: isRejected ? 'Rejected' : isApproved ? 'Approved' : 'Pending Review',
        verified_by_mswd: isApproved,
        posted_to_students: Boolean(localMatch?.posted_to_students || meta.posted_to_students),
        target_student_id: localMatch?.target_student_id || meta.target_student_id || null,
        target_student_name: localMatch?.target_student_name || meta.target_student_name || null,
        posted_at: localMatch?.posted_at || meta.posted_at || null,
        mswd_comments: localMatch?.mswd_comments || meta.mswd_comments || '',
        revision_notes: localMatch?.revision_notes || meta.revision_notes || '',
        created_at: m.created_at
          ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          : 'Recently',
        content_text: cleanDescription,
        file_name: m.content_url?.startsWith('data:application/pdf')
          ? 'Worksheet File (PDF)'
          : m.content_url?.startsWith('data:')
          ? 'Attached Learning Document'
          : m.file_name || localMatch?.file_name || null,
        file_size: m.file_size || localMatch?.file_size || null,
        file_type:
          m.file_type ||
          localMatch?.file_type ||
          (m.content_url?.startsWith('data:application/pdf') ? 'PDF' : m.type?.toUpperCase() || 'FILE'),
        content_url: m.content_url || localMatch?.content_url || null,
        raw_meta: meta,
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
  }, [myMaterials, localTeacherModules, currentUserId, myFullName, profile]);

  // Filtered uploaded materials
  const filteredUploadedMaterials = useMemo(() => {
    return combinedUploadedMaterials.filter((m) => {
      if (uploadedFilterStatus === 'pending' && m.status !== 'Pending Review') return false;
      if (uploadedFilterStatus === 'approved' && m.status !== 'Approved') return false;
      if (uploadedFilterStatus === 'posted' && !m.posted_to_students) return false;
      if (uploadedFilterStatus === 'rejected' && m.status !== 'Rejected') return false;

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
  }, [
    combinedUploadedMaterials,
    uploadedFilterStatus,
    uploadedFilterLevel,
    uploadedFilterQuarter,
    uploadedFilterType,
    uploadedSearch,
  ]);

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
      const prefix = uploadWeek ? `[${uploadCurriculumLevel} Q${uploadQuarter} ${uploadWeek}] ` : `[${uploadCurriculumLevel} Q${uploadQuarter}] `;
      setUploadTitle(`${prefix}${cleanName}`);
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

  // Select an MSWD-assigned topic choice inside the Upload Modal
  const handleSelectMswdTopicChoice = (choice) => {
    if (!choice) return;
    setActiveAssignmentId(choice.assignmentId || null);
    setActiveAssignmentDeadline(choice.deadline || null);
    setUploadCurriculumLevel(choice.level || 'PRE-K1');
    setUploadQuarter(choice.quarter || 1);
    setUploadWeek(choice.week || 'Week 1');
    setUploadTheme(choice.theme || '');
    setUploadSubTheme(choice.subTheme || '');
    setUploadTitle(`[${choice.level || 'PRE-K1'} Q${choice.quarter || 1} ${choice.week || 'Week 1'}] ${choice.subTheme}`);
    if (choice.suggestedActivities) {
      setUploadDescription(choice.suggestedActivities);
    }
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

    const firstTopicEntry = Array.isArray(asg.assignedTopics) && asg.assignedTopics.length > 0 ? asg.assignedTopics[0] : null;
    const resolvedWeek = firstTopicEntry?.week || asg.week || (Array.isArray(asg.weeks) ? asg.weeks[0] : 'Week 1');
    setUploadWeek(resolvedWeek);

    setUploadTheme(firstTopicEntry?.theme || asg.theme || '');
    const resolvedTopic = firstTopicEntry?.subTheme || asg.subTheme || asg.topicTitle || 'MSWD Assigned Topic';
    setUploadSubTheme(resolvedTopic);
    setUploadTitle(`[${resolvedLevel} Q${resolvedQuarter} ${resolvedWeek}] ${resolvedTopic}`);
    setUploadDescription(firstTopicEntry?.suggestedActivities || asg.suggestedActivities || asg.suggestedContent || '');
    setUploadType('activity');
    setUploadUrl('');
    setUploadMsg({ text: '', type: '' });
    setIsUploadModalOpen(true);
  };

  // Open clean new upload modal — strictly uses MSWD-assigned topic choices (never curriculum guide defaults)
  const handleOpenNewUpload = () => {
    handleRemoveSelectedFile();
    const firstChoice = mswdTopicChoices[0] || null;
    if (firstChoice) {
      setActiveAssignmentId(firstChoice.assignmentId || null);
      setActiveAssignmentDeadline(firstChoice.deadline || null);
      setUploadCurriculumLevel(firstChoice.level);
      setUploadQuarter(firstChoice.quarter);
      setUploadWeek(firstChoice.week);
      setUploadTheme(firstChoice.theme || '');
      setUploadSubTheme(firstChoice.subTheme);
      setUploadTitle(`[${firstChoice.level} Q${firstChoice.quarter} ${firstChoice.week}] ${firstChoice.subTheme}`);
      setUploadDescription(firstChoice.suggestedActivities || '');
    } else {
      setActiveAssignmentId(null);
      setActiveAssignmentDeadline(null);
      setUploadCurriculumLevel('PRE-K1');
      setUploadQuarter(1);
      setUploadWeek('');
      setUploadTheme('');
      setUploadSubTheme('');
      setUploadTitle('');
      setUploadDescription('');
    }
    setUploadType('activity');
    setUploadUrl('');
    setUploadMsg({ text: '', type: '' });
    setIsUploadModalOpen(true);
  };

  // Modal Level change handler — filters only from MSWD assigned topics
  const handleModalLevelChange = (newLevel) => {
    setUploadCurriculumLevel(newLevel);
    const matching =
      mswdTopicChoices.find((c) => c.level === newLevel && Number(c.quarter) === Number(uploadQuarter)) ||
      mswdTopicChoices.find((c) => c.level === newLevel) ||
      mswdTopicChoices[0] ||
      null;

    if (matching) {
      setActiveAssignmentId(matching.assignmentId || null);
      setActiveAssignmentDeadline(matching.deadline || null);
      setUploadQuarter(matching.quarter);
      setUploadWeek(matching.week);
      setUploadTheme(matching.theme || '');
      setUploadSubTheme(matching.subTheme);
      setUploadTitle(`[${matching.level} Q${matching.quarter} ${matching.week}] ${matching.subTheme}`);
    } else {
      setUploadWeek('');
      setUploadTheme('');
      setUploadSubTheme('');
      setUploadTitle('');
    }
  };

  // Modal Quarter change handler — filters only from MSWD assigned topics
  const handleModalQuarterChange = (newQ) => {
    setUploadQuarter(newQ);
    const matching =
      mswdTopicChoices.find((c) => c.level === uploadCurriculumLevel && Number(c.quarter) === Number(newQ)) ||
      mswdTopicChoices.find((c) => Number(c.quarter) === Number(newQ)) ||
      mswdTopicChoices[0] ||
      null;

    if (matching) {
      setActiveAssignmentId(matching.assignmentId || null);
      setActiveAssignmentDeadline(matching.deadline || null);
      setUploadWeek(matching.week);
      setUploadTheme(matching.theme || '');
      setUploadSubTheme(matching.subTheme);
      setUploadTitle(`[${uploadCurriculumLevel} Q${newQ} ${matching.week}] ${matching.subTheme}`);
    } else {
      setUploadWeek('');
      setUploadTheme('');
      setUploadSubTheme('');
      setUploadTitle('');
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

    // 1. Insert to Supabase materials (with status 'pending' awaiting MSWD Admin approval)
    const metadataPayload = {
      __metadata: true,
      assignment_id: activeAssignmentId || null,
      description: uploadDescription.trim() || '',
      teacher_name: profile?.full_name || 'Teacher',
      cdc_name: myCdcName || profile?.cdc_name || 'Manolo Fortich CDC',
      barangay: myBarangay || profile?.barangay || 'Manolo Fortich',
      level: uploadCurriculumLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2',
      quarter: parseInt(uploadQuarter, 10),
      week: uploadWeek || 'Week 1',
      sub_theme: uploadSubTheme || '',
      theme: uploadTheme || '',
      module_type:
        uploadType === 'activity'
          ? 'Activity Worksheet'
          : uploadType === 'file'
          ? 'Official PDF Document'
          : uploadType === 'video'
          ? 'Video Lesson'
          : uploadType === 'image'
          ? 'Worksheet Image'
          : 'Reading Story',
      file_type: effectiveFileType,
      file_size: effectiveFileSize,
      file_name: effectiveFileName,
      posted_to_students: false,
      target_student_id: null,
      target_student_name: null,
    };

    const catId = categoryOptions.length > 0 ? categoryOptions[0].id : null;
    const dbType = ['image', 'video', 'text'].includes(uploadType) ? uploadType : 'activity';
    let dbMaterialId = null;
    let savedToSupabase = false;

    try {
      const { data: insertedMat, error: matErr } = await supabase
        .from('materials')
        .insert({
          category_id: catId,
          type: dbType,
          title: uploadTitle.trim(),
          age_range: uploadCurriculumLevel === 'PRE-K1' ? '3-4' : '4-5',
          content_url: effectiveUrl,
          content_text: JSON.stringify(metadataPayload),
          created_by: currentUserId,
          status: 'pending',
        })
        .select()
        .single();

      if (!matErr && insertedMat) {
        dbMaterialId = insertedMat.id;
        savedToSupabase = true;
      } else if (matErr) {
        console.warn('Note on Supabase materials insert:', matErr);
      }
    } catch (err) {
      console.warn('Note on Supabase insert:', err);
    }

    // 2. Insert to localTeacherModules for cross-dashboard visibility & MSWD activity monitoring
    const newMod = {
      id: dbMaterialId || ('mod-' + Date.now()),
      assignment_id: activeAssignmentId || null,
      title: uploadTitle.trim(),
      teacher_name: profile?.full_name || 'Teacher',
      teacher_id: currentUserId,
      cdc_name: myCdcName || profile?.cdc_name || 'Manolo Fortich CDC',
      barangay: myBarangay || profile?.barangay || 'Manolo Fortich',
      level: uploadCurriculumLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2',
      quarter: parseInt(uploadQuarter, 10),
      week: uploadWeek || 'Week 1',
      sub_theme: uploadSubTheme || '',
      theme: uploadTheme || '',
      module_type:
        uploadType === 'activity'
          ? 'Activity Worksheet'
          : uploadType === 'file'
          ? 'Official PDF Document'
          : uploadType === 'video'
          ? 'Video Lesson'
          : uploadType === 'image'
          ? 'Worksheet Image'
          : 'Reading Story',
      file_type: effectiveFileType,
      file_size: effectiveFileSize,
      file_name: effectiveFileName,
      upload_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Pending Review',
      verified_by_mswd: false,
      posted_to_students: false,
      target_student_id: null,
      target_student_name: null,
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
    setUploadMsg({
      text: savedToSupabase
        ? '✅ Activity submitted to MSWD! Once MSWD approves it, you can post it to your Student Dashboard.'
        : '✅ Activity submitted to MSWD for review! Once approved, you can post it to your Student Dashboard.',
      type: 'ok',
    });
    setTimeout(() => {
      setIsUploadModalOpen(false);
      setUploadMsg({ text: '', type: '' });
      setActiveAssignmentId(null);
      setActiveAssignmentDeadline(null);
      handleRemoveSelectedFile();
    }, 1400);
  }

  // Open modal to post an MSWD-approved activity to a specific Student Dashboard (or all learners in class)
  const handleOpenPostToStudentModal = (mat) => {
    setPostingMaterial(mat);
    setSelectedTargetStudentId(mat.target_student_id || 'all');
    setPostModalMsg({ text: '', type: '' });
  };

  // Confirm posting the MSWD-approved activity to the selected Student Dashboard
  async function handleConfirmPostToStudent(e) {
    if (e) e.preventDefault();
    if (!postingMaterial) return;

    const chosenLearner =
      selectedTargetStudentId !== 'all'
        ? myLearners.find((l) => String(l.id) === String(selectedTargetStudentId))
        : null;

    const targetName =
      selectedTargetStudentId === 'all'
        ? `All Class Learners (${myCdcName || 'My CDC'})`
        : chosenLearner?.full_name || 'Selected Student';

    const nowFormatted = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    // 1. Update localTeacherModules (or insert if it came from Supabase only)
    let foundInLocal = false;
    const updatedLocal = localTeacherModules.map((m) => {
      if (m.id === postingMaterial.id || m.title === postingMaterial.title) {
        foundInLocal = true;
        return {
          ...m,
          status: 'Approved',
          verified_by_mswd: true,
          posted_to_students: true,
          target_student_id: selectedTargetStudentId,
          target_student_name: targetName,
          posted_at: nowFormatted,
        };
      }
      return m;
    });

    if (!foundInLocal) {
      updatedLocal.unshift({
        id: postingMaterial.id,
        assignment_id: postingMaterial.assignment_id || null,
        title: postingMaterial.title,
        teacher_name: myFullName || profile?.full_name || 'Teacher',
        teacher_id: currentUserId,
        cdc_name: myCdcName || profile?.cdc_name || 'Manolo Fortich CDC',
        barangay: myBarangay || profile?.barangay || 'Manolo Fortich',
        level: postingMaterial.level || 'Pre-K1',
        quarter: postingMaterial.quarter || 1,
        week: postingMaterial.week || 'Week 1',
        sub_theme: postingMaterial.sub_theme || '',
        theme: postingMaterial.theme || '',
        module_type: postingMaterial.formatLabel || 'Activity Worksheet',
        type: 'activity',
        status: 'Approved',
        verified_by_mswd: true,
        posted_to_students: true,
        target_student_id: selectedTargetStudentId,
        target_student_name: targetName,
        posted_at: nowFormatted,
        description: postingMaterial.content_text || '',
        content_url: postingMaterial.content_url || null,
        upload_date: postingMaterial.created_at || nowFormatted,
        is_custom_teacher_upload: true,
      });
    }

    setLocalTeacherModules(updatedLocal);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updatedLocal));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updatedLocal }));
    } catch {}

    // 2. Also update Supabase materials metadata if applicable
    if (!postingMaterial.isLocal) {
      try {
        const updatedMeta = {
          ...(postingMaterial.raw_meta || {}),
          __metadata: true,
          description: postingMaterial.content_text || '',
          teacher_name: myFullName || profile?.full_name || 'Teacher',
          cdc_name: myCdcName || profile?.cdc_name || 'Manolo Fortich CDC',
          barangay: myBarangay || profile?.barangay || 'Manolo Fortich',
          level: postingMaterial.level || 'Pre-K1',
          quarter: postingMaterial.quarter || 1,
          week: postingMaterial.week || 'Week 1',
          sub_theme: postingMaterial.sub_theme || '',
          theme: postingMaterial.theme || '',
          posted_to_students: true,
          target_student_id: selectedTargetStudentId,
          target_student_name: targetName,
          posted_at: nowFormatted,
        };
        await supabase
          .from('materials')
          .update({ content_text: JSON.stringify(updatedMeta) })
          .eq('id', postingMaterial.id);
        loadMyMaterials();
      } catch {}
    }

    setPostModalMsg({
      text: `🚀 Activity successfully posted to Student Dashboard (${targetName})!`,
      type: 'ok',
    });

    setTimeout(() => {
      setPostingMaterial(null);
      setPostModalMsg({ text: '', type: '' });
    }, 1100);
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
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
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
    let loadedName = '';
    let loadedBarangay = '';
    let loadedContact = '';
    let loadedEmail = '';
    let loadedCdcId = '';
    let loadedCdcName = '';
    let loadedBio = '';

    // 1. First fetch fresh Supabase Auth metadata (guaranteed cross-device sync)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const meta = user.user_metadata;
        if (meta.full_name) loadedName = meta.full_name;
        if (meta.barangay) loadedBarangay = meta.barangay;
        if (meta.contact_number) loadedContact = meta.contact_number;
        if (meta.email || user.email) loadedEmail = meta.email || user.email;
        if (meta.cdc_name) loadedCdcName = meta.cdc_name;
        if (meta.cdc_id) loadedCdcId = meta.cdc_id;
        if (meta.bio) loadedBio = meta.bio;
      }
    } catch {
      // ignore
    }

    // 2. Query Supabase profiles & teachers table
    try {
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .single();
      if (profData) {
        if (profData.full_name) loadedName = profData.full_name;
        if (profData.barangay) loadedBarangay = profData.barangay;
        if (profData.contact_number) loadedContact = profData.contact_number;
        if (profData.cdc_name) loadedCdcName = profData.cdc_name;
      }

      const { data: teachData } = await supabase
        .from('teachers')
        .select('full_name, barangay, contact_number, email, cdc_id, cdcs(name)')
        .eq('id', currentUserId)
        .single();
      if (teachData) {
        if (teachData.full_name) loadedName = teachData.full_name;
        if (teachData.barangay) loadedBarangay = teachData.barangay;
        if (teachData.contact_number) loadedContact = teachData.contact_number;
        if (teachData.email) loadedEmail = teachData.email;
        if (teachData.cdc_id) loadedCdcId = teachData.cdc_id;
        if (teachData.cdcs?.name) loadedCdcName = teachData.cdcs.name;
      }
    } catch {
      // ignore
    }

    // 3. Fallback to passed profile props if still empty
    if (!loadedName && profile?.full_name) loadedName = profile.full_name;
    if (!loadedBarangay && profile?.barangay) loadedBarangay = profile.barangay;
    if (!loadedContact && profile?.contact_number) loadedContact = profile.contact_number;
    if (!loadedEmail && profile?.email) loadedEmail = profile.email;
    if (!loadedCdcName && profile?.cdc_name) loadedCdcName = profile.cdc_name;

    // 4. Fallback matching with realTeachersList if still blank
    if (!loadedBarangay || !loadedCdcName) {
      const match = realTeachersList.find(
        (t) =>
          t.id === currentUserId ||
          (t.email && loadedEmail && t.email.toLowerCase() === loadedEmail.toLowerCase()) ||
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

  // Handle Save & Sync Teacher Profile (updates Supabase Auth + Supabase DB + broadcasts to Admin)
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

    let supabaseSaved = false;

    try {
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          full_name: updatedTeacher.full_name,
          barangay: updatedTeacher.barangay,
          cdc_name: updatedTeacher.cdc_name,
          contact_number: updatedTeacher.contact_number,
          bio: updatedTeacher.bio,
        },
      });
      if (!authErr) supabaseSaved = true;
    } catch (err) {
      console.warn('Note on Supabase auth.updateUser:', err);
    }

    try {
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          full_name: updatedTeacher.full_name,
          barangay: updatedTeacher.barangay,
        })
        .eq('id', currentUserId);
      if (!profError) supabaseSaved = true;

      try {
        await supabase
          .from('profiles')
          .update({
            cdc_name: updatedTeacher.cdc_name,
            contact_number: updatedTeacher.contact_number,
          })
          .eq('id', currentUserId);
      } catch {}
    } catch (err) {
      console.warn('Note on Supabase profiles update:', err);
    }

    try {
      const teacherPayload = {
        id: currentUserId,
        full_name: updatedTeacher.full_name,
        email: updatedTeacher.email,
        barangay: updatedTeacher.barangay,
        contact_number: updatedTeacher.contact_number,
      };
      if (updatedTeacher.cdc_id) teacherPayload.cdc_id = updatedTeacher.cdc_id;

      const { error: tchError } = await supabase.from('teachers').upsert(teacherPayload);
      if (!tchError) supabaseSaved = true;
    } catch (err) {
      console.warn('Note on Supabase teachers upsert:', err);
    }

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

    if (profile) {
      profile.full_name = updatedTeacher.full_name;
      profile.barangay = updatedTeacher.barangay;
      profile.cdc_name = updatedTeacher.cdc_name;
      profile.contact_number = updatedTeacher.contact_number;
    }
    setMyCdcName(finalCdc);

    window.dispatchEvent(new CustomEvent('earlylearn_teachers_updated', { detail: updatedTeacher }));
    window.dispatchEvent(new CustomEvent('earlylearn_teacher_profile_saved', { detail: updatedTeacher }));

    loadMyLearners();

    setProfileSaving(false);
    setProfileMsg({
      text: supabaseSaved
        ? `✅ Malampusong na-save ang imong profile sa Supabase! Na-update na: ${finalCdc}, Brgy. ${myBarangay}.`
        : `✅ Na-save ang imong profile! Na-update na: ${finalCdc}, Brgy. ${myBarangay}.`,
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
      profile?.cdc_name ||
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
  }, [currentUserId, profile, myBarangay, myCdcName]);

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
    setAssignments(getCleanCurriculumAssignments());

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

  // Enriched topics with deadline calculation and active filter matching
  const filteredAssignedTopics = useMemo(() => {
    return myAssignedTopics
      .map((asg) => {
        const isPastDeadline = Boolean(asg.deadline && new Date(asg.deadline + 'T23:59:59') < new Date());
        const matchingUpload = combinedUploadedMaterials.find(
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
        if (topicStatusFilter === 'pending' && (asg.isCompleted || asg.isPastDeadline)) return false;
        if (topicStatusFilter === 'completed' && !asg.isCompleted) return false;
        if (topicStatusFilter === 'expired' && (!asg.isPastDeadline || asg.isCompleted)) return false;

        if (topicLevelFilter !== 'all' && asg.level?.toLowerCase() !== topicLevelFilter.toLowerCase()) return false;

        if (topicQuarterFilter !== 'all') {
          const qInt = parseInt(topicQuarterFilter, 10);
          const hasQ = asg.quarters ? asg.quarters.includes(qInt) : asg.quarter === qInt;
          if (!hasQ) return false;
        }

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
  }, [myAssignedTopics, combinedUploadedMaterials, topicStatusFilter, topicLevelFilter, topicQuarterFilter, topicSearchQuery]);

  // Aggregate counts for assigned topics
  const assignedCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let expired = 0;

    myAssignedTopics.forEach((asg) => {
      const isPast = Boolean(asg.deadline && new Date(asg.deadline + 'T23:59:59') < new Date());
      const hasUpload = combinedUploadedMaterials.some(
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
  }, [myAssignedTopics, combinedUploadedMaterials]);

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

  const approvedReadyToPost = useMemo(
    () => combinedUploadedMaterials.filter((m) => m.status === 'Approved' && !m.posted_to_students),
    [combinedUploadedMaterials]
  );

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
        <div className="space-y-5">
          <div className={cardBox}>
            <h3 className={cardBoxTitle}>Welcome, Teacher {myFullName || profile?.full_name || ''}!</h3>
            <p className="text-sm text-[#5c5342]">
              Comply with the topics assigned by MSWD, wait for MSWD approval, and then post approved activities directly to your Student Dashboard.
            </p>

            {/* Quick Workflow Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
              <div
                onClick={() => setActiveTab('assigned_topics')}
                className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors"
              >
                <div className="text-[11px] font-bold text-amber-800 uppercase">1. MSWD Assigned Topics</div>
                <div className="text-2xl font-bold text-amber-950 mt-1">{myAssignedTopics.length}</div>
                <div className="text-[11px] text-amber-700 mt-0.5">{assignedCounts.pending} open to comply →</div>
              </div>

              <div
                onClick={() => {
                  setUploadedFilterStatus('pending');
                  setActiveTab('upload');
                }}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors"
              >
                <div className="text-[11px] font-bold text-slate-600 uppercase">2. Pending MSWD Decision</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {combinedUploadedMaterials.filter((m) => m.status === 'Pending Review').length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Awaiting MSWD review →</div>
              </div>

              <div
                onClick={() => {
                  setUploadedFilterStatus('approved');
                  setActiveTab('upload');
                }}
                className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer hover:bg-emerald-50 transition-colors"
              >
                <div className="text-[11px] font-bold text-emerald-800 uppercase">3. Approved by MSWD</div>
                <div className="text-2xl font-bold text-emerald-900 mt-1">
                  {combinedUploadedMaterials.filter((m) => m.status === 'Approved').length}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  {approvedReadyToPost.length} ready to post to students →
                </div>
              </div>

              <div
                onClick={() => {
                  setUploadedFilterStatus('posted');
                  setActiveTab('upload');
                }}
                className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <div className="text-[11px] font-bold text-blue-800 uppercase">4. Posted to Students</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">
                  {combinedUploadedMaterials.filter((m) => m.posted_to_students).length}
                </div>
                <div className="text-[11px] text-blue-700 mt-0.5">Live on Student Dashboard →</div>
              </div>
            </div>
          </div>

          {/* Ready-to-Post Banner when MSWD Approves an Activity */}
          {approvedReadyToPost.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✅ MSWD Approved Your Complied Activity!</span>
                </div>
                <p className="text-xs text-emerald-800 mt-1 m-0">
                  You have <strong>{approvedReadyToPost.length}</strong> MSWD-approved{' '}
                  {approvedReadyToPost.length === 1 ? 'activity' : 'activities'} ready to post to a specific Student Dashboard or your entire CDC class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenPostToStudentModal(approvedReadyToPost[0])}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs cursor-pointer shrink-0"
              >
                📤 Post to Student Dashboard →
              </button>
            </div>
          )}
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
                Official curriculum topics assigned by MSWDO Manolo Fortich. Upload your complied activity for MSWD review; once MSWD approves it, post it to your Student Dashboard.
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
                Complied &amp; Submitted
              </div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {assignedCounts.completed}
              </div>
              <div className="text-[10.5px] text-emerald-600 mt-0.5">Sent to MSWD</div>
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
                <span>✅ Complied</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
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
              const matchedMod = item.matchingUpload;

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
                    <div className="space-y-2 flex-1">
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

                        {matchedMod ? (
                          matchedMod.status === 'Approved' ? (
                            <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <span>✅</span>
                              <span>
                                {matchedMod.posted_to_students
                                  ? `Approved & Posted (${matchedMod.target_student_name || 'Students'})`
                                  : 'Approved by MSWD'}
                              </span>
                            </span>
                          ) : matchedMod.status === 'Rejected' ? (
                            <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <span>❌</span>
                              <span>Rejected by MSWD</span>
                            </span>
                          ) : (
                            <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <span>⏳</span>
                              <span>Complied • Pending MSWD Decision</span>
                            </span>
                          )
                        ) : item.isPastDeadline ? (
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Deadline Passed (Locked)</span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <span>⏳</span>
                            <span>Open for Compliance</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-bold text-slate-900 m-0">
                        {item.topicTitle || item.subTheme || 'Prescribed ECCD Topic'}
                      </h4>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-amber-900">
                          Focus: {item.subTheme || item.topicTitle}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          Theme: {item.theme || 'TELL ME ABOUT YOURSELF'}
                        </span>
                      </div>

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

                      {(item.suggestedActivities || item.suggestedContent) && (
                        <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#EBE1CF] text-xs text-[#524430] leading-relaxed mt-2">
                          <span className="font-bold block text-slate-800 mb-0.5">
                            DepEd ECCD Suggested Content &amp; Activities:
                          </span>
                          {item.suggestedActivities || item.suggestedContent}
                        </div>
                      )}

                      {item.notes && (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                          <strong>Note from MSWDO Admin:</strong> {item.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-start md:items-end justify-between gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
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
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic mt-1">
                            Flexible schedule
                          </div>
                        )}
                      </div>

                      <div>
                        {item.isPastDeadline && !item.isCompleted ? (
                          <button
                            type="button"
                            disabled
                            className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-400 font-bold text-xs cursor-not-allowed flex items-center gap-1.5 opacity-60"
                          >
                            <span>🔒 Upload Closed (Deadline Passed)</span>
                          </button>
                        ) : matchedMod && matchedMod.status === 'Approved' ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPostToStudentModal(matchedMod)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <span>📤 {matchedMod.posted_to_students ? 'Repost / Change Student' : 'Post to Student Dashboard'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('upload')}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                            >
                              View →
                            </button>
                          </div>
                        ) : matchedMod && matchedMod.status === 'Rejected' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenUploadForAssignedTopic(item)}
                            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>🔄 Re-upload Revised Activity →</span>
                          </button>
                        ) : item.isCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                              ⏳ Pending MSWD Approval
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
                            <span>📤 Comply &amp; Upload Activity →</span>
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
                    ? 'When MSWDO Manolo Fortich assigns a curriculum topic for you or your Child Development Center, it will automatically appear here and in your Uploaded Materials choices.'
                    : 'Try adjusting your status filter or search query.'}
                </p>
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

      {/* UPLOADED MATERIALS — Concise & Easy to Navigate, Based Strictly on MSWD Assigned Topics */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                <IconMaterials className="w-3.5 h-3.5 text-amber-700" />
                <span>MSWD Topic Compliance &amp; Student Activity Publishing</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 m-0 mt-1.5 tracking-tight">
                Uploaded Materials &amp; Complied Activities
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                1. Select an MSWD-assigned topic to upload • 2. MSWD views &amp; decides (Approve / Reject) • 3. Post approved activity to Student Dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenNewUpload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer shrink-0"
            >
              <IconUpload className="w-4 h-4" />
              <span>Upload for MSWD Topic</span>
            </button>
          </div>

          {/* Concise MSWD Assigned Topics Bar — 1-Click Upload per MSWD Topic */}
          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>📌</span>
                <span>MSWD Assigned Topics for You ({mswdTopicChoices.length})</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Click any MSWD topic below to immediately upload your complied activity:
              </span>
            </div>

            {mswdTopicChoices.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mswdTopicChoices.map((c) => {
                  const alreadyComplied = combinedUploadedMaterials.some(
                    (m) =>
                      (c.assignmentId && m.assignment_id === c.assignmentId) ||
                      (m.sub_theme && m.sub_theme.toLowerCase() === c.subTheme.toLowerCase())
                  );
                  return (
                    <button
                      key={c.choiceKey}
                      type="button"
                      onClick={() => {
                        handleRemoveSelectedFile();
                        handleSelectMswdTopicChoice(c);
                        setUploadMsg({ text: '', type: '' });
                        setIsUploadModalOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        alreadyComplied
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                          : 'bg-amber-50/70 border-amber-300 text-amber-950 hover:bg-amber-100'
                      }`}
                    >
                      <span>{alreadyComplied ? '✓' : '📤'}</span>
                      <span>
                        {c.week}: {c.subTheme}
                      </span>
                      <span className="text-[10px] opacity-75">
                        ({c.level} • Q{c.quarter})
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-3">
                <span>
                  No topic has been assigned by MSWD yet. Curriculum Guide topics are hidden until MSWD assigns a topic to you.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('assigned_topics')}
                  className="text-xs font-bold text-accent hover:underline shrink-0 cursor-pointer"
                >
                  Check Assigned Topics →
                </button>
              </div>
            )}
          </div>

          {/* Concise Status Navigation Pills + Search */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: 'All', count: combinedUploadedMaterials.length },
                {
                  key: 'pending',
                  label: '⏳ Pending MSWD',
                  count: combinedUploadedMaterials.filter((m) => m.status === 'Pending Review').length,
                },
                {
                  key: 'approved',
                  label: '✅ MSWD Approved',
                  count: combinedUploadedMaterials.filter((m) => m.status === 'Approved').length,
                },
                {
                  key: 'posted',
                  label: '🚀 Posted to Students',
                  count: combinedUploadedMaterials.filter((m) => m.posted_to_students).length,
                },
                {
                  key: 'rejected',
                  label: '❌ Rejected',
                  count: combinedUploadedMaterials.filter((m) => m.status === 'Rejected').length,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setUploadedFilterStatus(tab.key)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    uploadedFilterStatus === tab.key
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      uploadedFilterStatus === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[210px] flex-1">
                <input
                  type="text"
                  placeholder="Search complied activity or topic..."
                  value={uploadedSearch}
                  onChange={(e) => setUploadedSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:border-slate-800"
                />
                <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {(uploadedFilterStatus !== 'all' || uploadedSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFilterStatus('all');
                    setUploadedFilterLevel('all');
                    setUploadedFilterQuarter('all');
                    setUploadedFilterType('all');
                    setUploadedSearch('');
                  }}
                  className="text-xs text-accent hover:underline font-bold cursor-pointer px-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Uploaded Materials Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="px-4 py-3">Complied Activity &amp; MSWD Topic</th>
                    <th className="px-4 py-3">Level &amp; Week</th>
                    <th className="px-4 py-3 text-center">MSWD Decision</th>
                    <th className="px-4 py-3 text-center">Student Dashboard</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUploadedMaterials.map((m) => {
                    const isApproved = m.status === 'Approved' || m.verified_by_mswd;
                    const isRejected = m.status === 'Rejected';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 text-xs">{m.title}</div>
                          {m.sub_theme && (
                            <div className="text-[11px] text-amber-900 font-semibold mt-0.5">
                              MSWD Topic: {m.sub_theme}
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
                              <span className="font-bold">💬 MSWD Note:</span> {m.mswd_comments}
                            </div>
                          )}
                          {m.revision_notes && (
                            <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900">
                              <span className="font-bold">⚠️ MSWD Rejection / Revision Note:</span> {m.revision_notes}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold w-fit ${
                                m.level?.toLowerCase().includes('pre-k1')
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {m.level?.toUpperCase().includes('PRE-K') ? m.level : 'Pre-K1'}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              Q{m.quarter} • {m.week}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                : isRejected
                                ? 'bg-rose-50 text-rose-800 border border-rose-300'
                                : 'bg-amber-50 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {isApproved
                              ? '✅ Approved by MSWD'
                              : isRejected
                              ? '❌ Rejected by MSWD'
                              : '⏳ Pending MSWD Decision'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {isApproved ? (
                            m.posted_to_students ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  🚀 Posted to Student Dashboard
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  Target: {m.target_student_name || 'All Class Learners'}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenPostToStudentModal(m)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>📤</span>
                                <span>Post to Student Dashboard</span>
                              </button>
                            )
                          ) : isRejected ? (
                            <span className="text-[11px] text-rose-600 font-semibold">
                              Cannot post (Rejected)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Locked until MSWD approves
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isApproved && m.posted_to_students && (
                              <button
                                type="button"
                                onClick={() => handleOpenPostToStudentModal(m)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-colors cursor-pointer"
                                title="Change target student or repost"
                              >
                                Target Student
                              </button>
                            )}
                            {m.content_url && (
                              <a
                                href={m.content_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={m.file_name || undefined}
                                className="px-2.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="View / Download Material File"
                              >
                                <span>👁️</span>
                                <span>View</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(m)}
                              className="px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUploadedMaterials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <div className="text-2xl mb-1">📂</div>
                        <div className="font-semibold text-xs">No uploaded activities match your filter</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Select an MSWD-assigned topic above to upload your complied activity.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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

          <form onSubmit={handleSaveTeacherProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  </div>
                </div>
              </div>

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
                        placeholder="e.g. Sitio Impahanong Child Development Center"
                        value={customCdcInput}
                        onChange={(e) => setCustomCdcInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-[#FFFDF8] font-bold text-slate-800 outline-none focus:border-accent text-sm"
                      />
                    )}
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
                  </div>
                </div>
              </div>
            </div>

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

      {/* POST APPROVED ACTIVITY TO SPECIFIC STUDENT DASHBOARD MODAL */}
      {postingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✅ Approved by MSWD
                </span>
                <h3 className="text-base font-bold text-slate-900 m-0 mt-1">
                  Post Activity to Student Dashboard
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPostingMaterial(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPostToStudent} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-xs">{postingMaterial.title}</div>
                <div className="text-[11px] text-amber-900 font-semibold">
                  Topic: {postingMaterial.sub_theme || postingMaterial.theme || 'MSWD Assigned Topic'} ({postingMaterial.level} • Q{postingMaterial.quarter} {postingMaterial.week})
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  Select Target Student Dashboard:
                </label>
                <select
                  value={selectedTargetStudentId}
                  onChange={(e) => setSelectedTargetStudentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-slate-900"
                >
                  <option value="all">
                    👥 All Learners in My CDC ({myCdcName || 'My Class'}) — {myLearners.length} Enrolled
                  </option>
                  {myLearners.map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      🧒 {learner.full_name} {learner.parent_name ? `(Parent: ${learner.parent_name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5 mb-0">
                  Choose whether to post this MSWD-approved activity to a specific learner&apos;s Student Dashboard or to all learners in your assigned CDC class.
                </p>
              </div>

              {postModalMsg.text && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs">
                  {postModalMsg.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPostingMaterial(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>🚀</span>
                  <span>Post to Student Dashboard</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Upload Modal (choices based strictly on MSWD-assigned topics) */}
      <TeacherUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        activeAssignmentId={activeAssignmentId}
        activeAssignmentDeadline={activeAssignmentDeadline}
        uploadCurriculumLevel={uploadCurriculumLevel}
        uploadQuarter={uploadQuarter}
        uploadWeek={uploadWeek}
        uploadSubTheme={uploadSubTheme}
        uploadTitle={uploadTitle}
        setUploadTitle={setUploadTitle}
        uploadDescription={uploadDescription}
        setUploadDescription={setUploadDescription}
        uploadType={uploadType}
        setUploadType={setUploadType}
        uploadUrl={uploadUrl}
        setUploadUrl={setUploadUrl}
        uploadFileName={uploadFileName}
        uploadFileSize={uploadFileSize}
        uploadFileType={uploadFileType}
        uploadFilePreview={uploadFilePreview}
        isDraggingFile={isDraggingFile}
        setIsDraggingFile={setIsDraggingFile}
        fileInputRef={fileInputRef}
        uploadMsg={uploadMsg}
        handleFileSelected={handleFileSelected}
        handleRemoveSelectedFile={handleRemoveSelectedFile}
        handleModalLevelChange={handleModalLevelChange}
        handleModalQuarterChange={handleModalQuarterChange}
        handleSelectMswdTopicChoice={handleSelectMswdTopicChoice}
        handleSaveMaterial={handleSaveMaterial}
        mswdTopicChoices={mswdTopicChoices}
      />
    </DashboardLayout>
  );
}
