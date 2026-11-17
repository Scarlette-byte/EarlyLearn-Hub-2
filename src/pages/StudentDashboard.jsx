import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BILINGUAL_CATEGORIES, playAudioWord } from '../lib/studentLearningData.js';
import { CategoryBadge } from '../components/Category3DBadges.jsx';
import {
  getDefaultTeacherForBarangay,
  syncStudentLogin,
  cleanStudentName,
  getParentChildAssessment,
} from '../lib/learnersService.js';
import { isAuthenticSupabaseMaterial, getCleanTeacherModulesList } from '../lib/curriculumData.js';
import {
  validateActivityFile,
  isVideoItem,
  isImageItem,
  isPdfItem,
  getEmbeddedVideoUrl,
  saveMediaBlobToIndexedDB,
  resolveViewableMediaUrl,
} from '../lib/mediaStorage.js';

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
  const [navTab, setNavTab] = useState('home'); // home | my_child | activities | resources | messages | settings
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
  const [uploadFileDisplayUrl, setUploadFileDisplayUrl] = useState(null);
  const [activityFileDisplayUrl, setActivityFileDisplayUrl] = useState(null);
  const [resolvedTeacherMediaUrl, setResolvedTeacherMediaUrl] = useState(null);
  const [resolvedCardVideoUrls, setResolvedCardVideoUrls] = useState({});
  const [videoPlaybackBroken, setVideoPlaybackBroken] = useState(false);
  const [studentPreviewModal, setStudentPreviewModal] = useState(null);
  const [studentPreviewBlobUrl, setStudentPreviewBlobUrl] = useState(null);
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);

  // Resolve teacher's posted file/video URL when currentMaterial changes
  useEffect(() => {
    let active = true;
    setVideoPlaybackBroken(false);
    if (!currentMaterial?.content_url && !currentMaterial?.file_name && !currentMaterial?.title) {
      setResolvedTeacherMediaUrl(null);
      return;
    }
    resolveViewableMediaUrl(
      currentMaterial?.content_url,
      currentMaterial?.file_name,
      currentMaterial?.title
    ).then((resolved) => {
      if (active) setResolvedTeacherMediaUrl(resolved || null);
    });
    return () => {
      active = false;
    };
  }, [currentMaterial]);

      // Helper to relink/cache a teacher video file if an older upload's browser blob expired
      const handleRelinkTeacherVideo = useCallback(async (activityItem, file) => {
        if (!file || !activityItem) return;
        try {
          const idbKey = await saveMediaBlobToIndexedDB(file, activityItem.title || '');
          const blobUrl = URL.createObjectURL(file);
          setResolvedCardVideoUrls((prev) => ({ ...prev, [activityItem.id]: blobUrl }));
          if (currentMaterial?.id === activityItem.id) {
            setResolvedTeacherMediaUrl(blobUrl);
            setVideoPlaybackBroken(false);
          }

          // Also persist to localStorage and Supabase materials if <= 15 MB so it stays synced
          if (file.size <= 15 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const dataUrl = ev.target?.result;
              if (!dataUrl) return;
              try {
                if (activityItem.id && !String(activityItem.id).startsWith('mod-')) {
                  await supabase
                    .from('materials')
                    .update({ content_url: dataUrl })
                    .eq('id', activityItem.id);
                }
              } catch { }
            };
            reader.readAsDataURL(file);
          }
          try {
            const localMods = JSON.parse(localStorage.getItem('earlylearn_teacher_modules') || '[]');
            const updatedMods = localMods.map((m) =>
              m.id === activityItem.id || m.title === activityItem.title
                ? { ...m, content_url: idbKey || m.content_url, file_name: file.name }
                : m
            );
            localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updatedMods));
          } catch { }
        } catch { }
      }, [currentMaterial]);

      // Resolve student's attached file/video URL when activityFilePreview changes
      useEffect(() => {
        let active = true;
        if (!activityFilePreview && !activityFileName) {
          setActivityFileDisplayUrl(null);
          return;
        }
        resolveViewableMediaUrl(activityFilePreview, activityFileName).then((resolved) => {
          if (active) setActivityFileDisplayUrl(resolved || activityFilePreview);
        });
        return () => {
          active = false;
        };
      }, [activityFilePreview, activityFileName]);

      const handleOpenStudentPreviewModal = useCallback(async (item) => {
        setStudentPreviewModal(item);
        if (item?.fileUrl || item?.fileName) {
          const resolved = await resolveViewableMediaUrl(item.fileUrl, item.fileName);
          setStudentPreviewBlobUrl(resolved || item.fileUrl);
        } else {
          setStudentPreviewBlobUrl(null);
        }
      }, []);

      // Helper to open or download data:/idb: URLs and external URLs reliably across devices
      const handleOpenOrDownloadFile = useCallback(async (fileUrl, fileName, mode = 'view') => {
        if (!fileUrl && !fileName) return;
        const resolvedUrl = (await resolveViewableMediaUrl(fileUrl, fileName)) || fileUrl;
        if (!resolvedUrl) return;
        if (resolvedUrl.startsWith('data:')) {
          try {
            const parts = resolvedUrl.split(',');
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
          link.href = resolvedUrl;
          link.download = fileName || 'activity-file';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
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

      // --- Load Announcements from Supabase & LocalStorage (Filtered for this Student / Class) ---
      const loadAnnouncements = useCallback(async () => {
        const merged = [];
        const seenKeys = new Set();

        const studentTeacherName = (adviserInfo?.adviserName || '').trim().toLowerCase();
        const studentBarangayLower = (studentBarangay || profile?.barangay || '').trim().toLowerCase();
        const studentCdcLower = (adviserInfo?.cdcName || profile?.cdc_name || '').trim().toLowerCase();
        const studentTeacherId = profile?.teacher_id || profile?.assigned_teacher_id || null;
        const studentNameLower = (greetingName || '').trim().toLowerCase();
        const fullStudentClean = cleanStudentName(profile?.full_name || '').toLowerCase().trim();

        const isAnnForMe = (ann) => {
          const tId = ann.target_student_id;
          const tName = cleanStudentName(ann.target_student_name || '').toLowerCase().trim();

          // 1. Targeted to a specific student
          if (tId && tId !== 'all') {
            if (String(tId) === String(currentUserId)) return true;
            if (
              tName &&
              !tName.startsWith('all class') &&
              ((studentNameLower && tName.includes(studentNameLower)) ||
                (fullStudentClean &&
                  (tName === fullStudentClean ||
                    tName.includes(fullStudentClean) ||
                    fullStudentClean.includes(tName))))
            ) {
              return true;
            }
            return false;
          }

          // 2. Targeted to All Class Learners — check if from this student's teacher / CDC / Barangay
          if (!ann.teacher_name && !ann.cdc_name && !ann.barangay && !ann.teacher_id) {
            return true;
          }
          if (!studentTeacherName && !studentBarangayLower && !studentCdcLower && !studentTeacherId) {
            return true;
          }
          if (studentTeacherId && ann.teacher_id && String(studentTeacherId).trim() === String(ann.teacher_id).trim()) {
            return true;
          }
          const normTch = (ann.teacher_name || '').toLowerCase().trim();
          if (
            studentTeacherName &&
            normTch &&
            (normTch.includes(studentTeacherName) || studentTeacherName.includes(normTch))
          ) {
            return true;
          }
          const normCdc = (ann.cdc_name || '').toLowerCase().trim();
          if (
            studentCdcLower &&
            normCdc &&
            (normCdc === studentCdcLower ||
              normCdc.includes(studentCdcLower) ||
              studentCdcLower.includes(normCdc))
          ) {
            return true;
          }
          const normBrgy = (ann.barangay || '').toLowerCase().trim();
          if (studentBarangayLower && normBrgy && normBrgy === studentBarangayLower) {
            return true;
          }
          return false;
        };

        const addIfRelevant = (item) => {
          if (!item || !item.title) return;
          if (!isAnnForMe(item)) return;
          const key = `${String(item.title).trim().toLowerCase()}::${String(item.message || '').trim().toLowerCase()}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            merged.push(item);
          }
        };

        // 1. Load from Supabase `materials` (`[TEACHER_ANNOUNCEMENT]`)
        try {
          const { data: matAnns } = await supabase
            .from('materials')
            .select('id, title, content_text, created_by, created_at')
            .ilike('title', '[TEACHER_ANNOUNCEMENT]%')
            .order('created_at', { ascending: false });

          if (Array.isArray(matAnns)) {
            matAnns.forEach((row) => {
              try {
                const parsed = JSON.parse(row.content_text || '{}');
                if (parsed && parsed.__teacher_announcement) {
                  addIfRelevant({
                    id: parsed.id || row.id,
                    title: parsed.title || row.title.replace(/^\[TEACHER_ANNOUNCEMENT\]\s*/, ''),
                    message: parsed.message || '',
                    target_student_id: parsed.target_student_id || 'all',
                    target_student_name: parsed.target_student_name || 'All Class Learners',
                    teacher_id: parsed.teacher_id || row.created_by,
                    teacher_name: parsed.teacher_name || '',
                    cdc_name: parsed.cdc_name || '',
                    barangay: parsed.barangay || '',
                    created_at: parsed.created_at || row.created_at,
                  });
                }
              } catch { }
            });
          }
        } catch { }

        // 2. Load from Supabase `announcements`
        try {
          const { data, error } = await supabase
            .from('announcements')
            .select('id, title, message, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
          if (!error && Array.isArray(data)) {
            data.forEach((a) => {
              let cleanMsg = a.message || '';
              let targetId = 'all';
              let targetName = 'All Class Learners';
              if (cleanMsg.trim().startsWith('{')) {
                try {
                  const p = JSON.parse(cleanMsg);
                  if (p && p.__teacher_announcement) {
                    cleanMsg = p.message || '';
                    targetId = p.target_student_id || 'all';
                    targetName = p.target_student_name || 'All Class Learners';
                  }
                } catch { }
              }
              addIfRelevant({
                id: a.id,
                title: a.title,
                message: cleanMsg,
                target_student_id: targetId,
                target_student_name: targetName,
                created_at: a.created_at,
              });
            });
          }
        } catch { }

        // 3. Load from localStorage `earlylearn_announcements`
        try {
          const saved = localStorage.getItem('earlylearn_announcements');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              parsed.forEach((loc) => addIfRelevant(loc));
            }
          }
        } catch { }

        merged.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        setAnnouncements(merged.slice(0, 6));
      }, [adviserInfo, studentBarangay, profile, currentUserId, greetingName]);

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

      // Child's latest ECCD 4-Domain Developmental Assessment (read-only for parents, strictly scoped to this child)
      const [myChildAssessment, setMyChildAssessment] = useState(null);

      const loadChildAssessment = useCallback(async () => {
        try {
          const approvalStatus =
            profile?.approval_status || profile?.user_metadata?.approval_status || 'approved';
          const latest = await getParentChildAssessment({
            userId: currentUserId,
            childName: greetingName,
            barangay: studentBarangay,
            cdcName: adviserInfo?.cdcName || profile?.cdc_name || '',
            approvalStatus,
          });
          setMyChildAssessment(latest);
        } catch {
          setMyChildAssessment(null);
        }
      }, [currentUserId, greetingName, studentBarangay, adviserInfo?.cdcName, profile]);

      // Listen to teacher uploads in localStorage & Supabase Realtime across devices
      useEffect(() => {
        loadAnnouncements();
        loadDbMaterials();
        loadStudentSubmissions();
        loadChildAssessment();

        // Ensure student registration is synced with teacher dashboard
        syncStudentLogin(null, profile);

        function handleStorageChange(e) {
          if (e.key === 'earlylearn_teacher_modules') {
            setTeacherUploadedModules(getCleanTeacherModulesList());
          }
          if (e.key === 'earlylearn_announcements') {
            loadAnnouncements();
          }
          if (e.key === 'earlylearn_teacher_eccd_assessments') {
            loadChildAssessment();
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
          loadAnnouncements();
        }
        function handleAnnouncementsEvent() {
          loadAnnouncements();
        }
        function handleAssessmentsEvent() {
          loadChildAssessment();
        }

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('earlylearn_modules_updated', handleModulesEvent);
        window.addEventListener('earlylearn_announcements_updated', handleAnnouncementsEvent);
        window.addEventListener('earlylearn_assessments_updated', handleAssessmentsEvent);

        const channel = supabase
          .channel(`student-dashboard-sync-${currentUserId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
            loadDbMaterials();
            loadAnnouncements();
            loadChildAssessment();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'eccd_assessments' }, () => {
            loadChildAssessment();
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
          window.removeEventListener('earlylearn_announcements_updated', handleAnnouncementsEvent);
          window.removeEventListener('earlylearn_assessments_updated', handleAssessmentsEvent);
          supabase.removeChannel(channel);
        };
      }, [loadAnnouncements, loadDbMaterials, loadStudentSubmissions, loadChildAssessment, currentUserId, profile]);

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

        const fullStudentClean = cleanStudentName(profile?.full_name || '').toLowerCase().trim();

        const matchesStudentTarget = (targetId, targetName, mTeacherId, mTeacherName, mCdcName, mBarangay) => {
          if (targetId && targetId !== 'all') {
            if (String(targetId) === String(currentUserId)) return true;
            const normTargetName = cleanStudentName(targetName || '').toLowerCase().trim();
            if (
              normTargetName &&
              !normTargetName.startsWith('all class') &&
              ((studentNameLower && normTargetName.includes(studentNameLower)) ||
                (fullStudentClean &&
                  (normTargetName === fullStudentClean ||
                    normTargetName.includes(fullStudentClean) ||
                    fullStudentClean.includes(normTargetName))))
            ) {
              return true;
            }
            return false;
          }
          return isActivityForMyTeacher(mTeacherId, mTeacherName, mCdcName, mBarangay);
        };

        // 1. Load from Supabase dbMaterials first so cross-device IDs & files are primary
        (dbMaterials || []).forEach((m) => {
          if (
            m.title &&
            !m.title.startsWith('[MSWD_ASSIGNMENT]') &&
            !m.title.startsWith('[TEACHER_ANNOUNCEMENT]') &&
            !m.title.startsWith('[MEDIA_CHUNK]') &&
            !m.title.startsWith('[ECCD_ASSESSMENT]')
          ) {
            let meta = {};
            let cleanDescription = m.content_text || '';
            if (m.content_text && m.content_text.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(m.content_text);
                if (parsed && parsed.__metadata) {
                  meta = parsed;
                  cleanDescription = parsed.description || '';
                }
              } catch { }
            }

            if (meta.is_deleted) return;

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
          if (m.is_deleted) return;
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

      // Resolve playable video URLs for teacher video activities on the Student Dashboard home list
      useEffect(() => {
        let active = true;
        const videoItems = (teacherActivities || []).filter((a) =>
          isVideoItem({
            url: a.content_url,
            file_name: a.file_name,
            file_type: a.file_type,
            module_type: a.module_type,
          })
        );
        if (videoItems.length === 0) return;

        Promise.all(
          videoItems.map(async (item) => {
            const resolved = await resolveViewableMediaUrl(item.content_url, item.file_name, item.title);
            return [item.id, resolved || null];
          })
        ).then((entries) => {
          if (!active) return;
          setResolvedCardVideoUrls((prev) => {
            const next = { ...prev };
            entries.forEach(([id, url]) => {
              if (url) next[id] = url;
            });
            return next;
          });
        });

        return () => {
          active = false;
        };
      }, [teacherActivities]);

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

      async function handleActivityFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const validation = validateActivityFile(file);
        if (!validation.valid) {
          setDoneMsg({ text: `⚠️ ${validation.error}`, error: true });
          e.target.value = '';
          return;
        }
        setDoneMsg({ text: '', error: false });
        setActivityFileName(file.name);
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        setActivityFileType(ext);
        const sizeKB = file.size / 1024;
        const sizeFormatted =
          sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sizeKB))} KB`;
        setActivityFileSize(sizeFormatted);

        if (file.size > 3 * 1024 * 1024) {
          try {
            const idbKey = await saveMediaBlobToIndexedDB(file);
            const blobPreview = URL.createObjectURL(file);
            setActivityFileDisplayUrl(blobPreview);
            setActivityFilePreview(idbKey);
            setSubmitted(false);
            return;
          } catch {
            // Fallback to FileReader below
          }
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result || null;
          setActivityFileDisplayUrl(dataUrl);
          setActivityFilePreview(dataUrl);
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
      async function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (file) {
          const validation = validateActivityFile(file);
          if (!validation.valid) {
            setUploadMsg({ text: `⚠️ ${validation.error}`, type: 'error' });
            e.target.value = '';
            return;
          }
          setUploadMsg({ text: '', type: '' });
          setUploadFileName(file.name);
          const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
          setUploadFileType(ext);
          const sizeKB = file.size / 1024;
          const sizeFormatted =
            sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sizeKB))} KB`;
          setUploadFileSize(sizeFormatted);

          if (file.size > 3 * 1024 * 1024) {
            try {
              const idbKey = await saveMediaBlobToIndexedDB(file);
              const blobPreview = URL.createObjectURL(file);
              setUploadFileDisplayUrl(blobPreview);
              setUploadFilePreview(idbKey);
              return;
            } catch {
              // Fallback to FileReader below
            }
          }

          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const dataUrl = uploadEvent.target?.result;
            setUploadFileDisplayUrl(dataUrl);
            setUploadFilePreview(dataUrl);
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

      const NAV_ITEMS = [
        { key: 'home', label: 'Home', icon: 'home' },
        { key: 'my_child', label: 'My Child', icon: 'child' },
        { key: 'activities', label: 'Activities', icon: 'activities' },
        { key: 'resources', label: 'Resources', icon: 'resources' },
        {
          key: 'messages',
          label: 'Messages',
          icon: 'messages',
          badge: announcements.length > 0 ? announcements.length : null,
        },
        { key: 'settings', label: 'Settings', icon: 'settings' },
      ];

      function renderNavIcon(type, isActive) {
        const iconClass = `w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#7C5CE9]'}`;
        switch (type) {
          case 'home':
            return (
              <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            );
          case 'child':
            return (
              <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            );
          case 'activities':
            return (
              <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            );
          case 'resources':
            return (
              <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            );
          case 'messages':
            return (
              <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            );
          case 'settings':
            return (
              <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            );
          default:
            return null;
        }
      }

      function getActivityIcon(title = '', isVid = false) {
        if (isVid) return '🎬';
        const lower = (title || '').toLowerCase();
        if (lower.includes('name') || lower.includes('birthday') || lower.includes('kaadlawan') || lower.includes('cake')) {
          return '🎂';
        }
        if (lower.includes('color') || lower.includes('drawing') || lower.includes('art') || lower.includes('kolor')) {
          return '🎨';
        }
        if (lower.includes('family') || lower.includes('pamilya') || lower.includes('ginikanan')) {
          return '👨‍👩‍👧';
        }
        if (lower.includes('letter') || lower.includes('alphabet') || lower.includes('letra') || lower.includes('alpabeto')) {
          return '🔤';
        }
        if (lower.includes('number') || lower.includes('count') || lower.includes('numero') || lower.includes('ihap')) {
          return '🔢';
        }
        if (lower.includes('shape') || lower.includes('porma')) {
          return '🔶';
        }
        if (lower.includes('body') || lower.includes('lawas')) {
          return '🖐️';
        }
        if (lower.includes('animal') || lower.includes('mananap')) {
          return '🐶';
        }
        return '📝';
      }

      return (
        <div className="min-h-screen font-nunito bg-[#FAF8FE] text-[#231F4A] flex flex-col md:flex-row relative overflow-x-hidden">
          {/* Soft background pastel glow accents */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-100/35 rounded-full blur-3xl pointer-events-none" />

          {/* -------------------------------------------------------- */}
          {/* 1. LEFT SIDEBAR NAVIGATION (Desktop & Laptop)            */}
          {/* -------------------------------------------------------- */}
          <aside className="hidden md:flex md:w-56 lg:w-60 xl:w-64 shrink-0 bg-white border-r border-[#ECE7F4] flex-col justify-between p-5 min-h-screen sticky top-0 z-30 shadow-xs">
            <div>
              {/* Logo: EarlyLearn Hub */}
              <div
                onClick={() => {
                  setNavTab('home');
                  if (view !== 'home') setView('home');
                }}
                className="flex items-center gap-3 px-2 py-1.5 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4EA8DE] to-[#3B82F6] flex items-center justify-center text-white shadow-sm relative shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  <span className="absolute -top-1 -right-1 text-xs">⭐</span>
                </div>
                <div className="text-left leading-tight">
                  <span className="font-baloo font-black text-lg text-[#1E1B4B] block tracking-tight">EarlyLearn</span>
                  <span className="font-baloo font-black text-xs text-[#7C3AED] tracking-wider uppercase block -mt-0.5">Hub</span>
                </div>
              </div>

              {/* Navigation Menu Links */}
              <nav className="mt-8 space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const isActive = view === 'home' && navTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setNavTab(item.key);
                        if (view !== 'home') setView('home');
                      }}
                      className={`w-full py-3 px-4 rounded-2xl font-baloo font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#7C5CE9] text-white shadow-xs font-black'
                          : 'text-[#5C5874] hover:bg-[#F3EFFC] hover:text-[#231F4A]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        {renderNavIcon(item.icon, isActive)}
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span
                          className={`text-[10.5px] font-black px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-white text-[#7C5CE9]' : 'bg-[#FFE4E6] text-[#E11D48]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Bottom Doodles: Paper Plane & Pastel Green Hill */}
            <div className="relative pt-6 overflow-hidden">
              <div className="relative flex items-center justify-end pr-3 pb-2 text-[#9A93B5]">
                <svg className="w-16 h-8 overflow-visible" viewBox="0 0 70 30" fill="none">
                  <path d="M5 25 C 20 20, 35 10, 55 15" stroke="#B8B2D1" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
                <span className="text-sm -rotate-12 transform">✈️</span>
              </div>
              <div className="h-10 bg-gradient-to-r from-[#D7F5DF] to-[#E8F8EC] rounded-t-3xl border-t border-[#C7ECD1]/60 w-full" />
            </div>
          </aside>

          {/* -------------------------------------------------------- */}
          {/* MOBILE TOP NAVIGATION BAR (< md)                         */}
          {/* -------------------------------------------------------- */}
          <header className="md:hidden bg-white/95 backdrop-blur-xs border-b border-[#ECE7F4] px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-2xs">
            <div
              onClick={() => {
                setNavTab('home');
                if (view !== 'home') setView('home');
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4EA8DE] to-[#3B82F6] flex items-center justify-center text-white text-sm font-black shadow-xs">
                ⭐
              </div>
              <span className="font-baloo font-black text-base text-[#1E1B4B]">
                EarlyLearn <span className="text-[#7C3AED]">Hub</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="p-2 rounded-xl bg-[#F3EFFC] text-[#7C5CE9] font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>{NAV_ITEMS.find((n) => n.key === navTab)?.label || 'Menu'}</span>
                <span className="text-[10px]">▼</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border border-purple-100 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                title="Log Out"
              >
                🚪
              </button>
            </div>
          </header>

          {/* Mobile Dropdown Nav Menu */}
          {mobileNavOpen && (
            <div className="md:hidden bg-white border-b border-[#ECE7F4] p-3 space-y-1 shadow-soft sticky top-[57px] z-40">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setNavTab(item.key);
                    if (view !== 'home') setView('home');
                    setMobileNavOpen(false);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-baloo font-bold text-xs flex items-center justify-between cursor-pointer ${
                    navTab === item.key
                      ? 'bg-[#7C5CE9] text-white font-black'
                      : 'text-[#5C5874] hover:bg-[#F3EFFC]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {renderNavIcon(item.icon, navTab === item.key)}
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* MAIN DASHBOARD CONTENT AREA                              */}
          {/* -------------------------------------------------------- */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 max-w-[1440px] mx-auto w-full relative z-10">
            {/* ======================================================== */}
            {/* VIEW 1: HOME VIEW & PARENT TABS                          */}
            {/* ======================================================== */}
            {view === 'home' && (
              <div className="space-y-6">
                {/* 2. WELCOME GREETING SECTION */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFE0EC] to-[#FFD1DF] border-2 border-white shadow-xs flex items-center justify-center text-2xl shrink-0">
                      👩‍🦰
                    </div>
                    <div className="text-left">
                      <h1 className="font-baloo text-xl sm:text-2xl font-black text-[#1E1B4B] m-0 flex items-center gap-1.5">
                        <span>Hi, {greetingName}!</span>
                        <span className="text-amber-400 text-lg">✨</span>
                      </h1>
                      <p className="text-xs sm:text-[13px] text-[#6B658A] font-semibold m-0 mt-0.5 flex items-center gap-1">
                        Choose what you&apos;d like to do today <span className="text-[#8B5CF6]">💜</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-full bg-white hover:bg-rose-50 text-[#473E85] hover:text-rose-600 font-extrabold text-xs border border-purple-100 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    <span>Log Out</span>
                  </button>
                </div>
            {/* ======================================================== */}
            {/* TABS VIEW SWITCHER (BASED ON navTab)                     */}
            {/* ======================================================== */}

            {/* TAB 1: HOME (THE FULL REFERENCE LAYOUT) */}
            {navTab === 'home' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-left">
                {/* ---------------- LEFT COLUMN (7 COLS) ---------------- */}
                <div className="lg:col-span-7 space-y-4">
                  {/* 1. CHILD INFORMATION CARD */}
                  <div className="bg-[#FFF0F4] rounded-[26px] p-5 sm:p-5.5 border border-[#FFE0EA] shadow-2xs relative overflow-hidden flex items-center justify-between">
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white border-2 border-[#FFCCD8] shadow-xs flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                        <span role="img" aria-label="child avatar" className="text-3xl sm:text-4xl">👧</span>
                      </div>
                      <div className="min-w-0">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-[#FFDDE6] text-[#C93B6D] text-[11px] font-black tracking-wide uppercase">
                          Your Child
                        </span>
                        <h2 className="font-baloo text-xl sm:text-2xl font-black text-[#2D2A3E] m-0 mt-1 mb-0.5 leading-tight truncate">
                          {greetingName}
                        </h2>
                        <p className="text-xs sm:text-[13px] font-bold text-[#7A748A] m-0 flex items-center gap-1.5 truncate">
                          <span className="text-sm shrink-0">🏫</span>
                          <span className="truncate">{adviserInfo.cdcName || 'EarlyLearn Child Development Center'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Cute floating hearts doodle */}
                    <div className="text-2xl sm:text-3xl select-none opacity-80 hidden sm:block shrink-0 animate-pulse pl-2">
                      💕
                    </div>
                  </div>

                  {/* 2. TEACHER ANNOUNCEMENTS CARD */}
                  <div className="bg-[#EEF5FF] rounded-[26px] p-5 border border-[#DCE9FA] shadow-2xs relative space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-[#D6E6FF] flex items-center justify-center text-xl shrink-0 shadow-xs">
                          📢
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-baloo text-base sm:text-lg font-black text-[#1E293B] m-0 truncate">
                            Teacher Announcements ({announcements.length})
                          </h3>
                          <span className="text-xs font-bold text-[#64748B]">
                            {announcements[0]?.created_at
                              ? new Date(announcements[0].created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recent Updates'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setNavTab('messages')}
                        className="px-3.5 py-1.5 rounded-full bg-white hover:bg-blue-50 text-[#3B82F6] font-extrabold text-xs border border-blue-100 shadow-2xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>View All</span>
                        <span>&rarr;</span>
                      </button>
                    </div>

                    {announcements.length > 0 ? (
                      <div className="pt-2 border-t border-blue-100/70">
                        <div className="font-bold text-sm text-[#1E293B]">
                          {announcements[0].title}
                        </div>
                        <p className="text-xs sm:text-[13px] text-[#475569] mt-1 m-0 leading-relaxed line-clamp-2">
                          {announcements[0].message}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-blue-100/70 text-xs text-[#64748B] italic">
                        No announcements posted from your teacher yet.
                      </div>
                    )}
                  </div>

                  {/* 3. MY ACTIVITIES SECTION */}
                  <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#EDE8F5] shadow-2xs space-y-4">
                    {/* Header with Title and Upload button */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📋</span>
                        <h3 className="font-baloo text-lg sm:text-xl font-black text-[#2D2A3E] m-0">
                          My Activities
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="px-4 py-2 rounded-full bg-[#7C5CE9] hover:bg-[#6C4CE0] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <span>📤</span>
                        <span>+ Upload My Activity</span>
                      </button>
                    </div>

                    {/* Segmented Capsule Sub-Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-[#F1EEF9] rounded-full">
                      <button
                        type="button"
                        onClick={() => setActivityTab('teacher')}
                        className={`flex-1 py-1.5 px-3 sm:px-4 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activityTab === 'teacher'
                            ? 'bg-[#5B3EBD] text-white shadow-xs'
                            : 'text-[#6B658A] hover:text-[#2D2A3E]'
                        }`}
                      >
                        <span>☁️</span>
                        <span>Teacher&apos;s Uploads ({teacherActivities.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityTab('student_uploads')}
                        className={`flex-1 py-1.5 px-3 sm:px-4 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activityTab === 'student_uploads'
                            ? 'bg-[#5B3EBD] text-white shadow-xs'
                            : 'text-[#6B658A] hover:text-[#2D2A3E]'
                        }`}
                      >
                        <span>✅</span>
                        <span>My Submitted Works ({studentUploads.length})</span>
                      </button>
                    </div>

                    {/* Sub-Tab 1: Teacher's Uploads */}
                    {activityTab === 'teacher' && (
                      <div>
                        {teacherActivities.length === 0 ? (
                          <div className="p-7 rounded-[22px] bg-[#FAF8FE] border border-[#EDE8F5] text-center space-y-2">
                            <div className="text-3xl">🎈</div>
                            <div className="font-baloo font-bold text-base text-[#2D2A3E]">
                              No Teacher Activities at the Moment
                            </div>
                            <p className="text-xs text-[#7A748A] max-w-sm mx-auto m-0">
                              Your teacher hasn&apos;t uploaded any activities yet. You can submit your own drawings or practice worksheets using the button above!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {teacherActivities.map((act) => {
                              const isVid = isVideoItem({
                                url: act.content_url,
                                file_name: act.file_name,
                                file_type: act.file_type,
                                module_type: act.module_type,
                              });
                              const actIcon = getActivityIcon(act.title, isVid);
                              const isDone = isActivityCompleted(act);
                              const isChecked = isActivityCheckedByTeacher(act);

                              return (
                                <div
                                  key={act.id}
                                  className="p-3.5 sm:p-4 rounded-[22px] bg-[#FAF8FE] border border-[#EDE8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all hover:border-[#D4C5F7] hover:bg-white"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-[#E5DEFA] flex items-center justify-center text-3xl shrink-0 shadow-2xs">
                                      {actIcon}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-baloo font-bold text-sm sm:text-base text-[#2D2A3E] m-0 truncate">
                                        {act.title}
                                      </h4>
                                      <div className="text-[11px] font-bold text-[#7A748A] mt-0.5 truncate">
                                        Uploaded by: <span className="text-[#5B3EBD]">Teacher {act.teacher_name || adviserInfo.adviserName}</span>
                                      </div>
                                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                        {isChecked ? (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            Checked by Teacher ✅
                                          </span>
                                        ) : isDone ? (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-[#5B3EBD] border border-purple-200">
                                            Submitted ✅
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                            Pending ✏️
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => openMaterial(act, 'home')}
                                      className="px-3 py-1.5 rounded-full bg-[#EDE8F9] hover:bg-[#E0D7F7] text-[#5B3EBD] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <span>👁️</span> <span>View Lesson</span>
                                    </button>
                                    {isVid && (
                                      <button
                                        type="button"
                                        onClick={() => openMaterial(act, 'home')}
                                        className="px-3 py-1.5 rounded-full bg-[#FFF0F4] hover:bg-[#FFE0EB] text-[#E11D48] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <span>▶️</span> <span>Watch &amp; Play</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openMaterial(act, 'home')}
                                      className="px-3 py-1.5 rounded-full bg-white hover:bg-purple-50 text-[#7C5CE9] border border-[#7C5CE9] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                    >
                                      <span>Open Activity</span> <span>&rarr;</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sub-Tab 2: Student Uploaded Works */}
                    {activityTab === 'student_uploads' && (
                      <div>
                        {studentUploads.length === 0 ? (
                          <div className="p-7 rounded-[22px] bg-[#FAF8FE] border border-[#EDE8F5] text-center space-y-2">
                            <div className="text-3xl">🎨</div>
                            <div className="font-baloo font-bold text-base text-[#2D2A3E]">
                              No Uploaded Works Yet
                            </div>
                            <p className="text-xs text-[#7A748A] max-w-sm mx-auto m-0">
                              Click &quot;+ Upload My Activity&quot; above to submit drawings, worksheets, or photos directly to your teacher.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {studentUploads
                              .filter((u) => !u.is_deleted)
                              .map((u) => {
                                const isImg = isImageItem({
                                  url: u.mediaUrl,
                                  file_name: u.fileName,
                                  file_type: u.fileType,
                                });
                                const isVid = isVideoItem({
                                  url: u.mediaUrl,
                                  file_name: u.fileName,
                                  file_type: u.fileType,
                                });

                                const openPreview = () =>
                                  handleOpenStudentPreviewModal({
                                    title: u.title,
                                    category: u.category,
                                    note: u.note,
                                    fileUrl: u.mediaUrl,
                                    fileName: u.fileName || u.title,
                                    fileType: u.fileType || (isVid ? 'MP4' : isImg ? 'IMAGE' : 'FILE'),
                                    fileSize: u.fileSize || '',
                                    checked: Boolean(u.teacherChecked || (u.status || '').toLowerCase().includes('checked')),
                                  });

                                return (
                                  <div
                                    key={u.id}
                                    className="p-3.5 sm:p-4 rounded-[22px] bg-[#FAF8FE] border border-[#EDE8F5] flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 transition-all hover:bg-white hover:border-[#D4C5F7]"
                                  >
                                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                      {u.mediaUrl && isImg && u.mediaUrl.startsWith('data:image/') ? (
                                        <img
                                          src={u.mediaUrl}
                                          alt={u.title}
                                          onClick={openPreview}
                                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover shrink-0 border border-gray-200 cursor-pointer hover:opacity-90 shadow-2xs"
                                        />
                                      ) : u.mediaUrl && isVid ? (
                                        <div
                                          onClick={openPreview}
                                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-100 text-purple-800 border border-purple-200 flex flex-col items-center justify-center shrink-0 font-extrabold text-[10px] cursor-pointer hover:bg-purple-200 shadow-2xs"
                                        >
                                          <span className="text-xl">🎬</span>
                                          <span>{u.fileType || 'VIDEO'}</span>
                                        </div>
                                      ) : u.mediaUrl ? (
                                        <div
                                          onClick={openPreview}
                                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex flex-col items-center justify-center shrink-0 font-extrabold text-[10px] cursor-pointer hover:bg-blue-100 shadow-2xs"
                                        >
                                          <span className="text-xl">📄</span>
                                          <span>{u.fileType || 'FILE'}</span>
                                        </div>
                                      ) : (
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shrink-0 font-bold shadow-2xs">
                                          🖼️
                                        </div>
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <h4 className="font-baloo font-bold text-sm sm:text-base text-[#2D2A3E] m-0 truncate">
                                            {u.title}
                                          </h4>
                                          {u.teacherChecked || (u.status || '').toLowerCase().includes('checked') ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                              Checked by Teacher ✅
                                            </span>
                                          ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                              Waiting for Teacher ⏳
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-[#7A748A] font-bold mt-0.5">
                                          Subject: <b className="text-[#2D2A3E]">{u.category}</b> • {u.uploadedAt}
                                        </div>
                                        {u.note && (
                                          <p className="text-xs text-[#554D69] mt-1 m-0 bg-white p-2.5 rounded-xl border border-[#EDE8F5] leading-relaxed">
                                            &ldquo;{u.note}&rdquo;
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {u.mediaUrl && (
                                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <button
                                          type="button"
                                          onClick={openPreview}
                                          className="px-3 py-1.5 rounded-full bg-[#EDE8F9] hover:bg-[#E0D7F7] text-[#5B3EBD] text-xs font-extrabold cursor-pointer"
                                        >
                                          {isVid ? '▶️ Play' : '👁️ View'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenOrDownloadFile(u.mediaUrl, u.fileName || 'student-upload', 'download')}
                                          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold cursor-pointer"
                                        >
                                          ⬇️ Download
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ---------------- RIGHT COLUMN (5 COLS) ---------------- */}
                <div className="lg:col-span-5 space-y-4">
                  {/* 1. MY CHILD'S PROGRESS CARD */}
                  <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#EDE8F5] shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xl">⭐</span>
                        <h3 className="font-baloo text-base sm:text-lg font-black text-[#2D2A3E] m-0">
                          My Child&apos;s Progress
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setNavTab('my_child')}
                        className="text-xs font-bold text-[#7C5CE9] hover:bg-[#F3EEFF] px-3 py-1 rounded-full border border-purple-100 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>View Details</span>
                        <span>&rarr;</span>
                      </button>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3.5 bg-[#EDE8F5] rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-[#8B6DF7] to-[#7C5CE9] rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="font-baloo font-black text-xl text-[#2D2A3E] shrink-0">
                        {progressPct}%
                      </span>
                    </div>

                    {/* Completion count */}
                    <div className="flex items-center gap-2 text-xs sm:text-[13px] font-bold text-[#554D69]">
                      <span>🏆</span>
                      <span>
                        {totalCompletedCount} of {totalTasksCount} activities completed!
                      </span>
                    </div>
                  </div>

                  {/* 2. EXPLORE & LEARN (2x2 PASTEL GRID) */}
                  <div className="bg-[#FFFDF9] rounded-[26px] p-5 sm:p-6 border border-[#F5EEDD] shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📖</span>
                        <h3 className="font-baloo text-base sm:text-lg font-black text-[#2D2A3E] m-0">
                          Explore &amp; Learn
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setNavTab('resources')}
                        className="text-xs font-extrabold text-[#E11D48] bg-[#FFF0F4] hover:bg-rose-100 px-3 py-1 rounded-full border border-pink-100 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>6 Topics</span>
                        <span>&rarr;</span>
                      </button>
                    </div>

                    {/* 2x2 Grid matching reference design */}
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Topic 1: Alphabet */}
                      <button
                        type="button"
                        onClick={() => openCategory(categories.find((c) => c.id === 'cat-alphabet') || categories[0])}
                        className="bg-[#FFF0F4] border border-[#FFE0EA] hover:border-[#FBCFD8] rounded-[22px] p-4 flex flex-col justify-between text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="font-baloo font-black text-3xl sm:text-4xl bg-gradient-to-br from-[#FF4D6D] to-[#C9184A] bg-clip-text text-transparent">
                          Aa
                        </div>
                        <div className="mt-3">
                          <h5 className="font-baloo font-black text-base text-[#2D2A3E] m-0">Alphabet</h5>
                          <p className="text-[11px] text-[#7A748A] font-bold m-0 mt-0.5">Let&apos;s learn letters!</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#2D2A3E] group-hover:bg-[#7C5CE9] group-hover:text-white transition-colors self-end mt-2 shadow-2xs">
                          &rarr;
                        </div>
                      </button>

                      {/* Topic 2: Numbers */}
                      <button
                        type="button"
                        onClick={() => openCategory(categories.find((c) => c.id === 'cat-numbers') || categories[1])}
                        className="bg-[#EFF6FF] border border-[#DBEAFE] hover:border-[#BFDBFE] rounded-[22px] p-4 flex flex-col justify-between text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="font-baloo font-black text-2xl sm:text-3xl flex items-center gap-1 tracking-tight">
                          <span className="text-[#F97316]">1</span>
                          <span className="text-[#EAB308]">2</span>
                          <span className="text-[#22C55E]">3</span>
                        </div>
                        <div className="mt-3">
                          <h5 className="font-baloo font-black text-base text-[#2D2A3E] m-0">Numbers</h5>
                          <p className="text-[11px] text-[#7A748A] font-bold m-0 mt-0.5">Count and learn!</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#2D2A3E] group-hover:bg-[#7C5CE9] group-hover:text-white transition-colors self-end mt-2 shadow-2xs">
                          &rarr;
                        </div>
                      </button>

                      {/* Topic 3: Colors */}
                      <button
                        type="button"
                        onClick={() => openCategory(categories.find((c) => c.id === 'cat-colors') || categories[2])}
                        className="bg-[#F0FDF4] border border-[#DCFCE7] hover:border-[#BBF7D0] rounded-[22px] p-4 flex flex-col justify-between text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="text-3xl sm:text-4xl">🎨</div>
                        <div className="mt-3">
                          <h5 className="font-baloo font-black text-base text-[#2D2A3E] m-0">Colors</h5>
                          <p className="text-[11px] text-[#7A748A] font-bold m-0 mt-0.5">Discover colors!</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#2D2A3E] group-hover:bg-[#7C5CE9] group-hover:text-white transition-colors self-end mt-2 shadow-2xs">
                          &rarr;
                        </div>
                      </button>

                      {/* Topic 4: Shapes */}
                      <button
                        type="button"
                        onClick={() => openCategory(categories.find((c) => c.id === 'cat-shapes') || categories[3])}
                        className="bg-[#F5F3FF] border border-[#EDE9FE] hover:border-[#DDD6FE] rounded-[22px] p-4 flex flex-col justify-between text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="text-2xl sm:text-3xl flex items-center gap-1">
                          <span>🔺</span>
                          <span>🟡</span>
                          <span>🟦</span>
                        </div>
                        <div className="mt-3">
                          <h5 className="font-baloo font-black text-base text-[#2D2A3E] m-0">Shapes</h5>
                          <p className="text-[11px] text-[#7A748A] font-bold m-0 mt-0.5">Find the shapes!</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#2D2A3E] group-hover:bg-[#7C5CE9] group-hover:text-white transition-colors self-end mt-2 shadow-2xs">
                          &rarr;
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MY CHILD (DETAILS & DEVELOPMENTAL ASSESSMENT) */}
            {navTab === 'my_child' && (
              <div className="space-y-5 text-left max-w-4xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNavTab('home')}
                    className="px-4 py-2 rounded-full bg-white hover:bg-purple-50 text-[#5B3EBD] font-extrabold text-xs border border-purple-100 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⬅</span>
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs font-bold text-[#7A748A]">
                    My Child Profile &amp; ECCD Evaluation
                  </span>
                </div>

                {/* Child Information Card */}
                <div className="bg-[#FFF0F4] rounded-[26px] p-6 border border-[#FFE0EA] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white border-2 border-[#FFCCD8] shadow-xs flex items-center justify-center text-4xl shrink-0">
                      👧
                    </div>
                    <div>
                      <span className="inline-block px-3 py-0.5 rounded-full bg-[#FFDDE6] text-[#C93B6D] text-[11px] font-black tracking-wide uppercase">
                        Your Child
                      </span>
                      <h2 className="font-baloo text-2xl font-black text-[#2D2A3E] m-0 mt-1 mb-0.5 leading-tight">
                        {greetingName}
                      </h2>
                      <div className="text-xs sm:text-[13px] font-bold text-[#7A748A] space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span>🏫</span> <span>{adviserInfo.cdcName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>👩‍🏫</span> <span>Teacher Adviser: {adviserInfo.adviserName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right bg-white/70 p-4 rounded-2xl border border-pink-100">
                    <div className="text-xs font-bold text-[#7A748A]">Overall Activities Completed</div>
                    <div className="font-baloo font-black text-2xl text-[#C93B6D]">
                      {totalCompletedCount} / {totalTasksCount} ({progressPct}%)
                    </div>
                  </div>
                </div>

                {/* ECCD 4-Domain Developmental Progress */}
                <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#EDE8F5] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#F1EDF9]">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌱</span>
                      <h3 className="font-baloo text-lg sm:text-xl font-black text-[#2D2A3E] m-0">
                        My Child&apos;s Developmental Progress
                      </h3>
                    </div>
                    <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      👩‍🏫 Teacher Evaluation • Read-Only
                    </span>
                  </div>

                  {myChildAssessment ? (
                    <div className="space-y-4">
                      {/* Overall status and date */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5]">
                        <div>
                          <div className="text-[11px] font-bold text-[#7A748A] uppercase tracking-wider">
                            Overall Developmental Status
                          </div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-block px-3.5 py-1 rounded-full text-xs font-black border ${
                                myChildAssessment.overall_status === 'Developing as Expected'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : myChildAssessment.overall_status === 'Needs Reinforcement' ||
                                    myChildAssessment.overall_status === 'Needs Support'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {myChildAssessment.overall_status || 'Developing as Expected'}
                            </span>
                            {myChildAssessment.level && (
                              <span className="text-xs font-bold text-[#5B3EBD] bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                                {myChildAssessment.level}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="sm:text-right text-xs text-[#554D69]">
                          <div className="font-bold text-[#2D2A3E]">
                            📅 Assessed: {myChildAssessment.date || myChildAssessment.assessment_date || 'Recent'}
                          </div>
                          {myChildAssessment.teacher_name && (
                            <div className="text-[11px] text-[#7A748A] mt-0.5">
                              Evaluated by {myChildAssessment.teacher_name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4 Developmental Domains Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          {
                            label: 'Cognitive',
                            icon: '🧩',
                            desc: 'Sorting, counting, shapes & problem solving',
                            status: myChildAssessment.cognitive_status || 'Developing as Expected',
                          },
                          {
                            label: 'Physical/Motor',
                            icon: '🏃',
                            desc: 'Balance, fine motor grip, tracing & play',
                            status: myChildAssessment.physical_status || 'Developing as Expected',
                          },
                          {
                            label: 'Social-Emotional',
                            icon: '🤝',
                            desc: 'Sharing, routines, greeting circle & empathy',
                            status: myChildAssessment.social_status || 'Developing as Expected',
                          },
                          {
                            label: 'Language',
                            icon: '🗣️',
                            desc: 'Vocabulary, rhymes, listening & speech',
                            status: myChildAssessment.language_status || 'Developing as Expected',
                          },
                        ].map((dom) => {
                          const badgeClass =
                            dom.status === 'Developing as Expected'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : dom.status === 'Needs Support' || dom.status === 'Needs Reinforcement'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300';
                          return (
                            <div
                              key={dom.label}
                              className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5] flex flex-col justify-between gap-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-baloo font-bold text-sm text-[#2D2A3E]">
                                  <span>{dom.icon}</span>
                                  <span>{dom.label}</span>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black border shrink-0 ${badgeClass}`}>
                                  {dom.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#7A748A] leading-snug m-0">{dom.desc}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Teacher Observations & Recommendations */}
                      {(myChildAssessment.observations || myChildAssessment.recommendation) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#F5EEDD] space-y-1">
                            <div className="text-xs font-black text-[#2D2A3E] flex items-center gap-1.5">
                              <span>📋</span>
                              <span>Teacher&apos;s Observations</span>
                            </div>
                            <p className="text-xs text-[#554D69] leading-relaxed m-0">
                              {myChildAssessment.observations ||
                                'Active learner participating well in daily classroom routines.'}
                            </p>
                          </div>

                          <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] space-y-1">
                            <div className="text-xs font-black text-[#15803D] flex items-center gap-1.5">
                              <span>💡</span>
                              <span>Recommendations for Home</span>
                            </div>
                            <p className="text-xs text-[#15803D] leading-relaxed m-0">
                              {myChildAssessment.recommendation ||
                                'Continue guided reading, counting games, and daily practice at home.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5] text-center space-y-2">
                      <div className="text-3xl">🌱</div>
                      <div className="font-baloo font-bold text-base text-[#2D2A3E]">
                        No Developmental Assessment Recorded Yet
                      </div>
                      <p className="text-xs text-[#7A748A] max-w-md mx-auto m-0 leading-relaxed">
                        Once <b className="text-[#2D2A3E]">{adviserInfo.adviserName}</b> completes{' '}
                        <b className="text-[#2D2A3E]">{greetingName}</b>&apos;s ECCD evaluation (Cognitive, Physical/Motor, Social-Emotional, and Language), the verified evaluation, observations, and home practice recommendations will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ACTIVITIES (FULL ACTIVITIES VIEW) */}
            {navTab === 'activities' && (
              <div className="space-y-5 text-left max-w-5xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNavTab('home')}
                    className="px-4 py-2 rounded-full bg-white hover:bg-purple-50 text-[#5B3EBD] font-extrabold text-xs border border-purple-100 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⬅</span>
                    <span>Back to Home</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-4 py-2 rounded-full bg-[#7C5CE9] hover:bg-[#6C4CE0] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>📤</span>
                    <span>+ Upload My Activity</span>
                  </button>
                </div>

                <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#EDE8F5] shadow-2xs space-y-4">
                  <div className="flex items-center gap-1.5 p-1 bg-[#F1EEF9] rounded-full">
                    <button
                      type="button"
                      onClick={() => setActivityTab('teacher')}
                      className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activityTab === 'teacher'
                          ? 'bg-[#5B3EBD] text-white shadow-xs'
                          : 'text-[#6B658A] hover:text-[#2D2A3E]'
                      }`}
                    >
                      <span>☁️</span>
                      <span>Teacher&apos;s Uploads ({teacherActivities.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivityTab('student_uploads')}
                      className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activityTab === 'student_uploads'
                          ? 'bg-[#5B3EBD] text-white shadow-xs'
                          : 'text-[#6B658A] hover:text-[#2D2A3E]'
                      }`}
                    >
                      <span>✅</span>
                      <span>My Submitted Works ({studentUploads.length})</span>
                    </button>
                  </div>

                  {activityTab === 'teacher' ? (
                    <div>
                      {teacherActivities.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#7A748A]">
                          No teacher activities uploaded yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {teacherActivities.map((act) => {
                            const isVid = isVideoItem({
                              url: act.content_url,
                              file_name: act.file_name,
                              file_type: act.file_type,
                              module_type: act.module_type,
                            });
                            const actIcon = getActivityIcon(act.title, isVid);
                            const isDone = isActivityCompleted(act);
                            const isChecked = isActivityCheckedByTeacher(act);

                            return (
                              <div
                                key={act.id}
                                className="p-4 rounded-[22px] bg-[#FAF8FE] border border-[#EDE8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all hover:bg-white hover:border-[#D4C5F7]"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className="w-16 h-16 rounded-2xl bg-white border border-[#E5DEFA] flex items-center justify-center text-3xl shrink-0 shadow-2xs">
                                    {actIcon}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-baloo font-bold text-base text-[#2D2A3E] m-0 truncate">
                                      {act.title}
                                    </h4>
                                    <div className="text-xs font-bold text-[#7A748A] mt-0.5">
                                      Uploaded by: <span className="text-[#5B3EBD]">Teacher {act.teacher_name || adviserInfo.adviserName}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      {isChecked ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          Checked by Teacher ✅
                                        </span>
                                      ) : isDone ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-[#5B3EBD] border border-purple-200">
                                          Submitted ✅
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                          Pending ✏️
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => openMaterial(act, 'home')}
                                    className="px-3.5 py-1.5 rounded-full bg-[#EDE8F9] hover:bg-[#E0D7F7] text-[#5B3EBD] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <span>👁️</span> <span>View Lesson</span>
                                  </button>
                                  {isVid && (
                                    <button
                                      type="button"
                                      onClick={() => openMaterial(act, 'home')}
                                      className="px-3.5 py-1.5 rounded-full bg-[#FFF0F4] hover:bg-[#FFE0EB] text-[#E11D48] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <span>▶️</span> <span>Watch &amp; Play</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openMaterial(act, 'home')}
                                    className="px-4 py-1.5 rounded-full bg-white hover:bg-purple-50 text-[#7C5CE9] border border-[#7C5CE9] font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  >
                                    <span>Open Activity</span> <span>&rarr;</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {studentUploads.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#7A748A]">
                          No uploaded works yet. Click &quot;+ Upload My Activity&quot; above to submit.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {studentUploads
                            .filter((u) => !u.is_deleted)
                            .map((u) => {
                              const isImg = isImageItem({
                                url: u.mediaUrl,
                                file_name: u.fileName,
                                file_type: u.fileType,
                              });
                              const isVid = isVideoItem({
                                url: u.mediaUrl,
                                file_name: u.fileName,
                                file_type: u.fileType,
                              });
                              const openPreview = () =>
                                handleOpenStudentPreviewModal({
                                  title: u.title,
                                  category: u.category,
                                  note: u.note,
                                  fileUrl: u.mediaUrl,
                                  fileName: u.fileName || u.title,
                                  fileType: u.fileType || (isVid ? 'MP4' : isImg ? 'IMAGE' : 'FILE'),
                                  fileSize: u.fileSize || '',
                                  checked: Boolean(u.teacherChecked || (u.status || '').toLowerCase().includes('checked')),
                                });

                              return (
                                <div
                                  key={u.id}
                                  className="p-4 rounded-[22px] bg-[#FAF8FE] border border-[#EDE8F5] flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 transition-all hover:bg-white hover:border-[#D4C5F7]"
                                >
                                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                    {u.mediaUrl && isImg && u.mediaUrl.startsWith('data:image/') ? (
                                      <img
                                        src={u.mediaUrl}
                                        alt={u.title}
                                        onClick={openPreview}
                                        className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-gray-200 cursor-pointer shadow-2xs hover:opacity-90"
                                      />
                                    ) : u.mediaUrl && isVid ? (
                                      <div
                                        onClick={openPreview}
                                        className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-800 border border-purple-200 flex flex-col items-center justify-center shrink-0 font-extrabold text-[10px] cursor-pointer shadow-2xs hover:bg-purple-200"
                                      >
                                        <span className="text-xl">🎬</span>
                                        <span>{u.fileType || 'VIDEO'}</span>
                                      </div>
                                    ) : u.mediaUrl ? (
                                      <div
                                        onClick={openPreview}
                                        className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex flex-col items-center justify-center shrink-0 font-extrabold text-[10px] cursor-pointer shadow-2xs hover:bg-blue-100"
                                      >
                                        <span className="text-xl">📄</span>
                                        <span>{u.fileType || 'FILE'}</span>
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shrink-0 font-bold shadow-2xs">
                                        🖼️
                                      </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <h4 className="font-baloo font-bold text-base text-[#2D2A3E] m-0 truncate">
                                          {u.title}
                                        </h4>
                                        {u.teacherChecked || (u.status || '').toLowerCase().includes('checked') ? (
                                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            Checked by Teacher ✅
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                            Waiting for Teacher ⏳
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-[#7A748A] font-bold mt-0.5">
                                        Subject: <b className="text-[#2D2A3E]">{u.category}</b> • {u.uploadedAt}
                                      </div>
                                      {u.note && (
                                        <p className="text-xs text-[#554D69] mt-1 m-0 bg-white p-2.5 rounded-xl border border-[#EDE8F5]">
                                          &ldquo;{u.note}&rdquo;
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {u.mediaUrl && (
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                      <button
                                        type="button"
                                        onClick={openPreview}
                                        className="px-3.5 py-1.5 rounded-full bg-[#EDE8F9] hover:bg-[#E0D7F7] text-[#5B3EBD] text-xs font-extrabold cursor-pointer"
                                      >
                                        {isVid ? '▶️ Play' : '👁️ View'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenOrDownloadFile(u.mediaUrl, u.fileName || 'student-upload', 'download')}
                                        className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold cursor-pointer"
                                      >
                                        ⬇️ Download
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: RESOURCES (6 BILINGUAL TOPICS) */}
            {navTab === 'resources' && (
              <div className="space-y-5 text-left max-w-5xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNavTab('home')}
                    className="px-4 py-2 rounded-full bg-white hover:bg-purple-50 text-[#5B3EBD] font-extrabold text-xs border border-purple-100 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⬅</span>
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs font-bold text-[#7A748A]">
                    6 Bilingual Topics (English &amp; Bisaya)
                  </span>
                </div>

                <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#EDE8F5] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-baloo text-xl font-black text-[#2D2A3E] m-0">
                        📚 Early Childhood Learning Topics
                      </h3>
                      <p className="text-xs text-[#7A748A] font-bold m-0 mt-0.5">
                        Interactive lessons, audio pronunciation, flashcards &amp; stories
                      </p>
                    </div>
                    <span className="text-xs font-black text-[#5B3EBD] bg-purple-50 px-3 py-1 rounded-full border border-purple-200 hidden sm:inline-block">
                      Pre-K 1 &amp; Pre-K 2
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                    {categories.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openCategory(c)}
                        className={`group relative border-none rounded-[24px] py-6 px-4 flex flex-col items-center gap-2.5 font-baloo font-bold text-white cursor-pointer shadow-bump transition-all hover:scale-[1.03] active:translate-y-1 ${
                          PALETTES[i % PALETTES.length]
                        }`}
                      >
                        <CategoryBadge
                          id={c.id}
                          className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 transition-transform group-hover:scale-105 drop-shadow-sm"
                        />
                        <div className="text-center leading-tight">
                          <div className="text-lg sm:text-xl font-black tracking-tight drop-shadow-xs">
                            {c.name}
                          </div>
                          <div className="text-xs font-bold opacity-90 drop-shadow-xs italic">
                            {c.bisayaName}
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold bg-black/15 text-white/95 px-3 py-0.5 rounded-full mt-1">
                          {c.items?.length || 0} items • English &amp; Bisaya
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: MESSAGES (TEACHER ANNOUNCEMENTS) */}
            {navTab === 'messages' && (
              <div className="space-y-5 text-left max-w-4xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNavTab('home')}
                    className="px-4 py-2 rounded-full bg-white hover:bg-purple-50 text-[#5B3EBD] font-extrabold text-xs border border-purple-100 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⬅</span>
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs font-bold text-[#7A748A]">
                    Teacher Notice Board
                  </span>
                </div>

                <div className="bg-[#EEF5FF] rounded-[26px] p-5 sm:p-6 border border-[#DCE9FA] shadow-2xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#D6E6FF] flex items-center justify-center text-2xl shrink-0 shadow-xs">
                      📢
                    </div>
                    <div>
                      <h3 className="font-baloo text-xl font-black text-[#1E293B] m-0">
                        Teacher Announcements
                      </h3>
                      <p className="text-xs text-[#64748B] font-bold m-0 mt-0.5">
                        Official updates from {adviserInfo.adviserName} • {adviserInfo.cdcName}
                      </p>
                    </div>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#64748B] italic bg-white/70 rounded-2xl border border-blue-100">
                      No announcements posted yet. Check back soon for classroom updates!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((ann) => (
                        <div
                          key={ann.id}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-blue-100/80 shadow-2xs space-y-2 text-left"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="font-baloo font-bold text-base text-[#1E293B] m-0">
                              {ann.title}
                            </h4>
                            <span className="text-xs font-bold text-[#64748B]">
                              📅 {ann.created_at ? new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-[13px] text-[#475569] leading-relaxed m-0 whitespace-pre-wrap">
                            {ann.message}
                          </p>
                          <div className="text-[11px] font-bold text-[#3B82F6] pt-1">
                            From Teacher {adviserInfo.adviserName} • {adviserInfo.cdcName}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: SETTINGS (ACCOUNT & DAYCARE INFO) */}
            {navTab === 'settings' && (
              <div className="space-y-5 text-left max-w-3xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNavTab('home')}
                    className="px-4 py-2 rounded-full bg-white hover:bg-purple-50 text-[#5B3EBD] font-extrabold text-xs border border-purple-100 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⬅</span>
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs font-bold text-[#7A748A]">
                    Account &amp; Day Care Center
                  </span>
                </div>

                <div className="bg-white rounded-[26px] p-6 border border-[#EDE8F5] shadow-2xs space-y-5">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#F1EDF9]">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center text-2xl font-bold border border-purple-200">
                      ⚙️
                    </div>
                    <div>
                      <h3 className="font-baloo text-xl font-black text-[#2D2A3E] m-0">
                        Student &amp; Parent Profile
                      </h3>
                      <p className="text-xs text-[#7A748A] font-bold m-0 mt-0.5">
                        Connected to MSWDO Early Childhood System
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-[#554D69]">
                    <div className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5] space-y-1">
                      <div className="text-[11px] text-[#7A748A] uppercase">Learner Name</div>
                      <div className="font-black text-sm text-[#2D2A3E]">{greetingName}</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5] space-y-1">
                      <div className="text-[11px] text-[#7A748A] uppercase">Parent / Registered Email</div>
                      <div className="font-black text-sm text-[#2D2A3E]">{profile?.email || 'Registered Parent'}</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5] space-y-1">
                      <div className="text-[11px] text-[#7A748A] uppercase">Assigned Day Care Center</div>
                      <div className="font-black text-sm text-[#2D2A3E]">{adviserInfo.cdcName}</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAF8FE] border border-[#EDE8F5] space-y-1">
                      <div className="text-[11px] text-[#7A748A] uppercase">Class Teacher Adviser</div>
                      <div className="font-black text-sm text-[#2D2A3E]">{adviserInfo.adviserName}</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#F1EDF9] flex items-center justify-between flex-wrap gap-3">
                    <p className="text-xs text-[#7A748A] m-0 font-semibold">
                      Need help or updates? Contact your assigned teacher or visit MSWDO Manolo Fortich.
                    </p>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs border border-rose-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
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
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${storyLanguageTab === 'both' ? 'bg-white text-dash-ink shadow-xs' : 'text-[#8C6200]'
                              }`}
                          >
                            ✨ Both
                          </button>
                          <button
                            onClick={() => setStoryLanguageTab('en')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${storyLanguageTab === 'en' ? 'bg-white text-dash-ink shadow-xs' : 'text-[#8C6200]'
                              }`}
                          >
                            📖 English
                          </button>
                          <button
                            onClick={() => setStoryLanguageTab('bis')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${storyLanguageTab === 'bis' ? 'bg-white text-dash-ink shadow-xs' : 'text-[#8C6200]'
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
            const cleanRawUrl =
              typeof currentMaterial.content_url === 'string' &&
                currentMaterial.content_url !== 'true' &&
                currentMaterial.content_url !== 'false'
                ? currentMaterial.content_url.trim()
                : null;
            const rawTeacherFileUrl = cleanRawUrl;
            const teacherFileUrl =
              resolvedTeacherMediaUrl ||
              (cleanRawUrl && !cleanRawUrl.startsWith('idb://') && !cleanRawUrl.startsWith('sbchunk://')
                ? cleanRawUrl
                : null);
            const teacherFileName = currentMaterial.file_name || '';
            const teacherFileType = (currentMaterial.file_type || '').toUpperCase();
            const teacherFileSize = currentMaterial.file_size || '';

            const teacherEmbedUrl = getEmbeddedVideoUrl(teacherFileUrl);

            const isTeacherImage = isImageItem({
              url: teacherFileUrl,
              file_name: teacherFileName,
              file_type: teacherFileType,
            }) || currentMaterial.module_type === 'image';

            const isTeacherVideo = Boolean(teacherEmbedUrl) || isVideoItem({
              url: teacherFileUrl || cleanRawUrl,
              file_name: teacherFileName,
              file_type: teacherFileType,
              module_type: currentMaterial.module_type,
            });

            const playableTeacherVideoUrl = isTeacherVideo
              ? !videoPlaybackBroken
                ? teacherFileUrl || resolvedCardVideoUrls[currentMaterial.id] || null
                : null
              : null;

            const isTeacherPdf = isPdfItem({
              url: teacherFileUrl,
              file_name: teacherFileName,
              file_type: teacherFileType,
            });

            const studentPreviewSrc = activityFileDisplayUrl || activityFilePreview;

            const isStudentFileImage =
              studentPreviewSrc &&
              isImageItem({
                url: studentPreviewSrc,
                file_name: activityFileName,
                file_type: activityFileType,
              });

            const isStudentFileVideo =
              studentPreviewSrc &&
              isVideoItem({
                url: studentPreviewSrc,
                file_name: activityFileName,
                file_type: activityFileType,
              });

            return (
              <div>
                <button
                  onClick={() => setView(backTarget)}
                  className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4 flex items-center gap-1.5"
                >
                  ⬅ Back
                </button>
                <div className="bg-white rounded-[24px] p-5 sm:p-7 text-left shadow-soft border border-[#F0E4CE]">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-accent flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#8C6200]">
                      {currentMaterial.category_name || 'Class Activity'}
                    </span>
                    {currentMaterial.teacher_name && (
                      <span>by {currentMaterial.teacher_name}</span>
                    )}
                  </div>

                  <h2 className="font-baloo text-2xl sm:text-3xl m-0 mb-4 text-[#3a3226]">
                    {currentMaterial.title}
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN ON LAPTOP: TEACHER INSTRUCTIONS & VIDEO / MATERIAL */}
                    <div className={currentMaterial.type === 'activity' ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
                      {currentMaterial.content_text && (
                        <div className="bg-[#FFFDF8] p-4 sm:p-5 rounded-2xl border border-[#F0E4CE] text-[16px] sm:text-[17px] leading-[1.6] text-[#3a3226]">
                          {currentMaterial.content_text}
                        </div>
                      )}

                      {/* ==================================================== */}
                      {/* 📎 TEACHER'S UPLOADED FILE / VIDEO / LEARNING MATERIAL */}
                      {/* ==================================================== */}
                      {(teacherFileUrl || teacherFileName || isTeacherVideo) && (
                        <div className="rounded-2xl border-2 border-[#E2ECF8] bg-[#F5F9FF] p-4 sm:p-5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-xs font-extrabold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                              <span>{isTeacherVideo ? '🎬' : '📎'}</span>
                              <span>
                                {isTeacherVideo
                                  ? "Teacher's Video Lesson — Click Play to Watch!"
                                  : "Teacher's Uploaded File / Material"}
                              </span>
                            </div>
                            {teacherFileType && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-black text-[10.5px]">
                                {teacherFileType} {teacherFileSize ? `• ${teacherFileSize}` : ''}
                              </span>
                            )}
                          </div>

                          {/* Inline Preview for Video (Embedded YouTube/Drive or Direct Video File) */}
                          {isTeacherVideo && (
                            playableTeacherVideoUrl ? (
                              teacherEmbedUrl ? (
                                <iframe
                                  src={teacherEmbedUrl}
                                  title={teacherFileName || currentMaterial.title}
                                  className="w-full rounded-xl aspect-video border-2 border-purple-200 bg-black shadow-sm"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : (
                                <video
                                  key={playableTeacherVideoUrl}
                                  controls
                                  playsInline
                                  preload="auto"
                                  src={playableTeacherVideoUrl}
                                  onLoadedMetadata={(e) => {
                                    if (e.currentTarget.currentTime === 0) {
                                      try {
                                        e.currentTarget.currentTime = 0.05;
                                      } catch {}
                                    }
                                  }}
                                  onError={() => {
                                    setVideoPlaybackBroken(true);
                                  }}
                                  className="w-full rounded-xl aspect-video border-2 border-purple-200 bg-black shadow-sm"
                                >
                                  Your browser does not support HTML5 video playback.
                                </video>
                              )
                            ) : (
                              <div className="rounded-xl bg-purple-950/90 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-2 border-purple-300">
                                <div className="text-left">
                                  <div className="font-bold text-xs text-purple-200 flex items-center gap-1.5">
                                    <span>🎬</span>
                                    <span>{teacherFileName || currentMaterial.title}</span>
                                  </div>
                                  <div className="text-[11px] text-purple-300 mt-0.5">
                                    Select the teacher&apos;s video file once to cache and play it directly inside the dashboard without downloading:
                                  </div>
                                </div>
                                <label className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold cursor-pointer shrink-0 transition-colors">
                                  📂 Load Teacher Video
                                  <input
                                    type="file"
                                    accept="video/*,.mp4,.webm,.mov,.m4v"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleRelinkTeacherVideo(currentMaterial, f);
                                    }}
                                  />
                                </label>
                              </div>
                            )
                          )}

                          {/* Inline Preview for Image */}
                          {!isTeacherVideo && isTeacherImage && teacherFileUrl && (
                            <div className="rounded-xl overflow-hidden border border-blue-200 bg-white">
                              <img
                                src={teacherFileUrl}
                                alt={teacherFileName || currentMaterial.title}
                                className="w-full max-h-[440px] object-contain mx-auto block"
                              />
                            </div>
                          )}

                          {/* Inline Preview for PDF */}
                          {!isTeacherVideo && !isTeacherImage && isTeacherPdf && teacherFileUrl && (
                            <iframe
                              src={teacherFileUrl}
                              title={teacherFileName || currentMaterial.title}
                              className="w-full h-[440px] rounded-xl border border-blue-200 bg-white"
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
                                  {teacherFileName || `${currentMaterial.title} (${isTeacherVideo ? 'Video Lesson' : 'Teacher File'})`}
                                </div>
                                <div className="text-[11px] text-slate-500 font-semibold">
                                  {teacherFileType || (isTeacherVideo ? 'VIDEO' : 'Learning Resource')}
                                  {teacherFileSize ? ` • ${teacherFileSize}` : ''}
                                </div>
                              </div>
                            </div>

                            {(playableTeacherVideoUrl || teacherFileUrl || rawTeacherFileUrl) && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenOrDownloadFile(
                                      playableTeacherVideoUrl || teacherFileUrl || rawTeacherFileUrl,
                                      teacherFileName || `${currentMaterial.title}`,
                                      'view'
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer transition-colors flex items-center gap-1"
                                >
                                  <span>{isTeacherVideo ? '▶️' : '👁️'}</span>
                                  <span>{isTeacherVideo ? 'Watch in New Tab' : 'View File'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenOrDownloadFile(
                                      playableTeacherVideoUrl || teacherFileUrl || rawTeacherFileUrl,
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
                    </div>

                    {/* RIGHT COLUMN ON LAPTOP: STUDENT SUBMISSION FORM */}
                    {currentMaterial.type === 'activity' && (
                      <div className="lg:col-span-5 space-y-4">
                        {/* TEACHER CHECK STATUS BANNER */}
                        {isActivityCompleted(currentMaterial) && (
                          <div
                            className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 flex-wrap ${isActivityCheckedByTeacher(currentMaterial)
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
                        {/* 📤 STUDENT FILE / IMAGE / VIDEO UPLOAD FOR ACTIVITY  */}
                        {/* ==================================================== */}
                        <div className="rounded-2xl border-2 border-dashed border-[#E5D5B5] bg-[#FFFDF7] p-4">
                          <label className="block text-xs font-extrabold text-[#6b5c42] mb-1.5 flex items-center gap-1.5">
                            <span>📤</span>
                            <span>Upload Your Work (Image, File, or Video — Photo, PDF, Word, MP4 Video):</span>
                          </label>
                          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                            📏 Applicable File Size Limits: 🖼️ Images: Max 10 MB • 📁 Files/Docs (PDF/Word): Max 15 MB • 🎬 Videos (MP4/WebM/MOV): Max 50 MB
                          </div>
                          <p className="text-[11.5px] text-[#7a7a7a] m-0 mb-2.5">
                            Take a photo, record a short video, or choose any image/document file to send to your teacher. You can view/play it anytime before and after Teacher checks it!
                          </p>

                          <input
                            type="file"
                            accept="image/*,video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                            onChange={handleActivityFileChange}
                            className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-coral file:text-white hover:file:bg-coral-deep cursor-pointer"
                          />

                          {activityFilePreview && (
                            <div className="mt-3 bg-white rounded-xl p-3 border border-[#E5D5B5] space-y-2.5">
                              {isStudentFileImage && (
                                <img
                                  src={studentPreviewSrc}
                                  alt={activityFileName || 'Uploaded answer'}
                                  className="w-full max-h-56 object-contain rounded-xl border border-gray-200 bg-slate-50"
                                />
                              )}

                              {isStudentFileVideo && (
                                <video
                                  controls
                                  playsInline
                                  src={studentPreviewSrc}
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
                                      setActivityFileDisplayUrl(null);
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
                            className="w-full min-h-[100px] rounded-2xl border-2 border-[#F0E9D6] p-3 font-nunito text-[15px] outline-none focus:border-accent"
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
                            className={`mt-3 font-extrabold text-sm ${doneMsg.error ? 'text-[#C9553F]' : 'text-[#3D7048]'
                              }`}
                          >
                            {doneMsg.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                        Share your drawing, photo, video, or activity file with Teacher!
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
                      placeholder="e.g. My Family Drawing, Action Song Video..."
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
                      Attach Image, File, or Video (Photo, PDF, Word, Worksheet, MP4 Video)
                    </label>
                    <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[10.5px] font-bold text-amber-900">
                      📏 Applicable File Size Limits: 🖼️ Images: Max 10 MB • 📁 Files/Docs: Max 15 MB • 🎬 Videos (MP4/WebM/MOV): Max 50 MB
                    </div>
                    <input
                      type="file"
                      accept="image/*,video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                      onChange={handleFileChange}
                      className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-coral/10 file:text-coral-deep hover:file:bg-coral/20 cursor-pointer"
                    />
                    {uploadFilePreview && (() => {
                      const modalPreviewSrc = uploadFileDisplayUrl || uploadFilePreview;
                      const isModalImg = isImageItem({
                        url: modalPreviewSrc,
                        file_name: uploadFileName,
                        file_type: uploadFileType,
                      });
                      const isModalVid = isVideoItem({
                        url: modalPreviewSrc,
                        file_name: uploadFileName,
                        file_type: uploadFileType,
                      });
                      return (
                        <div className="mt-2.5 bg-slate-50 p-2.5 rounded-2xl border border-gray-200 space-y-2">
                          {isModalImg ? (
                            <img
                              src={modalPreviewSrc}
                              alt="Preview"
                              className="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-white"
                            />
                          ) : isModalVid ? (
                            <video
                              controls
                              playsInline
                              src={modalPreviewSrc}
                              className="w-full max-h-48 rounded-xl border border-gray-200 bg-black"
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
                              {isModalVid ? '🎬' : '📎'} {uploadFileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadFilePreview(null);
                                setUploadFileDisplayUrl(null);
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
                      );
                    })()}
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
                      className={`p-2.5 rounded-xl text-xs font-bold ${uploadMsg.type === 'error'
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
          {/* MODAL: IN-APP VIEWER FOR STUDENT UPLOADED MEDIA          */}
          {/* ======================================================== */}
          {studentPreviewModal && (() => {
            const fUrl = studentPreviewBlobUrl || studentPreviewModal.fileUrl || '';
            const fName = studentPreviewModal.fileName || '';
            const fType = (studentPreviewModal.fileType || '').toUpperCase();
            const embedUrl = getEmbeddedVideoUrl(fUrl);
            const isImg = isImageItem({ url: fUrl, file_name: fName, file_type: fType });
            const isVid = Boolean(embedUrl) || isVideoItem({ url: fUrl, file_name: fName, file_type: fType });
            const isPdf = isPdfItem({ url: fUrl, file_name: fName, file_type: fType });

            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                onClick={() => setStudentPreviewModal(null)}
              >
                <div
                  className="bg-white w-full max-w-xl rounded-3xl p-5 text-left shadow-2xl border border-[#F0E4CE] space-y-3.5 max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
                    <div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${studentPreviewModal.checked
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                      >
                        {studentPreviewModal.checked
                          ? '👩‍🏫 Checked by Teacher ✅'
                          : '⏳ Waiting for Teacher Check'}
                      </span>
                      <h3 className="font-baloo text-lg font-bold text-[#3a3226] m-0 mt-1">
                        {studentPreviewModal.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentPreviewModal(null)}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-dash-ink font-bold text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {studentPreviewModal.note && (
                    <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#F0E4CE] text-xs text-[#3a3226]">
                      "{studentPreviewModal.note}"
                    </div>
                  )}

                  {fUrl && (
                    <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3 space-y-2.5">
                      {embedUrl ? (
                        <iframe
                          src={embedUrl}
                          title={fName}
                          className="w-full aspect-video rounded-xl bg-black"
                          allowFullScreen
                        />
                      ) : isVid ? (
                        <video
                          controls
                          playsInline
                          src={fUrl}
                          className="w-full aspect-video rounded-xl bg-black"
                        />
                      ) : isImg ? (
                        <img
                          src={fUrl}
                          alt={fName}
                          className="w-full max-h-[420px] object-contain rounded-xl bg-white mx-auto block"
                        />
                      ) : isPdf ? (
                        <iframe
                          src={fUrl}
                          title={fName}
                          className="w-full h-[380px] rounded-xl bg-white"
                        />
                      ) : (
                        <div className="p-4 text-center bg-white rounded-xl border border-gray-200">
                          <div className="text-2xl">📄</div>
                          <div className="text-xs font-bold text-[#3a3226] mt-1">{fName}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] font-bold text-slate-600 truncate">
                          📎 {fName} {studentPreviewModal.fileSize ? `(${studentPreviewModal.fileSize})` : ''}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenOrDownloadFile(studentPreviewModal.fileUrl, fName, 'view')}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer"
                          >
                            🔍 Open in New Tab
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenOrDownloadFile(studentPreviewModal.fileUrl, fName, 'download')}
                            className="px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-slate-700 text-xs font-extrabold cursor-pointer"
                          >
                            ⬇️ Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
        </main>
      </div>
  );
}
