import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BILINGUAL_CATEGORIES, playAudioWord } from '../lib/studentLearningData.js';
import { CategoryBadge } from '../components/Category3DBadges.jsx';
import { getDefaultTeacherForBarangay, syncStudentLogin, cleanStudentName } from '../lib/learnersService.js';
import { isAuthenticSupabaseMaterial, getCleanTeacherModulesList } from '../lib/curriculumData.js';

const PALETTES = [
  'bg-coral', // coral red
  'bg-turquoise', // turquoise
  'bg-sun text-[#4A3F1A]', // sunshine yellow - dark text for contrast
  'bg-leaf', // grass green
  'bg-purple', // soft purple
  'bg-orange', // warm orange
];

export default function StudentDashboard({ profile }) {
  const navigate = useNavigate();
  const currentUserId = profile?.id || 'demo-student';

  const [view, setView] = useState('home'); // home | category_detail | content
  const [backTarget, setBackTarget] = useState('home');

  const greetingName = useMemo(() => {
    if (!profile?.full_name) return 'Student Test';
    return cleanStudentName(profile.full_name) || 'Student Test';
  }, [profile?.full_name]);

  const studentBarangay = profile?.barangay || profile?.user_metadata?.barangay || '';

  // Class adviser information linked to this student
  const adviserInfo = useMemo(() => {
    let adviser =
      profile?.adviser_name ||
      profile?.user_metadata?.adviser_name ||
      profile?.user_metadata?.teacher_name ||
      '';
    let cdc =
      profile?.cdc_name ||
      profile?.user_metadata?.cdc_name ||
      '';

    if (!adviser && currentUserId) {
      try {
        const cached = localStorage.getItem(`earlylearn_student_adviser_${currentUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.adviser_name) adviser = parsed.adviser_name;
          if (parsed.cdc_name) cdc = parsed.cdc_name;
        }
      } catch {
        // ignore
      }
    }

    if (!adviser && studentBarangay) {
      const defaultTch = getDefaultTeacherForBarangay(studentBarangay);
      if (defaultTch) {
        adviser = defaultTch.full_name;
        cdc = defaultTch.cdc_name || `${studentBarangay} Child Development Center`;
      }
    }

    return {
      adviserName: adviser || 'Day Care Teacher',
      cdcName: cdc || (studentBarangay ? `${studentBarangay} Child Development Center` : 'Child Development Center'),
      barangay: studentBarangay,
    };
  }, [profile, currentUserId, studentBarangay]);

  const [announcements, setAnnouncements] = useState([]);
  const [categories] = useState(BILINGUAL_CATEGORIES);

  // Completed teacher activity IDs
  const [completedIds, setCompletedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`earlylearn_done_${currentUserId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Selected Category Detail state
  const [currentCategory, setCurrentCategory] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(null);
  const [storyLanguageTab, setStoryLanguageTab] = useState('both'); // 'both' | 'en' | 'bis'

  // Content view state (doing a teacher activity)
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [answer, setAnswer] = useState('');
  const [activityFilePreview, setActivityFilePreview] = useState(null);
  const [activityFileName, setActivityFileName] = useState('');
  const [activityFileType, setActivityFileType] = useState('');
  const [activityFileSize, setActivityFileSize] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [doneMsg, setDoneMsg] = useState({ text: '', error: false });
  const [submitted, setSubmitted] = useState(false);
  const [submissionsByMaterial, setSubmissionsByMaterial] = useState({});

  // Activities sub-tab view: 'teacher' | 'student_uploads'
  const [activityTab, setActivityTab] = useState('teacher');

  // Student's own uploaded activities & artworks
  const [studentUploads, setStudentUploads] = useState(() => {
    try {
      const saved = localStorage.getItem(`earlylearn_student_uploads_${currentUserId}`);
      if (saved) return JSON.parse(saved);
      const general = localStorage.getItem('earlylearn_student_uploads');
      return general ? JSON.parse(general) : [];
    } catch {
      return [];
    }
  });

  // Student upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Colors / Mga Kolor');
  const [uploadNote, setUploadNote] = useState('');
  const [uploadFilePreview, setUploadFilePreview] = useState(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileType, setUploadFileType] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState('');
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);

  // Helper to open or download data: URLs and external URLs reliably across devices
  const handleOpenOrDownloadFile = useCallback((fileUrl, fileName, mode = 'view') => {
    if (!fileUrl) return;
    if (fileUrl.startsWith('data:')) {
      try {
        const parts = fileUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        if (mode === 'download') {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName || 'activity-file';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      } catch (err) {
        console.warn('Fallback opening data URL:', err);
      }
    }
    if (mode === 'download') {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || 'activity-file';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // Teacher-uploaded modules from localStorage & Supabase
  const [teacherUploadedModules, setTeacherUploadedModules] = useState(() => {
    return getCleanTeacherModulesList();
  });

  const [dbMaterials, setDbMaterials] = useState([]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  // --- Load Announcements from Supabase ---
  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      if (!error && data && data.length > 0) {
        setAnnouncements(data);
      }
    } catch {
      // fallback
    }
  }, []);

  // --- Load Supabase Materials ---
  const loadDbMaterials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*, categories(id, name, icon)')
        .eq('status', 'approved')
        .not('title', 'like', '[MSWD_ASSIGNMENT]%')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setDbMaterials(data.filter((m) => isAuthenticSupabaseMaterial(m)));
      }
    } catch {
      // fallback
    }
  }, []);

  // --- Load Student Submissions from Supabase (Cross-Device Sync) ---
  const loadStudentSubmissions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, materials(id, title)')
        .eq('student_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const doneSet = new Set();
        const subMap = {};
        const dbUploadsByTitle = new Map();

        try {
          const savedDone = localStorage.getItem(`earlylearn_done_${currentUserId}`);
          if (savedDone) {
            JSON.parse(savedDone).forEach((id) => doneSet.add(id));
          }
        } catch {
          // ignore
        }

        data.forEach((s) => {
          let meta = null;
          let cleanAnswer = s.answer_text || '';
          if (cleanAnswer.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(cleanAnswer);
              if (parsed && parsed.__submission_meta) {
                meta = parsed;
                cleanAnswer = parsed.answer_text || '';
              }
            } catch {
              // ignore
            }
          }

          const matId = s.material_id || meta?.material_id || null;
          const matTitle = meta?.material_title || s.materials?.title || '';
          const isTeacherChecked =
            s.status === 'checked' ||
            s.status === 'reviewed' ||
            meta?.teacher_checked === true;

          const submissionEntry = {
            id: s.id,
            material_id: matId,
            material_title: matTitle,
            answer_text: cleanAnswer,
            file_url: meta?.file_url || null,
            file_name: meta?.file_name || '',
            file_type: meta?.file_type || '',
            file_size: meta?.file_size || '',
            status: isTeacherChecked ? 'checked' : s.status || 'submitted',
            teacher_checked: isTeacherChecked,
            checked_at: meta?.checked_at || null,
            created_at: s.created_at,
          };

          if (matId) {
            doneSet.add(matId);
            if (!subMap[matId]) {
              subMap[matId] = submissionEntry;
            } else {
              if (isTeacherChecked) {
                subMap[matId].teacher_checked = true;
                subMap[matId].status = 'checked';
              }
              if (!subMap[matId].file_url && submissionEntry.file_url) {
                subMap[matId].file_url = submissionEntry.file_url;
                subMap[matId].file_name = submissionEntry.file_name;
                subMap[matId].file_type = submissionEntry.file_type;
                subMap[matId].file_size = submissionEntry.file_size;
              }
            }
          }
          if (matTitle) {
            const titleKey = matTitle.toLowerCase().trim();
            doneSet.add(titleKey);
            if (!subMap[titleKey]) {
              subMap[titleKey] = submissionEntry;
            } else {
              if (isTeacherChecked) {
                subMap[titleKey].teacher_checked = true;
                subMap[titleKey].status = 'checked';
              }
              if (!subMap[titleKey].file_url && submissionEntry.file_url) {
                subMap[titleKey].file_url = submissionEntry.file_url;
                subMap[titleKey].file_name = submissionEntry.file_name;
                subMap[titleKey].file_type = submissionEntry.file_type;
                subMap[titleKey].file_size = submissionEntry.file_size;
              }
            }
          }

          if (meta?.file_url || meta?.file_name || cleanAnswer) {
            const uploadTitleStr = (matTitle || meta?.title || 'Activity Submission').trim();
            const normUploadKey = uploadTitleStr.toLowerCase();
            if (!dbUploadsByTitle.has(normUploadKey)) {
              dbUploadsByTitle.set(normUploadKey, {
                id: s.id,
                studentId: currentUserId,
                studentName: cleanStudentName(meta?.student_name || greetingName),
                title: uploadTitleStr,
                category: meta?.category || 'Teacher Assigned Activity',
                note: cleanAnswer,
                mediaUrl: meta?.file_url || null,
                fileName: meta?.file_name || '',
                fileType: meta?.file_type || '',
                fileSize: meta?.file_size || '',
                uploadedAt:
                  meta?.uploaded_at ||
                  (s.created_at
                    ? new Date(s.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent'),
                teacherChecked: isTeacherChecked,
                status: isTeacherChecked ? 'Checked by Teacher ✅' : 'Submitted • Waiting for Teacher',
              });
            } else {
              const existingUp = dbUploadsByTitle.get(normUploadKey);
              if (isTeacherChecked) {
                existingUp.teacherChecked = true;
                existingUp.status = 'Checked by Teacher ✅';
              }
              if (!existingUp.mediaUrl && meta?.file_url) {
                existingUp.mediaUrl = meta.file_url;
                existingUp.fileName = meta.file_name || '';
                existingUp.fileType = meta.file_type || '';
                existingUp.fileSize = meta.file_size || '';
              }
            }
          }
        });

        setCompletedIds(doneSet);
        setSubmissionsByMaterial(subMap);
        try {
          localStorage.setItem(`earlylearn_done_${currentUserId}`, JSON.stringify(Array.from(doneSet)));
        } catch {
          // ignore
        }

        const dbStudentUploads = Array.from(dbUploadsByTitle.values());
        setStudentUploads((prev) => {
          const merged = [...dbStudentUploads];
          const seenTitles = new Set(
            dbStudentUploads.map((u) => (u.title || '').toLowerCase().trim())
          );
          (prev || []).forEach((localUp) => {
            const titleKey = (localUp.title || '').toLowerCase().trim();
            if (titleKey && !seenTitles.has(titleKey)) {
              seenTitles.add(titleKey);
              merged.push(localUp);
            }
          });
          try {
            localStorage.setItem(`earlylearn_student_uploads_${currentUserId}`, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        });
      }
    } catch {
      // fallback
    }
  }, [currentUserId, greetingName]);

  // Listen to teacher uploads in localStorage & Supabase Realtime across devices
  useEffect(() => {
    loadAnnouncements();
    loadDbMaterials();
    loadStudentSubmissions();

    // Ensure student registration is synced with teacher dashboard
    syncStudentLogin(null, profile);

    function handleStorageChange(e) {
      if (e.key === 'earlylearn_teacher_modules') {
        setTeacherUploadedModules(getCleanTeacherModulesList());
      }
      if (
        e.key === 'earlylearn_student_uploads' ||
        e.key === `earlylearn_student_uploads_${currentUserId}`
      ) {
        try {
          const updated = JSON.parse(e.newValue || '[]');
          setStudentUploads(updated);
        } catch {
          // ignore
        }
      }
    }
    function handleModulesEvent() {
      setTeacherUploadedModules(getCleanTeacherModulesList());
      loadDbMaterials();
      loadStudentSubmissions();
    }

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('earlylearn_modules_updated', handleModulesEvent);

    const channel = supabase
      .channel(`student-dashboard-sync-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
        loadDbMaterials();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        loadStudentSubmissions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        loadAnnouncements();
      })
      .subscribe();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('earlylearn_modules_updated', handleModulesEvent);
      supabase.removeChannel(channel);
    };
  }, [loadAnnouncements, loadDbMaterials, loadStudentSubmissions, currentUserId, profile]);

  // -------------------------------------------------------------------------
  // "MY ACTIVITIES": STRICTLY BASED ON:
  // 1) Teacher complied & uploaded activity
  // 2) MSWD Admin approved it
  // 3) Teacher posted it to this specific Student Dashboard (or their CDC class)
  // -------------------------------------------------------------------------
  const teacherActivities = useMemo(() => {
    const list = [];
    const seenByTitle = new Map();

    const studentTeacherName = (adviserInfo?.adviserName || '').trim().toLowerCase();
    const studentBarangayLower = (studentBarangay || profile?.barangay || '').trim().toLowerCase();
    const studentCdcLower = (adviserInfo?.cdcName || profile?.cdc_name || '').trim().toLowerCase();
    const studentTeacherId = profile?.teacher_id || profile?.assigned_teacher_id || null;
    const studentNameLower = (greetingName || '').trim().toLowerCase();

    // Helper: checks whether an activity belongs to THIS student's teacher/CDC/barangay
    const isActivityForMyTeacher = (mTeacherId, mTeacherName, mCdcName, mBarangay) => {
      if (!studentTeacherName && !studentBarangayLower && !studentCdcLower && !studentTeacherId) {
        return true;
      }

      if (studentTeacherId && mTeacherId && String(studentTeacherId).trim() === String(mTeacherId).trim()) {
        return true;
      }

      const normModTeacher = (mTeacherName || '').toLowerCase().trim();
      if (
        studentTeacherName &&
        normModTeacher &&
        (normModTeacher.includes(studentTeacherName) || studentTeacherName.includes(normModTeacher))
      ) {
        return true;
      }

      const normModCdc = (mCdcName || '').toLowerCase().trim();
      if (
        studentCdcLower &&
        normModCdc &&
        (normModCdc === studentCdcLower ||
          normModCdc.includes(studentCdcLower) ||
          studentCdcLower.includes(normModCdc))
      ) {
        return true;
      }

      const normModBrgy = (mBarangay || '').toLowerCase().trim();
      if (studentBarangayLower && normModBrgy && normModBrgy === studentBarangayLower) {
        return true;
      }

      return false;
    };

    const matchesStudentTarget = (targetId, targetName, mTeacherId, mTeacherName, mCdcName, mBarangay) => {
      if (targetId && targetId !== 'all') {
        if (String(targetId) === String(currentUserId)) return true;
        const normTargetName = (targetName || '').toLowerCase().trim();
        if (studentNameLower && normTargetName && normTargetName.includes(studentNameLower)) return true;
        return false;
      }
      return isActivityForMyTeacher(mTeacherId, mTeacherName, mCdcName, mBarangay);
    };

    // 1. Load from Supabase dbMaterials first so cross-device IDs & files are primary
    (dbMaterials || []).forEach((m) => {
      if (m.title && !m.title.startsWith('[MSWD_ASSIGNMENT]')) {
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

        const isPostedToStudent =
          meta.posted_to_students === true ||
          (m.status === 'approved' && meta.posted_to_students !== false);

        const isTargetedToMe = matchesStudentTarget(
          meta.target_student_id,
          meta.target_student_name,
          m.created_by,
          meta.teacher_name,
          meta.cdc_name,
          meta.barangay
        );

        const titleKey = m.title.toLowerCase().trim();
        if (isPostedToStudent && isTargetedToMe && !seenByTitle.has(titleKey)) {
          const item = {
            id: m.id,
            title: m.title,
            category_id: m.category_id,
            category_name: meta.sub_theme || meta.theme || m.categories?.name || 'Class Activity',
            type: 'activity',
            module_type: meta.module_type || m.type || 'activity',
            icon: m.categories?.icon || '✏️',
            content_text: cleanDescription || 'Teacher-assigned learning activity.',
            content_url: m.content_url || null,
            file_name: meta.file_name || '',
            file_type: meta.file_type || '',
            file_size: meta.file_size || '',
            teacher_name: meta.teacher_name || 'CDC Teacher',
            cdc_name: meta.cdc_name || '',
            target_student_name: meta.target_student_name || null,
            created_at: meta.posted_at || m.created_at,
          };
          seenByTitle.set(titleKey, item);
          list.push(item);
        }
      }
    });

    // 2. Merge localStorage teacherUploadedModules (filling in any local file data or local-only items)
    (teacherUploadedModules || []).forEach((m) => {
      const isActualTeacherUpload =
        m.is_custom_teacher_upload === true ||
        (m.id && m.id.startsWith('mod-') && !m.id.match(/^mod-0[1-9]/)) ||
        (m.teacher_id && m.teacher_id !== 'system');

      // 1. MSWD Approval Gate
      const isApproved =
        (m.status === 'Approved' || m.status === 'approved' || m.verified_by_mswd === true) &&
        m.status !== 'Rejected' &&
        m.status !== 'Needs Revision';

      // 2. Teacher Post-Approval Gate: Teacher must post the approved activity to the Student Dashboard
      const isPostedToStudent = m.posted_to_students === true;

      const isTargetedToMe = matchesStudentTarget(
        m.target_student_id,
        m.target_student_name,
        m.teacher_id,
        m.teacher_name,
        m.cdc_name,
        m.barangay
      );

      if (isActualTeacherUpload && isApproved && isPostedToStudent && isTargetedToMe && m.title) {
        const titleKey = m.title.toLowerCase().trim();
        if (seenByTitle.has(titleKey)) {
          const existing = seenByTitle.get(titleKey);
          if (!existing.content_url && m.content_url) existing.content_url = m.content_url;
          if (!existing.file_name && m.file_name) existing.file_name = m.file_name;
          if (!existing.file_type && m.file_type) existing.file_type = m.file_type;
          if (!existing.file_size && m.file_size) existing.file_size = m.file_size;
          if (!existing.module_type && m.module_type) existing.module_type = m.module_type;
        } else {
          const item = {
            id: m.id,
            title: m.title,
            category_id: m.category_id,
            category_name: m.sub_theme || m.theme || m.category_name || 'Class Activity',
            type: 'activity',
            module_type: m.module_type || m.type || 'activity',
            icon: '✏️',
            content_text: m.description || m.content_text || 'Teacher-guided early childhood activity.',
            content_url: m.content_url || null,
            file_name: m.file_name || '',
            file_type: m.file_type || '',
            file_size: m.file_size || '',
            teacher_name: m.teacher_name || 'CDC Teacher',
            cdc_name: m.cdc_name || '',
            target_student_name: m.target_student_name || null,
            created_at: m.posted_at || m.upload_date || 'Recent',
          };
          seenByTitle.set(titleKey, item);
          list.push(item);
        }
      }
    });

    return list;
  }, [teacherUploadedModules, dbMaterials, adviserInfo, studentBarangay, profile, currentUserId, greetingName]);

  const isActivityCompleted = useCallback(
    (a) => {
      if (!a) return false;
      const titleKey = (a.title || '').toLowerCase().trim();
      return completedIds.has(a.id) || (titleKey && completedIds.has(titleKey));
    },
    [completedIds]
  );

  const pendingTeacherActivities = useMemo(() => {
    return teacherActivities.filter((a) => !isActivityCompleted(a));
  }, [teacherActivities, isActivityCompleted]);

  const completedTeacherActivities = useMemo(() => {
    return teacherActivities.filter((a) => isActivityCompleted(a));
  }, [teacherActivities, isActivityCompleted]);

  // Helper to check if a specific teacher activity has been checked by the teacher
  const isActivityCheckedByTeacher = useCallback(
    (a) => {
      if (!a) return false;
      const titleKey = (a.title || '').toLowerCase().trim();
      const sub = submissionsByMaterial[a.id] || (titleKey ? submissionsByMaterial[titleKey] : null);
      return Boolean(sub?.teacher_checked || sub?.status === 'checked' || sub?.status === 'reviewed');
    },
    [submissionsByMaterial]
  );

  // Accurate, deduplicated real-time progress count (never double-counts teacher activities in studentUploads)
  const { totalCompletedCount, totalTasksCount, progressPct, checkedActivitiesCount } = useMemo(() => {
    const teacherTitleSet = new Set(
      teacherActivities.map((a) => (a.title || '').toLowerCase().trim()).filter(Boolean)
    );
    const standaloneUploads = (studentUploads || []).filter((u) => {
      const t = (u.title || '').toLowerCase().trim();
      return t && !teacherTitleSet.has(t);
    });

    const completedCount = completedTeacherActivities.length + standaloneUploads.length;
    const tasksCount = teacherActivities.length + standaloneUploads.length;
    const pct = tasksCount > 0 ? Math.min(100, Math.round((completedCount / tasksCount) * 100)) : 0;

    const checkedTeacher = completedTeacherActivities.filter((a) => isActivityCheckedByTeacher(a)).length;
    const checkedStandalone = standaloneUploads.filter(
      (u) => u.teacherChecked || (u.status || '').toLowerCase().includes('checked')
    ).length;

    return {
      totalCompletedCount: completedCount,
      totalTasksCount: tasksCount,
      progressPct: pct,
      checkedActivitiesCount: checkedTeacher + checkedStandalone,
    };
  }, [teacherActivities, completedTeacherActivities, studentUploads, isActivityCheckedByTeacher]);

  // --- Category Card Click ---
  function openCategory(cat) {
    setCurrentCategory(cat);
    setSelectedStory(null);
    setActiveFlashcardIndex(null);
    setStoryLanguageTab('both');
    setView('category_detail');
  }

  function openMaterial(m, from) {
    setBackTarget(from);
    setCurrentMaterial(m);
    const titleKey = (m?.title || '').toLowerCase().trim();
    const existingSub = submissionsByMaterial[m?.id] || (titleKey ? submissionsByMaterial[titleKey] : null);

    setAnswer(existingSub?.answer_text || '');
    setActivityFilePreview(existingSub?.file_url || null);
    setActivityFileName(existingSub?.file_name || '');
    setActivityFileType(existingSub?.file_type || '');
    setActivityFileSize(existingSub?.file_size || '');
    setDoneMsg(
      existingSub
        ? { text: '✅ You already submitted this activity. You can update your answer or file anytime!', error: false }
        : { text: '', error: false }
    );
    setSubmitted(Boolean(existingSub));
    setView('content');
  }

  function handleActivityFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setActivityFileName(file.name);
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    setActivityFileType(ext);
    const sizeKB = file.size / 1024;
    const sizeFormatted =
      sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sizeKB))} KB`;
    setActivityFileSize(sizeFormatted);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setActivityFilePreview(ev.target?.result || null);
      setSubmitted(false);
    };
    reader.readAsDataURL(file);
  }

  async function submitAnswer() {
    const trimmed = answer.trim();
    if (!trimmed && !activityFilePreview) {
      setDoneMsg({
        text: '⚠️ Please write your answer/comment OR attach a file/image before submitting.',
        error: true,
      });
      return;
    }

    setSubmittingAnswer(true);
    setDoneMsg({ text: '', error: false });

    const titleKey = (currentMaterial.title || '').toLowerCase().trim();
    const existingSub =
      submissionsByMaterial[currentMaterial.id] ||
      (titleKey ? submissionsByMaterial[titleKey] : null);
    const wasChecked = Boolean(existingSub?.teacher_checked);

    const updated = new Set(completedIds);
    updated.add(currentMaterial.id);
    if (titleKey) updated.add(titleKey);
    setCompletedIds(updated);
    try {
      localStorage.setItem(`earlylearn_done_${currentUserId}`, JSON.stringify(Array.from(updated)));
    } catch {
      // ignore
    }

    const uploadedAtStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const submissionPayload = JSON.stringify({
      __submission_meta: true,
      answer_text: trimmed || (activityFileName ? `Attached file: ${activityFileName}` : 'Submitted activity'),
      student_id: currentUserId,
      student_name: greetingName,
      material_id: currentMaterial.id,
      material_title: currentMaterial.title,
      category: currentMaterial.category_name || 'Teacher Assigned Activity',
      file_url: activityFilePreview || null,
      file_name: activityFileName || '',
      file_type: activityFileType || '',
      file_size: activityFileSize || '',
      uploaded_at: uploadedAtStr,
      teacher_checked: wasChecked,
    });

    let savedSubId = existingSub?.id || 'sub-' + Date.now();
    try {
      const isMatUuid =
        typeof currentMaterial.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentMaterial.id);
      const isExistingSubUuid =
        typeof existingSub?.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingSub.id);

      if (isExistingSubUuid) {
        await supabase
          .from('submissions')
          .update({
            answer_text: submissionPayload,
            status: wasChecked ? 'checked' : 'submitted',
          })
          .eq('id', existingSub.id);
      } else {
        const { data: inserted } = await supabase
          .from('submissions')
          .insert({
            material_id: isMatUuid ? currentMaterial.id : null,
            student_id: currentUserId,
            answer_text: submissionPayload,
            status: 'submitted',
          })
          .select('id')
          .single();
        if (inserted?.id) savedSubId = inserted.id;
      }
    } catch (err) {
      console.warn('Supabase submission save error:', err);
    }

    // Update local submissions map & studentUploads so it appears immediately everywhere (1 record per activity)
    const newSubEntry = {
      id: savedSubId,
      material_id: currentMaterial.id,
      material_title: currentMaterial.title,
      answer_text: trimmed,
      file_url: activityFilePreview || null,
      file_name: activityFileName || '',
      file_type: activityFileType || '',
      file_size: activityFileSize || '',
      status: wasChecked ? 'checked' : 'submitted',
      teacher_checked: wasChecked,
      created_at: new Date().toISOString(),
    };
    setSubmissionsByMaterial((prev) => ({
      ...prev,
      [currentMaterial.id]: newSubEntry,
      ...(titleKey ? { [titleKey]: newSubEntry } : {}),
    }));

    const newUploadItem = {
      id: savedSubId,
      studentId: currentUserId,
      studentName: greetingName,
      title: currentMaterial.title,
      category: currentMaterial.category_name || 'Teacher Assigned Activity',
      note: trimmed,
      mediaUrl: activityFilePreview || null,
      fileName: activityFileName || '',
      fileType: activityFileType || '',
      fileSize: activityFileSize || '',
      uploadedAt: uploadedAtStr,
      teacherChecked: wasChecked,
      status: wasChecked ? 'Checked by Teacher ✅' : 'Submitted • Waiting for Teacher',
    };

    const updatedUploads = [
      newUploadItem,
      ...studentUploads.filter((u) => (u.title || '').toLowerCase().trim() !== titleKey),
    ];
    setStudentUploads(updatedUploads);
    try {
      localStorage.setItem(`earlylearn_student_uploads_${currentUserId}`, JSON.stringify(updatedUploads));
      localStorage.setItem('earlylearn_student_uploads', JSON.stringify(updatedUploads));
    } catch {
      // ignore
    }

    setSubmittingAnswer(false);
    setDoneMsg({
      text: '🎉 Nice! Your answer and file have been saved and submitted to your teacher across all devices!',
      error: false,
    });
    setSubmitted(true);
  }

  // --- Student Upload Submission ---
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFileName(file.name);
      const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
      setUploadFileType(ext);
      const sizeKB = file.size / 1024;
      const sizeFormatted =
        sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sizeKB))} KB`;
      setUploadFileSize(sizeFormatted);

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setUploadFilePreview(uploadEvent.target?.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleStudentUploadSubmit(e) {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadMsg({ text: '⚠️ Please provide a title for your activity.', type: 'error' });
      return;
    }

    setUploading(true);
    setUploadMsg({ text: '', type: '' });

    const uploadedAtStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newUpload = {
      id: 'stu-up-' + Date.now(),
      studentId: currentUserId,
      studentName: greetingName,
      title: uploadTitle.trim(),
      category: uploadCategory,
      note: uploadNote.trim(),
      mediaUrl: uploadFilePreview || null,
      fileName: uploadFileName || '',
      fileType: uploadFileType || '',
      fileSize: uploadFileSize || '',
      uploadedAt: uploadedAtStr,
      status: 'Submitted to Teacher',
    };

    const updatedUploads = [newUpload, ...studentUploads];
    setStudentUploads(updatedUploads);

    try {
      localStorage.setItem(
        `earlylearn_student_uploads_${currentUserId}`,
        JSON.stringify(updatedUploads)
      );
      localStorage.setItem('earlylearn_student_uploads', JSON.stringify(updatedUploads));
    } catch {
      // ignore
    }

    try {
      const submissionPayload = JSON.stringify({
        __submission_meta: true,
        answer_text: uploadNote.trim() || `Uploaded work: ${uploadTitle.trim()}`,
        student_id: currentUserId,
        student_name: greetingName,
        material_id: null,
        material_title: uploadTitle.trim(),
        category: uploadCategory,
        file_url: uploadFilePreview || null,
        file_name: uploadFileName || '',
        file_type: uploadFileType || '',
        file_size: uploadFileSize || '',
        uploaded_at: uploadedAtStr,
      });

      await supabase.from('submissions').insert({
        student_id: currentUserId,
        answer_text: submissionPayload,
        status: 'submitted',
      });
    } catch (err) {
      console.warn('Note on Supabase submission insert:', err);
    }

    setUploading(false);
    setUploadMsg({ text: '🎉 Activity uploaded successfully! Your teacher will review it.', type: 'ok' });

    setTimeout(() => {
      setIsUploadModalOpen(false);
      setUploadTitle('');
      setUploadNote('');
      setUploadFilePreview(null);
      setUploadFileName('');
      setUploadFileType('');
      setUploadFileSize('');
      setUploadMsg({ text: '', type: '' });
      setActivityTab('student_uploads');
    }, 1200);
  }

  return (
    <div className="min-h-screen font-nunito text-[#3a3226] bg-[#FFF8EB] sm:bg-gradient-to-b sm:from-[#FFF6DA] sm:to-[#FFEFC2]">
      <div className="max-w-[620px] mx-auto px-4.5 sm:px-5 pt-6 pb-16 text-center">
        {/* HEADER BAR */}
        <div className="flex justify-between items-center mb-4.5">
          <div className="text-left">
            <h1 className="font-baloo text-2xl sm:text-[26px] font-bold m-0 text-left text-[#3a3226] flex items-center gap-1.5">
              <span>👋</span> Hi, {greetingName}!
            </h1>
            <p className="text-[13.5px] sm:text-[14px] text-[#6b5c42] mt-0.5 font-medium m-0">
              Choose what you'd like to learn
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="border-none bg-white rounded-2xl px-4 py-2 font-extrabold text-[13px] text-[#C9553F] cursor-pointer shadow-flat hover:bg-rose-50 transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* ======================================================== */}
        {/* 👩‍🏫 CLASS ADVISER & DAY CARE CENTER DISPLAY               */}
        {/* ======================================================== */}
        <div className="bg-white/95 rounded-2xl p-3.5 sm:p-4 mb-4 text-left shadow-soft border border-[#F4E8D0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#FFE082] to-[#FFB74D] flex items-center justify-center text-2xl shadow-xs shrink-0 border border-amber-200">
              👩‍🏫
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                  Class Adviser
                </span>
                {adviserInfo.barangay && (
                  <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    📍 Brgy. {adviserInfo.barangay}
                  </span>
                )}
              </div>
              <div className="font-baloo text-[16px] sm:text-[17px] font-bold text-[#3a3226] leading-snug mt-0.5 truncate">
                Teacher {adviserInfo.adviserName.replace(/^Teacher\s+/i, '')}
              </div>
              <div className="text-[12px] text-slate-500 font-medium truncate">
                🏫 {adviserInfo.cdcName}
              </div>
            </div>
          </div>

          <div className="hidden xs:flex flex-col items-end shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Enrolled
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: HOME VIEW                                        */}
        {/* ======================================================== */}
        {view === 'home' && (
          <div>
            {/* Announcements (if any) */}
            {announcements.length > 0 && (
              <div className="mb-3.5">
                <div className="text-xs font-extrabold text-[#6b5c42] text-left mb-2">
                  📢 Announcements
                </div>
                {announcements.map((a, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl px-4 py-3 text-left mb-2 shadow-soft border-l-[5px] border-[#FFB84D]"
                  >
                    <div className="font-baloo font-bold text-[14.5px] mb-0.5">{a.title}</div>
                    <div className="text-[12.5px] text-[#6b6355]">{a.message}</div>
                  </div>
                ))}
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 📝 MY ACTIVITIES SECTION                                 */}
            {/* -------------------------------------------------------- */}
            <div className="mb-5.5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-extrabold text-[#6b5c42] flex items-center gap-1.5">
                  <span>📝</span> My Activities
                  {pendingTeacherActivities.length > 0 && (
                    <span className="text-[10.5px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2 py-0.5 rounded-full ml-1">
                      {pendingTeacherActivities.length} to do
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-coral hover:bg-coral-deep text-white text-xs font-extrabold flex items-center gap-1 shadow-bump active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <span>📤</span>
                  <span>+ Upload My Activity</span>
                </button>
              </div>

              {/* Sub-Tabs: Teacher's Uploads vs Student's Uploaded Works */}
              <div className="flex items-center gap-1.5 p-1 bg-white/70 rounded-xl mb-3 border border-[#F0E4CE]">
                <button
                  onClick={() => setActivityTab('teacher')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activityTab === 'teacher'
                      ? 'bg-white text-dash-ink shadow-xs'
                      : 'text-dash-ink-soft hover:text-dash-ink'
                  }`}
                >
                  Teacher's Uploads ({teacherActivities.length})
                </button>
                <button
                  onClick={() => setActivityTab('student_uploads')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activityTab === 'student_uploads'
                      ? 'bg-white text-dash-ink shadow-xs'
                      : 'text-dash-ink-soft hover:text-dash-ink'
                  }`}
                >
                  My Uploaded Works ({studentUploads.length})
                </button>
              </div>

              {/* TAB 1: TEACHER ASSIGNED ACTIVITIES */}
              {activityTab === 'teacher' && (
                <div>
                  {teacherActivities.length === 0 ? (
                    <div className="bg-white rounded-2xl p-5 text-center shadow-soft border border-[#F0E4CE]">
                      <div className="text-2xl mb-1">🎈</div>
                      <div className="font-baloo font-bold text-base text-[#3a3226]">
                        No Teacher Activities at the Moment
                      </div>
                      <div className="text-xs text-[#7a7a7a] mt-1 max-w-sm mx-auto">
                        Your teacher hasn't uploaded any new activities yet. You can upload your own drawing or file using the button above!
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingTeacherActivities.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => openMaterial(a, 'home')}
                          className="bg-white rounded-2xl px-4 py-3.5 text-left shadow-soft flex items-center gap-3.5 cursor-pointer border-l-[5px] border-leaf hover:translate-x-0.5 transition-transform"
                        >
                          <div className="text-3xl flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-[#E8F5E9] text-leaf">
                            {a.icon || '✏️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-baloo font-bold text-[15.5px] text-[#3a3226] truncate">
                              {a.title}
                            </div>
                            <div className="text-[11.5px] text-[#7a7a7a] font-bold flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span>{a.category_name}</span>
                              {a.teacher_name && (
                                <>
                                  <span>•</span>
                                  <span className="text-accent font-semibold">{a.teacher_name}</span>
                                </>
                              )}
                              {(a.content_url || a.file_name) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold">
                                  📎 {a.file_name || a.file_type || 'Teacher File Attached'}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-leaf bg-emerald-50 px-2.5 py-1.5 rounded-lg shrink-0">
                            Start →
                          </span>
                        </div>
                      ))}

                      {completedTeacherActivities.length > 0 && (
                        <div className="pt-2 space-y-2">
                          <div className="text-[11px] font-extrabold text-[#6b5c42] text-left px-1 flex items-center gap-1">
                            <span>✅</span> Completed Teacher Activities ({completedTeacherActivities.length})
                          </div>
                          {completedTeacherActivities.map((a) => {
                            const checkedByTeacher = isActivityCheckedByTeacher(a);
                            return (
                              <div
                                key={a.id}
                                onClick={() => openMaterial(a, 'home')}
                                className="bg-white/90 rounded-2xl px-4 py-3 text-left shadow-xs flex items-center gap-3.5 cursor-pointer border-l-[5px] border-emerald-400 hover:translate-x-0.5 transition-transform"
                              >
                                <div className="text-2xl flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600">
                                  {checkedByTeacher ? '🌟' : '✅'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-baloo font-bold text-[14.5px] text-[#3a3226] truncate">
                                    {a.title}
                                  </div>
                                  <div className="text-[11px] text-[#7a7a7a] font-bold flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span>{a.category_name}</span>
                                    {(a.content_url || a.file_name) && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-extrabold">
                                        📎 {a.file_name || 'File'}
                                      </span>
                                    )}
                                    {checkedByTeacher ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                                        👩‍🏫 Checked by Teacher ✅
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black">
                                        ⏳ Waiting for Teacher Check
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                                  View / Edit →
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: STUDENT'S OWN UPLOADED WORKS */}
              {activityTab === 'student_uploads' && (
                <div>
                  {studentUploads.length === 0 ? (
                    <div className="bg-white rounded-2xl p-5 text-center shadow-soft border border-[#F0E4CE]">
                      <div className="text-2xl mb-1">🎨</div>
                      <div className="font-baloo font-bold text-base text-[#3a3226]">
                        No Uploaded Activities Yet
                      </div>
                      <div className="text-xs text-[#7a7a7a] mt-1 mb-3">
                        Upload an image or file of your drawing, coloring sheet, or homework directly to your teacher!
                      </div>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-coral hover:bg-coral-deep text-white font-bold text-xs shadow-bump cursor-pointer"
                      >
                        📸 Upload Your First Activity
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {studentUploads.map((u) => {
                        const isImg =
                          u.mediaUrl?.startsWith('data:image') ||
                          /\.(png|jpe?g|gif|webp|svg)$/i.test(u.fileName || '') ||
                          ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes((u.fileType || '').toUpperCase());

                        return (
                          <div
                            key={u.id}
                            className="bg-white rounded-2xl p-3.5 text-left shadow-soft flex items-start gap-3 border-l-[5px] border-[#FFB84D]"
                          >
                            {u.mediaUrl && isImg ? (
                              <img
                                src={u.mediaUrl}
                                alt={u.title}
                                onClick={() => handleOpenOrDownloadFile(u.mediaUrl, u.fileName || 'activity-image.png', 'view')}
                                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-200 cursor-pointer hover:opacity-90"
                              />
                            ) : u.mediaUrl ? (
                              <div
                                onClick={() => handleOpenOrDownloadFile(u.mediaUrl, u.fileName || 'activity-file', 'view')}
                                className="w-14 h-14 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex flex-col items-center justify-center shrink-0 font-extrabold text-[10px] cursor-pointer hover:bg-blue-100"
                              >
                                <span className="text-xl">📄</span>
                                <span>{u.fileType || 'FILE'}</span>
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shrink-0 font-bold">
                                🖼️
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-baloo font-bold text-[15px] text-[#3a3226] m-0 truncate">
                                  {u.title}
                                </h4>
                                {u.teacherChecked || (u.status || '').toLowerCase().includes('checked') ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                    👩‍🏫 Checked by Teacher ✅
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                    ⏳ Waiting for Teacher Check
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-dash-ink-soft mt-0.5">
                                Subject: <b className="text-[#3a3226]">{u.category}</b> • {u.uploadedAt}
                              </div>
                              {u.note && (
                                <p className="text-xs text-[#5a4d38] mt-1 leading-snug line-clamp-2 m-0 bg-[#FFFDF8] p-1.5 rounded-lg border border-[#F0E4CE]">
                                  "{u.note}"
                                </p>
                              )}
                              {u.mediaUrl && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrDownloadFile(u.mediaUrl, u.fileName || 'student-upload', 'view')}
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10.5px] font-extrabold cursor-pointer"
                                  >
                                    👁️ View {u.fileName ? `(${u.fileName})` : 'File'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrDownloadFile(u.mediaUrl, u.fileName || 'student-upload', 'download')}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-extrabold cursor-pointer"
                                  >
                                    ⬇️ Download
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* -------------------------------------------------------- */}
            {/* 6 BILINGUAL CATEGORY CARDS (English & Bisaya)            */}
            {/* -------------------------------------------------------- */}
            <div className="text-left mb-2">
              <span className="text-xs font-extrabold text-[#6b5c42]">
                📚 Explore &amp; Learn (English &amp; Bisaya)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 my-3">
              {categories.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => openCategory(c)}
                  className={`group relative border-none rounded-[24px] py-4.5 px-3 flex flex-col items-center gap-2 font-baloo font-bold text-white cursor-pointer shadow-bump transition-all hover:scale-[1.02] active:translate-y-1 active:shadow-bump-active ${
                    PALETTES[i % PALETTES.length]
                  }`}
                >
                  {/* Custom 3D Badge / Icon */}
                  <CategoryBadge
                    id={c.id}
                    className="w-16 h-16 shrink-0 transition-transform group-hover:scale-105 drop-shadow-sm"
                  />

                  <div className="text-center leading-tight">
                    <div className="text-[17px] font-black tracking-tight drop-shadow-xs">
                      {c.name}
                    </div>
                    <div className="text-xs font-bold opacity-90 drop-shadow-xs italic">
                      {c.bisayaName}
                    </div>
                  </div>

                  <span className="text-[10.5px] font-extrabold bg-black/15 text-white/95 px-2.5 py-0.5 rounded-full mt-0.5">
                    {c.items?.length || 0} items • English &amp; Bisaya
                  </span>
                </button>
              ))}
            </div>

            {/* -------------------------------------------------------- */}
            {/* ⭐ MY PROGRESS SECTION                                    */}
            {/* -------------------------------------------------------- */}
            <div className="bg-white rounded-[20px] px-5.5 py-4 shadow-soft mt-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs text-[#6b5c42] font-extrabold text-left">
                  ⭐ My Progress (Real-Time)
                </div>
                {totalCompletedCount > 0 && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                      checkedActivitiesCount > 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {checkedActivitiesCount > 0
                      ? `👩‍🏫 ${checkedActivitiesCount} of ${totalCompletedCount} Checked by Teacher ✅`
                      : '⏳ Waiting for Teacher Check'}
                  </span>
                )}
              </div>
              <div className="bg-[#F0E9D6] rounded-[20px] h-4 overflow-hidden">
                <div
                  className="h-full rounded-[20px] transition-[width] duration-300"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #FFB84D, #FF8C69)',
                  }}
                />
              </div>
              <div className="mt-2 text-[15px] font-bold text-[#3a3226]">
                {totalTasksCount === 0
                  ? '🌟 No assigned activities yet — check back soon!'
                  : `🌟 ${totalCompletedCount} of ${totalTasksCount} ${
                      totalTasksCount === 1 ? 'activity' : 'activities'
                    } completed!`}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: CATEGORY BILINGUAL CONTENT EXPLORER             */}
        {/* ======================================================== */}
        {view === 'category_detail' && currentCategory && (
          <div className="space-y-4 text-left">
            <button
              onClick={() => setView('home')}
              className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
            >
              ⬅ Back to Home
            </button>

            {/* Category Header Banner */}
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-[#F0E4CE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CategoryBadge id={currentCategory.id} className="w-16 h-16 shrink-0 drop-shadow-sm" />
                <div>
                  <h2 className="font-baloo text-2xl font-black text-[#3a3226] m-0 flex items-center gap-2 flex-wrap">
                    <span>{currentCategory.name}</span>
                    <span className="text-accent text-lg font-bold">• {currentCategory.bisayaName}</span>
                  </h2>
                  <p className="text-xs text-[#6b5c42] mt-0.5 m-0 font-medium">
                    {currentCategory.subtitle} • <span className="italic">{currentCategory.subtitleBisaya}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    playAudioWord(`${currentCategory.name}. ${currentCategory.bisayaName}`, 'en-US');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#8C6200] font-baloo font-bold text-xs flex items-center gap-1.5 border border-amber-200 transition-colors cursor-pointer"
                  title="Pronounce Category"
                >
                  <span>🔊</span>
                  <span>Listen / Paminaw</span>
                </button>
                <span className="text-xs font-bold text-[#6b5c42] bg-[#F7F2E7] px-3 py-1.5 rounded-xl">
                  {currentCategory.items.length} items
                </span>
              </div>
            </div>

            {/* Instruction Banner for Toddlers & Parents */}
            <div className="bg-[#FFFDF8] rounded-2xl px-4 py-2.5 border border-[#F0E4CE] flex items-center justify-between text-xs text-[#6b5c42]">
              <div className="flex items-center gap-2">
                <span>💡</span>
                <span>Tap any card to view large flashcard • Pindota ang kard aron makita sa dako</span>
              </div>
              <span className="text-[11px] font-bold text-accent">English &amp; Bisaya</span>
            </div>

            {/* 1. ALPHABET / ALPETO BILINGUAL CARDS (A-Z) */}
            {currentCategory.id === 'cat-alphabet' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {currentCategory.items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveFlashcardIndex(idx)}
                    className="group bg-white rounded-2xl p-4 shadow-soft border border-[#F0E4CE] text-center space-y-2 cursor-pointer hover:border-coral hover:translate-y-[-2px] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-baloo text-2xl font-black text-coral">
                          {item.letter}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.phonetic}
                        </span>
                      </div>
                      <div className="text-5xl my-2 transform group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div className="font-baloo font-bold text-lg text-[#3a3226] leading-tight">
                        {item.english}
                      </div>
                      <div className="text-xs font-bold text-accent bg-orange-50 px-2 py-0.5 rounded-full inline-block mt-1">
                        {item.bisaya}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 mt-2">
                      <div className="text-[10.5px] text-[#7a7a7a] font-medium leading-tight mb-2 line-clamp-1">
                        {item.note}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudioWord(item.english, 'en-US');
                          }}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-extrabold flex items-center gap-1 transition-colors"
                          title="Listen in English"
                        >
                          🔊 EN
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudioWord(item.bisaya, 'fil-PH');
                          }}
                          className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10.5px] font-extrabold flex items-center gap-1 transition-colors"
                          title="Paminaw sa Bisaya"
                        >
                          🔊 BSY
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. NUMBERS / MGA NUMERO BILINGUAL CARDS (0 to 10) */}
            {currentCategory.id === 'cat-numbers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currentCategory.items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveFlashcardIndex(idx)}
                    className="group bg-white rounded-2xl p-4 shadow-soft border border-[#F0E4CE] text-left flex items-center gap-4 cursor-pointer hover:border-turquoise hover:translate-y-[-2px] transition-all"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] text-white flex items-center justify-center font-baloo text-3xl font-black shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      {item.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-baloo font-bold text-lg text-[#3a3226]">
                          {item.english} • <span className="text-accent">{item.bisaya}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudioWord(item.english, 'en-US');
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold"
                            title="English"
                          >
                            🔊 EN
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudioWord(item.bisaya, 'fil-PH');
                            }}
                            className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold"
                            title="Bisaya"
                          >
                            🔊 BSY
                          </button>
                        </div>
                      </div>
                      <div className="text-xl my-1 tracking-wider">{item.visual}</div>
                      <div className="text-xs text-[#6b5c42] font-semibold">
                        {item.countText}
                      </div>
                      <div className="text-[11px] text-[#8C7A63] mt-0.5">
                        {item.sample}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. COLORS / MGA KOLOR BILINGUAL CARDS (10 Colors) */}
            {currentCategory.id === 'cat-colors' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                {currentCategory.items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveFlashcardIndex(idx)}
                    className="group bg-white rounded-2xl p-4 shadow-soft border border-[#F0E4CE] text-center space-y-2 cursor-pointer hover:border-[#FFD93D] hover:translate-y-[-2px] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div
                        className="w-16 h-16 rounded-full mx-auto border-4 border-white shadow-md flex items-center justify-center text-2xl group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: item.colorHex, color: item.textColor || '#FFFFFF' }}
                      >
                        {item.icon}
                      </div>
                      <div className="mt-2.5">
                        <div className="font-baloo font-bold text-base text-[#3a3226] leading-tight">
                          {item.english}
                        </div>
                        <div className="text-xs font-bold text-accent">
                          {item.bisaya}
                        </div>
                      </div>
                      <div className="text-[11px] text-[#7a7a7a] leading-tight mt-1">
                        {item.sample}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudioWord(item.english, 'en-US');
                        }}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-extrabold"
                      >
                        🔊 EN
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudioWord(item.bisaya, 'fil-PH');
                        }}
                        className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10.5px] font-extrabold"
                      >
                        🔊 BSY
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. SHAPES / MGA PORMA BILINGUAL CARDS (8 Shapes) */}
            {currentCategory.id === 'cat-shapes' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {currentCategory.items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveFlashcardIndex(idx)}
                    className="group bg-white rounded-2xl p-4 shadow-soft border border-[#F0E4CE] text-center space-y-2 cursor-pointer hover:border-leaf hover:translate-y-[-2px] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-5xl my-1 group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div className="font-baloo font-bold text-base text-[#3a3226]">
                        {item.english}
                      </div>
                      <div className="text-xs font-bold text-[#2E7D32] bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block mt-0.5">
                        {item.bisaya}
                      </div>
                      <div className="text-[11px] text-[#7a7a7a] leading-tight pt-1.5 line-clamp-2">
                        {item.sample}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudioWord(item.english, 'en-US');
                        }}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-extrabold"
                      >
                        🔊 EN
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudioWord(item.bisaya, 'fil-PH');
                        }}
                        className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10.5px] font-extrabold"
                      >
                        🔊 BSY
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 5. ANIMALS / MGA HAYOP BILINGUAL CARDS (12 Animals) */}
            {currentCategory.id === 'cat-animals' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {currentCategory.items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveFlashcardIndex(idx)}
                    className="group bg-white rounded-2xl p-4 shadow-soft border border-[#F0E4CE] text-center space-y-1.5 cursor-pointer hover:border-purple hover:translate-y-[-2px] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-5xl my-1 group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div className="font-baloo font-bold text-base text-[#3a3226]">
                        {item.english}
                      </div>
                      <div className="text-xs font-bold text-[#6A1B9A] bg-purple-50 px-2 py-0.5 rounded-full inline-block">
                        {item.bisaya}
                      </div>
                      <div className="text-xs font-black text-coral pt-1">
                        Sound: "{item.sound}"
                      </div>
                      <div className="text-[10.5px] text-[#7a7a7a] leading-tight line-clamp-2 mt-1">
                        {item.note}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudioWord(item.english, 'en-US');
                        }}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-extrabold"
                      >
                        🔊 EN
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudioWord(item.bisaya, 'fil-PH');
                        }}
                        className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10.5px] font-extrabold"
                      >
                        🔊 BSY
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 6. STORIES / MGA SUGILANON BILINGUAL STORIES */}
            {currentCategory.id === 'cat-stories' && (
              <div className="space-y-4">
                {selectedStory ? (
                  <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#F0E4CE] space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <button
                        onClick={() => {
                          window.speechSynthesis?.cancel();
                          setSelectedStory(null);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#3a3226] cursor-pointer"
                      >
                        ⬅ Back to Stories List
                      </button>

                      {/* Language filter for reader */}
                      <div className="flex items-center gap-1 p-1 bg-amber-50 rounded-xl border border-amber-200">
                        <button
                          onClick={() => setStoryLanguageTab('both')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            storyLanguageTab === 'both' ? 'bg-white text-dash-ink shadow-xs' : 'text-[#8C6200]'
                          }`}
                        >
                          ✨ Both
                        </button>
                        <button
                          onClick={() => setStoryLanguageTab('en')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            storyLanguageTab === 'en' ? 'bg-white text-dash-ink shadow-xs' : 'text-[#8C6200]'
                          }`}
                        >
                          📖 English
                        </button>
                        <button
                          onClick={() => setStoryLanguageTab('bis')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            storyLanguageTab === 'bis' ? 'bg-white text-dash-ink shadow-xs' : 'text-[#8C6200]'
                          }`}
                        >
                          🌺 Bisaya
                        </button>
                      </div>
                    </div>

                    {/* Story Header */}
                    <div className="flex items-center gap-3.5 pb-2 border-b border-gray-100">
                      <span className="text-5xl">{selectedStory.icon}</span>
                      <div>
                        <div className="text-[11px] font-bold text-accent uppercase tracking-wider">
                          {selectedStory.theme}
                        </div>
                        <h3 className="font-baloo text-xl font-black text-[#3a3226] m-0">
                          {selectedStory.english}
                        </h3>
                        <div className="text-sm font-bold text-coral-deep italic">
                          {selectedStory.bisaya}
                        </div>
                      </div>
                    </div>

                    {/* Audio read-aloud buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => playAudioWord(selectedStory.storyEnglish, 'en-US')}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200"
                      >
                        <span>🔊</span>
                        <span>Read in English</span>
                      </button>
                      <button
                        onClick={() => playAudioWord(selectedStory.storyBisaya, 'fil-PH')}
                        className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-orange-200"
                      >
                        <span>🌺</span>
                        <span>Paminaw sa Bisaya</span>
                      </button>
                      <button
                        onClick={() => window.speechSynthesis?.cancel()}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>⏹️</span>
                        <span>Stop Audio</span>
                      </button>
                    </div>

                    {/* Story paragraphs */}
                    <div className="space-y-3 pt-2 text-sm leading-relaxed">
                      {(storyLanguageTab === 'both' || storyLanguageTab === 'en') && (
                        <div className="bg-amber-50/70 p-4.5 rounded-2xl border border-amber-200">
                          <div className="text-xs font-extrabold text-accent uppercase mb-1.5 flex items-center gap-1">
                            <span>📖</span>
                            <span>English Story</span>
                          </div>
                          <p className="m-0 text-[#3a3226] font-medium leading-relaxed text-[15px]">
                            {selectedStory.storyEnglish}
                          </p>
                        </div>
                      )}

                      {(storyLanguageTab === 'both' || storyLanguageTab === 'bis') && (
                        <div className="bg-orange-50/70 p-4.5 rounded-2xl border border-orange-200">
                          <div className="text-xs font-extrabold text-coral-deep uppercase mb-1.5 flex items-center gap-1">
                            <span>🌺</span>
                            <span>Sugilanon sa Bisaya</span>
                          </div>
                          <p className="m-0 text-[#3a3226] font-medium leading-relaxed text-[15px]">
                            {selectedStory.storyBisaya}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <span className="text-lg">💡</span>
                      <span>{selectedStory.lesson}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {currentCategory.items.map((story) => (
                      <div
                        key={story.id}
                        onClick={() => setSelectedStory(story)}
                        className="bg-white rounded-2xl p-4.5 shadow-soft border border-[#F0E4CE] flex items-start justify-between gap-3 cursor-pointer hover:border-orange hover:translate-y-[-2px] transition-all"
                      >
                        <div className="flex items-start gap-3.5">
                          <span className="text-4xl shrink-0 mt-0.5">{story.icon}</span>
                          <div>
                            <div className="text-[10.5px] font-bold text-accent uppercase">
                              {story.theme}
                            </div>
                            <div className="font-baloo font-bold text-base text-[#3a3226] leading-snug">
                              {story.english}
                            </div>
                            <div className="text-xs font-bold text-coral-deep italic">
                              {story.bisaya}
                            </div>
                            <div className="text-[11.5px] text-[#7a7a7a] mt-1.5 line-clamp-2">
                              {story.summary}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-accent bg-orange-50 px-2.5 py-1 rounded-lg shrink-0 mt-1">
                          Read →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: CONTENT VIEW (Doing teacher assigned activity)   */}
        {/* ======================================================== */}
        {view === 'content' && currentMaterial && (() => {
          const teacherFileUrl = currentMaterial.content_url || null;
          const teacherFileName = currentMaterial.file_name || '';
          const teacherFileType = (currentMaterial.file_type || '').toUpperCase();
          const teacherFileSize = currentMaterial.file_size || '';

          const isTeacherImage =
            teacherFileUrl &&
            (teacherFileUrl.startsWith('data:image/') ||
              /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(teacherFileName || teacherFileUrl) ||
              ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(teacherFileType) ||
              currentMaterial.module_type === 'image');

          const isTeacherVideo =
            teacherFileUrl &&
            (teacherFileUrl.startsWith('data:video/') ||
              /\.(mp4|webm|ogg|mov)$/i.test(teacherFileName || teacherFileUrl) ||
              ['MP4', 'WEBM', 'MOV', 'VIDEO'].includes(teacherFileType) ||
              currentMaterial.module_type === 'video');

          const isTeacherPdf =
            teacherFileUrl &&
            (teacherFileUrl.startsWith('data:application/pdf') ||
              /\.pdf$/i.test(teacherFileName || teacherFileUrl) ||
              teacherFileType === 'PDF');

          const isStudentFileImage =
            activityFilePreview &&
            (activityFilePreview.startsWith('data:image/') ||
              /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(activityFileName) ||
              ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(activityFileType));

          const isStudentFileVideo =
            activityFilePreview &&
            (activityFilePreview.startsWith('data:video/') ||
              /\.(mp4|webm|ogg|mov)$/i.test(activityFileName) ||
              ['MP4', 'WEBM', 'MOV'].includes(activityFileType));

          return (
            <div>
              <button
                onClick={() => setView(backTarget)}
                className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4 flex items-center gap-1.5"
              >
                ⬅ Back
              </button>
              <div className="bg-white rounded-[24px] p-6 text-left shadow-soft border border-[#F0E4CE]">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-accent flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#8C6200]">
                    {currentMaterial.category_name || 'Class Activity'}
                  </span>
                  {currentMaterial.teacher_name && (
                    <span>by {currentMaterial.teacher_name}</span>
                  )}
                </div>

                <h2 className="font-baloo text-2xl m-0 mb-3 text-[#3a3226]">
                  {currentMaterial.title}
                </h2>

                {currentMaterial.content_text && (
                  <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#F0E4CE] text-[16px] sm:text-[17px] leading-[1.6] text-[#3a3226] mb-4">
                    {currentMaterial.content_text}
                  </div>
                )}

                {/* ==================================================== */}
                {/* 📎 TEACHER'S UPLOADED FILE / LEARNING MATERIAL       */}
                {/* ==================================================== */}
                {(teacherFileUrl || teacherFileName) && (
                  <div className="mb-5 rounded-2xl border-2 border-[#E2ECF8] bg-[#F5F9FF] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-xs font-extrabold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                        <span>📎</span>
                        <span>Teacher's Uploaded File / Material</span>
                      </div>
                      {teacherFileType && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-black text-[10.5px]">
                          {teacherFileType} {teacherFileSize ? `• ${teacherFileSize}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Inline Preview for Image */}
                    {isTeacherImage && teacherFileUrl && (
                      <div className="rounded-xl overflow-hidden border border-blue-200 bg-white">
                        <img
                          src={teacherFileUrl}
                          alt={teacherFileName || currentMaterial.title}
                          className="w-full max-h-[380px] object-contain mx-auto block"
                        />
                      </div>
                    )}

                    {/* Inline Preview for Video */}
                    {isTeacherVideo && teacherFileUrl && (
                      <video
                        controls
                        src={teacherFileUrl}
                        className="w-full rounded-xl aspect-video border border-blue-200 bg-black"
                      />
                    )}

                    {/* Inline Preview for PDF */}
                    {isTeacherPdf && teacherFileUrl && (
                      <iframe
                        src={teacherFileUrl}
                        title={teacherFileName || currentMaterial.title}
                        className="w-full h-[360px] rounded-xl border border-blue-200 bg-white"
                      />
                    )}

                    {/* File Attachment Action Bar (View & Download) */}
                    <div className="bg-white rounded-xl p-3 border border-blue-200/80 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl shrink-0">
                          {isTeacherImage ? '🖼️' : isTeacherVideo ? '🎬' : isTeacherPdf ? '📕' : '📄'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#3a3226] truncate">
                            {teacherFileName || `${currentMaterial.title} (Teacher File)`}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold">
                            {teacherFileType || 'Learning Resource'}
                            {teacherFileSize ? ` • ${teacherFileSize}` : ''}
                          </div>
                        </div>
                      </div>

                      {teacherFileUrl && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenOrDownloadFile(
                                teacherFileUrl,
                                teacherFileName || `${currentMaterial.title}`,
                                'view'
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <span>👁️</span>
                            <span>View File</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenOrDownloadFile(
                                teacherFileUrl,
                                teacherFileName || `${currentMaterial.title}`,
                                'download'
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-extrabold cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <span>⬇️</span>
                            <span>Download</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentMaterial.type === 'activity' && (
                  <div className="mt-3 space-y-4">
                    {/* TEACHER CHECK STATUS BANNER */}
                    {isActivityCompleted(currentMaterial) && (
                      <div
                        className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 flex-wrap ${
                          isActivityCheckedByTeacher(currentMaterial)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">
                            {isActivityCheckedByTeacher(currentMaterial) ? '👩‍🏫' : '⏳'}
                          </span>
                          <div>
                            <div className="text-xs font-black uppercase tracking-wide">
                              {isActivityCheckedByTeacher(currentMaterial)
                                ? 'Checked by Teacher ✅'
                                : 'Submitted • Waiting for Teacher Check'}
                            </div>
                            <div className="text-[11.5px] font-semibold opacity-90">
                              {isActivityCheckedByTeacher(currentMaterial)
                                ? 'Great job! Your teacher has reviewed and checked your submitted activity.'
                                : 'Your work has been sent to your teacher. Status will update automatically once checked!'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ==================================================== */}
                    {/* 📤 STUDENT FILE / IMAGE UPLOAD FOR THIS ACTIVITY     */}
                    {/* ==================================================== */}
                    <div className="rounded-2xl border-2 border-dashed border-[#E5D5B5] bg-[#FFFDF7] p-4">
                      <label className="block text-xs font-extrabold text-[#6b5c42] mb-1.5 flex items-center gap-1.5">
                        <span>📤</span>
                        <span>Upload Your Work (Image or File — Photo, PDF, Word, Worksheet):</span>
                      </label>
                      <p className="text-[11.5px] text-[#7a7a7a] m-0 mb-2.5">
                        Take a photo of your completed activity or choose any image/document file to send to your teacher.
                      </p>

                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,video/*"
                        onChange={handleActivityFileChange}
                        className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-coral file:text-white hover:file:bg-coral-deep cursor-pointer"
                      />

                      {activityFilePreview && (
                        <div className="mt-3 bg-white rounded-xl p-3 border border-[#E5D5B5] space-y-2.5">
                          {isStudentFileImage && (
                            <img
                              src={activityFilePreview}
                              alt={activityFileName || 'Uploaded answer'}
                              className="w-full max-h-56 object-contain rounded-xl border border-gray-200 bg-slate-50"
                            />
                          )}

                          {isStudentFileVideo && (
                            <video
                              controls
                              src={activityFilePreview}
                              className="w-full max-h-56 rounded-xl border border-gray-200 bg-black"
                            />
                          )}

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xl shrink-0">
                                {isStudentFileImage ? '🖼️' : isStudentFileVideo ? '🎬' : '📄'}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-[#3a3226] truncate">
                                  {activityFileName || 'Attached_Activity_File'}
                                </div>
                                <div className="text-[10.5px] text-slate-500 font-bold">
                                  {activityFileType || 'FILE'}
                                  {activityFileSize ? ` • ${activityFileSize}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenOrDownloadFile(
                                    activityFilePreview,
                                    activityFileName || 'student-work',
                                    'view'
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-extrabold cursor-pointer"
                              >
                                👁️ View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivityFilePreview(null);
                                  setActivityFileName('');
                                  setActivityFileType('');
                                  setActivityFileSize('');
                                  setSubmitted(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold cursor-pointer"
                              >
                                ✕ Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#6b5c42] mb-1.5">
                        Your Answer or Comment:
                      </label>
                      <textarea
                        value={answer}
                        onChange={(e) => {
                          setAnswer(e.target.value);
                          if (submitted) setSubmitted(false);
                        }}
                        placeholder="Type your answer or comment here..."
                        className="w-full min-h-[90px] rounded-2xl border-2 border-[#F0E9D6] p-3 font-nunito text-[15px] outline-none focus:border-accent"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                      <button
                        onClick={submitAnswer}
                        disabled={submittingAnswer}
                        className="border-none bg-[#4CAF7D] hover:bg-[#3d9a69] text-white px-6 py-3 rounded-2xl font-extrabold text-[15px] cursor-pointer shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        {submittingAnswer
                          ? 'Submitting...'
                          : submitted
                          ? 'Update Submission ✅'
                          : 'Submit ✅'}
                      </button>
                      {submitted && (
                        <button
                          onClick={() => setView('home')}
                          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-dash-ink cursor-pointer"
                        >
                          Return Home
                        </button>
                      )}
                    </div>
                    {doneMsg.text && (
                      <div
                        className={`mt-3 font-extrabold text-sm ${
                          doneMsg.error ? 'text-[#C9553F]' : 'text-[#3D7048]'
                        }`}
                      >
                        {doneMsg.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ======================================================== */}
        {/* MODAL: STUDENT UPLOAD ACTIVITY / ARTWORK                 */}
        {/* ======================================================== */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 text-left shadow-2xl border border-[#F0E4CE] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📸</span>
                  <div>
                    <h3 className="font-baloo text-lg font-bold text-[#3a3226] m-0">
                      Upload My Activity or Artwork
                    </h3>
                    <p className="text-xs text-[#7a7a7a] m-0">
                      Share your drawing, photo, or activity file with Teacher!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-dash-ink font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStudentUploadSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Activity Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Family Drawing, Pineapple Coloring..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 font-bold text-[#3a3226] outline-none focus:border-coral text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Subject / Category (English &amp; Bisaya)
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold text-[#3a3226] outline-none focus:border-coral"
                  >
                    <option value="Colors / Mga Kolor">🎨 Colors / Mga Kolor</option>
                    <option value="Alphabet / Alpabeto">🔤 Alphabet / Alpabeto</option>
                    <option value="Numbers / Mga Numero">🔢 Numbers / Mga Numero</option>
                    <option value="Shapes / Mga Porma">🔺 Shapes / Mga Porma</option>
                    <option value="Animals / Mga Hayop">🐶 Animals / Mga Hayop</option>
                    <option value="Stories / Mga Sugilanon">📖 Stories / Mga Sugilanon</option>
                    <option value="General Artwork / Buhat">🖍️ General Artwork / Buhat</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Attach Image or File (Photo, PDF, Word, Worksheet, Video)
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,video/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-coral/10 file:text-coral-deep hover:file:bg-coral/20 cursor-pointer"
                  />
                  {uploadFilePreview && (
                    <div className="mt-2.5 bg-slate-50 p-2.5 rounded-2xl border border-gray-200 space-y-2">
                      {uploadFilePreview.startsWith('data:image/') ? (
                        <img
                          src={uploadFilePreview}
                          alt="Preview"
                          className="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-white"
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-200">
                          <span className="text-2xl">📄</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#3a3226] truncate">
                              {uploadFileName || 'Attached File'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold">
                              {uploadFileType || 'FILE'} {uploadFileSize ? `• ${uploadFileSize}` : ''}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold text-slate-600 truncate">
                          📎 {uploadFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadFilePreview(null);
                            setUploadFileName('');
                            setUploadFileType('');
                            setUploadFileSize('');
                          }}
                          className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Learner's Note or Story (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tell Teacher what you learned or made..."
                    value={uploadNote}
                    onChange={(e) => setUploadNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-coral"
                  />
                </div>

                {uploadMsg.text && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold ${
                      uploadMsg.type === 'error'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {uploadMsg.text}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2.5 rounded-xl bg-coral hover:bg-coral-deep text-white font-baloo font-bold text-sm shadow-bump cursor-pointer disabled:opacity-60 transition-all"
                  >
                    {uploading ? 'Uploading...' : 'Submit to Teacher 🚀'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 🎴 INTERACTIVE BIG FLASHCARD MODAL (Toddler Learning)   */}
        {/* ======================================================== */}
        {activeFlashcardIndex !== null && currentCategory?.items?.[activeFlashcardIndex] && (() => {
          const item = currentCategory.items[activeFlashcardIndex];
          const total = currentCategory.items.length;
          const hasPrev = activeFlashcardIndex > 0;
          const hasNext = activeFlashcardIndex < total - 1;

          return (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setActiveFlashcardIndex(null)}
            >
              <div
                className="bg-cream w-full max-w-md rounded-[32px] p-6 shadow-2xl border-4 border-white text-center relative animate-pop space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Top Bar */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#8C6200] bg-[#FFF3D6] px-3 py-1 rounded-full border border-amber-200">
                    {currentCategory.name} • {currentCategory.bisayaName} ({activeFlashcardIndex + 1}/{total})
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveFlashcardIndex(null)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold flex items-center justify-center cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Card Display Area */}
                <div className="bg-white rounded-3xl p-6 shadow-soft border border-[#F0E4CE] space-y-3">
                  {/* Big Letter / Number / Color / Shape / Animal Visual */}
                  {item.letter && (
                    <div className="font-baloo text-5xl font-black text-coral leading-none">
                      {item.letter}
                    </div>
                  )}

                  {item.num !== undefined && (
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] text-white flex items-center justify-center font-baloo text-5xl font-black shadow-md">
                      {item.num}
                    </div>
                  )}

                  {item.colorHex && (
                    <div
                      className="w-24 h-24 mx-auto rounded-full border-4 border-white shadow-lg flex items-center justify-center text-4xl"
                      style={{ backgroundColor: item.colorHex, color: item.textColor || '#FFFFFF' }}
                    >
                      {item.icon}
                    </div>
                  )}

                  {item.icon && !item.colorHex && (
                    <div className="text-7xl my-2 drop-shadow-sm">
                      {item.icon}
                    </div>
                  )}

                  {item.visual && (
                    <div className="text-2xl tracking-widest my-1">{item.visual}</div>
                  )}

                  {/* Names in English & Bisaya */}
                  <div>
                    <h3 className="font-baloo text-3xl font-black text-[#3a3226] m-0 leading-tight">
                      {item.english}
                    </h3>
                    <div className="text-xl font-extrabold text-coral-deep italic mt-0.5">
                      {item.bisaya}
                    </div>
                  </div>

                  {/* Pronunciation & Sample */}
                  {item.phonetic && (
                    <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full inline-block">
                      Phonics: {item.phonetic}
                    </div>
                  )}

                  {item.countText && (
                    <div className="text-sm font-bold text-[#6b5c42]">
                      {item.countText}
                    </div>
                  )}

                  {item.sound && (
                    <div className="text-base font-black text-coral">
                      Sound: "{item.sound}"
                    </div>
                  )}

                  {(item.note || item.sample || item.hint) && (
                    <p className="text-xs text-[#6b5c42] bg-[#FFFDF8] p-3 rounded-2xl border border-[#F0E4CE] m-0 font-medium leading-relaxed">
                      {item.note || item.sample || item.hint}
                    </p>
                  )}

                  {/* Audio Pronunciation Buttons */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => playAudioWord(item.english, 'en-US')}
                      className="px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 font-baloo font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>🔊</span>
                      <span>English ({item.english})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => playAudioWord(item.bisaya, 'fil-PH')}
                      className="px-4 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-800 font-baloo font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>🌺</span>
                      <span>Bisaya ({item.bisaya})</span>
                    </button>
                  </div>
                </div>

                {/* Modal Bottom Controls: Previous / Next */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => hasPrev && setActiveFlashcardIndex(activeFlashcardIndex - 1)}
                    disabled={!hasPrev}
                    className="flex-1 py-2.5 rounded-2xl bg-white border border-[#E6E6E6] font-baloo font-bold text-xs text-[#3a3226] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer shadow-xs"
                  >
                    ◀ Previous / Niagi
                  </button>
                  <button
                    type="button"
                    onClick={() => hasNext && setActiveFlashcardIndex(activeFlashcardIndex + 1)}
                    disabled={!hasNext}
                    className="flex-1 py-2.5 rounded-2xl bg-coral hover:bg-coral-deep text-white font-baloo font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-bump"
                  >
                    Next / Sunod ▶
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
