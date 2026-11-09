import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase, barangays } from '../../lib/supabaseClient';
import {
  initialTeacherModules,
  realTeachersList,
  realCdcsList,
  isAuthenticSupabaseMaterial,
  getCleanTeacherModulesList,
  deduplicateTeacherModules,
  cleanTeacherDisplayName,
} from '../../lib/curriculumData.js';
import {
  validateActivityFile,
  isVideoItem,
  isImageItem,
  isPdfItem,
  getEmbeddedVideoUrl,
  saveMediaBlobToIndexedDB,
  saveMediaToSupabaseChunks,
  resolveViewableMediaUrl,
} from '../../lib/mediaStorage.js';
import {
  IconSearch,
  IconCheck,
  IconClose,
  IconBuilding,
  IconPin,
  IconMaterials,
  IconPlus,
} from '../Icons.jsx';

export default function ProgramMonitoring({
  cdcs = [],
  onVerifyReport,
}) {
  const [activeTab, setActiveTab] = useState('all_posts'); // 'all_posts' | 'activities' | 'files' | 'videos' | 'trash' | 'compliance'
  const [viewLayout, setViewLayout] = useState('table'); // 'table' | 'cards'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [inspectingModule, setInspectingModule] = useState(null);
  const [inspectingMediaUrl, setInspectingMediaUrl] = useState(null);
  const [inspectingMediaLoading, setInspectingMediaLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Helper to retrieve authentic real teacher modules only, clearing out dummy partial data and category flashcards
  const getCleanTeacherModules = () => {
    return getCleanTeacherModulesList();
  };

  // Stored uploaded modules state (real teacher posts only)
  const [modules, setModules] = useState(getCleanTeacherModules);
  const [commentingModule, setCommentingModule] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentDecision, setCommentDecision] = useState('approve'); // 'approve' | 'revision' | 'keep'
  const [successToast, setSuccessToast] = useState('');
  const [lastDeletedModule, setLastDeletedModule] = useState(null);
  const [isLoadingSupabase, setIsLoadingSupabase] = useState(false);

  // Manual record post modal state
  const [newTitle, setNewTitle] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newLevel, setNewLevel] = useState('Pre-K1');
  const [newQuarter, setNewQuarter] = useState('1');
  const [newWeek, setNewWeek] = useState('Week 1');
  const [newSubTheme, setNewSubTheme] = useState('');
  const [newModuleType, setNewModuleType] = useState('Activity Worksheet');
  const [newDescription, setNewDescription] = useState('');
  const [newFilePreview, setNewFilePreview] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState('');
  const [newFileType, setNewFileType] = useState('');
  const [newFileError, setNewFileError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Resolve viewable media URL whenever inspectingModule changes
  useEffect(() => {
    let active = true;
    if (inspectingModule?.content_url || inspectingModule?.file_name || inspectingModule?.title) {
      setInspectingMediaLoading(true);
      resolveViewableMediaUrl(
        inspectingModule.content_url,
        inspectingModule.file_name,
        inspectingModule.title
      ).then((resolved) => {
        if (!active) return;
        const raw = inspectingModule.content_url || '';
        const fallbackSafe =
          raw && !raw.startsWith('idb://') && !raw.startsWith('sbchunk://') ? raw : null;
        setInspectingMediaUrl(resolved || fallbackSafe);
        setInspectingMediaLoading(false);
      });
    } else {
      setInspectingMediaUrl(null);
      setInspectingMediaLoading(false);
    }
    return () => {
      active = false;
    };
  }, [inspectingModule]);

  const handleRelinkAdminMedia = useCallback(async (mod, file) => {
    if (!mod || !file) return;
    try {
      const idbKey = await saveMediaBlobToIndexedDB(file, mod.title || '');
      const blobUrl = URL.createObjectURL(file);
      setInspectingMediaUrl(blobUrl);

      const syncedUrl = await saveMediaToSupabaseChunks({
        file,
        fileName: file.name,
        titleHint: mod.title || '',
      });
      const finalUrl = syncedUrl || idbKey;

      if (mod.id && !String(mod.id).startsWith('mod-') && syncedUrl) {
        await supabase.from('materials').update({ content_url: syncedUrl }).eq('id', mod.id);
      }

      setModules((prev) => {
        const updated = prev.map((m) =>
          m.id === mod.id || m.title === mod.title
            ? { ...m, content_url: finalUrl || m.content_url, file_name: file.name }
            : m
        );
        try {
          localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
        } catch { }
        return updated;
      });
    } catch { }
  }, []);

  // Helper to categorize a teacher post into 'activity' | 'file' | 'video'
  const getItemCategory = (mod) => {
    if (!mod) return 'activity';
    if (
      isVideoItem({
        fileUrl: mod.content_url,
        fileName: mod.file_name,
        fileType: mod.file_type,
        moduleType: mod.module_type || mod.type,
      })
    ) {
      return 'video';
    }
    const t = (mod.type || mod.module_type || mod.file_type || '').toLowerCase();
    if (t.includes('video') || t.includes('mp4') || t.includes('webm') || t.includes('mov')) return 'video';
    if (t.includes('file') || t.includes('doc') || t.includes('guide') || t.includes('plan')) return 'file';
    return 'activity';
  };

  // --- Load Materials directly from Supabase (Sync across all devices) ---
  const loadSupabaseModules = useCallback(async () => {
    setIsLoadingSupabase(true);
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data
          .filter((m) => isAuthenticSupabaseMaterial(m))
          .map((m) => {
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

          const isApproved = m.status === 'approved' || m.status === 'Approved';
          const isRejected = m.status === 'rejected' || m.status === 'Rejected' || m.status === 'needs_revision';
          const displayStatus = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending Review';

          return {
            id: m.id,
            assignment_id: meta.assignment_id || null,
            title: m.title || 'Curriculum Learning Material',
            teacher_name: cleanTeacherDisplayName(meta.teacher_name) || 'CDC Teacher',
            teacher_id: m.created_by,
            cdc_name: meta.cdc_name || 'Daycare Center',
            barangay: meta.barangay || 'Manolo Fortich',
            level: meta.level || (m.age_range?.includes('3') ? 'Pre-K1' : 'Pre-K2'),
            quarter: meta.quarter || 1,
            week: meta.week || 'Week 1',
            sub_theme: meta.sub_theme || '',
            theme: meta.theme || 'Early Childhood Learning',
            module_type: meta.module_type || (m.type === 'video' ? 'Video Lesson' : m.type === 'image' ? 'Worksheet Image' : 'Activity Worksheet'),
            file_type:
              meta.file_type ||
              (m.content_url?.startsWith('data:application/pdf')
                ? 'PDF'
                : m.content_url?.startsWith('data:video/') ||
                    m.content_url?.startsWith('sbchunk://') ||
                    m.content_url?.startsWith('idb://video')
                  ? 'MP4'
                  : m.content_url?.startsWith('data:image/')
                    ? 'IMAGE'
                    : m.type?.toUpperCase() || 'PDF'),
            file_size: meta.file_size || '2.4 MB',
            file_name:
              meta.file_name ||
              (m.content_url?.startsWith('data:application/pdf')
                ? 'Worksheet File (PDF)'
                : m.content_url?.startsWith('data:video/') || m.content_url?.startsWith('sbchunk://')
                  ? 'Video Lesson File'
                  : null),
            upload_date: m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Recent',
            status: displayStatus,
            verified_by_mswd: isApproved,
            posted_to_students: Boolean(meta.posted_to_students),
            target_student_id: meta.target_student_id || 'all',
            target_student_name: meta.target_student_name || 'All Class Learners',
            mswd_comments: meta.mswd_comments || '',
            revision_notes: meta.revision_notes || '',
            is_deleted: Boolean(meta.is_deleted),
            deleted_at: meta.deleted_at || null,
            raw_meta: meta,
            description: cleanDescription || 'Curriculum activity worksheet for daycare learners.',
            content_url: m.content_url || null,
            content_text: cleanDescription,
            downloads_count: 0,
            from_supabase: true,
          };
        });

        const deduplicatedSb = deduplicateTeacherModules(mapped);

        // Automatically remove stale duplicate Supabase rows for the same teacher + topic
        const staleDbIds = [];
        deduplicatedSb.forEach((item) => {
          if (Array.isArray(item.duplicate_ids) && item.duplicate_ids.length > 1) {
            item.duplicate_ids.forEach((dupId) => {
              if (dupId && dupId !== item.id && !String(dupId).startsWith('mod-')) {
                staleDbIds.push(dupId);
              }
            });
          }
        });
        if (staleDbIds.length > 0) {
          supabase
            .from('materials')
            .delete()
            .in('id', staleDbIds)
            .then(() => {})
            .catch(() => {});
        }

        setModules(() => {
          const localList = getCleanTeacherModules();
          const merged = deduplicatedSb.map((sbItem) => {
            const loc = localList.find(
              (l) =>
                l.id === sbItem.id ||
                (l.title && sbItem.title && l.title.trim().toLowerCase() === sbItem.title.trim().toLowerCase())
            );
            if (loc) {
              const bestUrl =
                sbItem.content_url && !String(sbItem.content_url).startsWith('idb://filename/')
                  ? sbItem.content_url
                  : loc.content_url || sbItem.content_url || null;
              return {
                ...sbItem,
                file_name: sbItem.file_name || loc.file_name || null,
                file_type: sbItem.file_type || loc.file_type || 'PDF',
                file_size: sbItem.file_size || loc.file_size || '2.4 MB',
                is_deleted: Boolean(loc.is_deleted ?? sbItem.is_deleted),
                deleted_at: loc.deleted_at || sbItem.deleted_at || null,
                posted_to_students: Boolean(loc.posted_to_students ?? sbItem.posted_to_students),
                target_student_id: loc.target_student_id || sbItem.target_student_id || 'all',
                target_student_name: loc.target_student_name || sbItem.target_student_name || 'All Class Learners',
                mswd_comments: loc.mswd_comments || sbItem.mswd_comments || '',
                revision_notes: loc.revision_notes || sbItem.revision_notes || '',
                content_url: bestUrl,
              };
            }
            return sbItem;
          });
          const localOnly = localList.filter((p) => !merged.some((s) => s.id === p.id));
          return deduplicateTeacherModules([...merged, ...localOnly]);
        });
      }
    } catch (err) {
      console.warn('Could not load Supabase materials:', err);
    } finally {
      setIsLoadingSupabase(false);
    }
  }, []);

  // Real-time synchronization with Teacher Dashboard posts
  useEffect(() => {
    loadSupabaseModules();

    const handleSync = () => {
      setModules((prev) => {
        const local = getCleanTeacherModules();
        const sbOnly = prev.filter((p) => p.from_supabase);
        const uniqueLocal = local.filter((l) => !sbOnly.some((s) => s.id === l.id));
        return deduplicateTeacherModules([...sbOnly, ...uniqueLocal]);
      });
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('earlylearn_modules_updated', handleSync);

    // Supabase Realtime channel for live cross-device sync
    let channel;
    try {
      channel = supabase
        .channel('program-monitoring-materials')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
          loadSupabaseModules();
        })
        .subscribe();
    } catch { }

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_modules_updated', handleSync);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadSupabaseModules]);

  // Open / view or download file attachment helper (defaults to 'view' so it opens in browser without downloading)
  const handleDownloadFile = async (mod, mode = 'view') => {
    if (!mod) return;
    const resolvedUrl =
      (await resolveViewableMediaUrl(mod.content_url, mod.file_name, mod.title)) ||
      (mod.content_url &&
      !String(mod.content_url).startsWith('idb://') &&
      !String(mod.content_url).startsWith('sbchunk://')
        ? mod.content_url
        : null);

    if (resolvedUrl) {
      if (mode === 'view') {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      } else {
        const link = document.createElement('a');
        link.href = resolvedUrl;
        link.download =
          mod.file_name ||
          `${(mod.title || 'learning_material').replace(/[^a-z0-9]/gi, '_')}.${mod.file_type?.toLowerCase() || 'pdf'}`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      alert(`The uploaded file for "${mod.title}" is not cached on this browser yet. Please click "Load Teacher File / Video to View" inside the preview box.`);
    }
  };

  // Soft Delete Activity (Moves to Deleted / Retrieve Tab so Admin can Retrieve or Permanently Delete)
  const handleDeleteModule = async (mod) => {
    if (!mod) return;
    const deletedAt = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    const updated = modules.map((m) =>
      m.id === mod.id ? { ...m, is_deleted: true, deleted_at: deletedAt } : m
    );
    setModules(updated);
    setLastDeletedModule(mod);

    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch { }

    // Sync soft-delete metadata to Supabase materials
    try {
      const updatedMeta = {
        ...(mod.raw_meta || {}),
        __metadata: true,
        assignment_id: mod.assignment_id || null,
        description: mod.description || '',
        teacher_name: mod.teacher_name || 'Teacher',
        cdc_name: mod.cdc_name || 'Daycare Center',
        barangay: mod.barangay || 'Manolo Fortich',
        level: mod.level || 'Pre-K1',
        quarter: mod.quarter || 1,
        week: mod.week || 'Week 1',
        sub_theme: mod.sub_theme || '',
        theme: mod.theme || '',
        module_type: mod.module_type || 'Activity Worksheet',
        file_type: mod.file_type || 'PDF',
        file_size: mod.file_size || '2.4 MB',
        file_name: mod.file_name || null,
        posted_to_students: false,
        mswd_comments: mod.mswd_comments || '',
        revision_notes: mod.revision_notes || '',
        is_deleted: true,
        deleted_at: deletedAt,
      };
      await supabase
        .from('materials')
        .update({ content_text: JSON.stringify(updatedMeta) })
        .eq('id', mod.id);
    } catch { }

    if (inspectingModule?.id === mod.id) {
      setInspectingModule(null);
    }

    setSuccessToast(
      `🗑️ "${mod.title}" moved to Deleted / Retrieve tab. You can retrieve it anytime.`
    );
    setTimeout(() => setSuccessToast(''), 5000);
  };

  // Retrieve / Restore Soft-Deleted Activity back to Active Monitoring
  const handleRetrieveModule = async (mod) => {
    if (!mod) return;
    const updated = modules.map((m) =>
      m.id === mod.id ? { ...m, is_deleted: false, deleted_at: null } : m
    );
    setModules(updated);
    if (lastDeletedModule?.id === mod.id) {
      setLastDeletedModule(null);
    }

    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch { }

    try {
      const updatedMeta = {
        ...(mod.raw_meta || {}),
        __metadata: true,
        assignment_id: mod.assignment_id || null,
        description: mod.description || '',
        teacher_name: mod.teacher_name || 'Teacher',
        cdc_name: mod.cdc_name || 'Daycare Center',
        barangay: mod.barangay || 'Manolo Fortich',
        level: mod.level || 'Pre-K1',
        quarter: mod.quarter || 1,
        week: mod.week || 'Week 1',
        sub_theme: mod.sub_theme || '',
        theme: mod.theme || '',
        module_type: mod.module_type || 'Activity Worksheet',
        file_type: mod.file_type || 'PDF',
        file_size: mod.file_size || '2.4 MB',
        file_name: mod.file_name || null,
        posted_to_students: Boolean(mod.posted_to_students),
        mswd_comments: mod.mswd_comments || '',
        revision_notes: mod.revision_notes || '',
        is_deleted: false,
        deleted_at: null,
      };
      await supabase
        .from('materials')
        .update({ content_text: JSON.stringify(updatedMeta) })
        .eq('id', mod.id);
    } catch { }

    if (inspectingModule?.id === mod.id) {
      setInspectingModule((prev) => (prev ? { ...prev, is_deleted: false, deleted_at: null } : null));
    }

    setSuccessToast(`♻️ Retrieved "${mod.title}" back to active Activity Monitoring!`);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // Permanently Delete Activity from Trash
  const handlePermanentDeleteModule = async (mod) => {
    if (!mod) return;
    if (!confirm(`Permanently delete "${mod.title}"? This action cannot be undone.`)) return;

    const updated = modules.filter((m) => m.id !== mod.id);
    setModules(updated);
    if (lastDeletedModule?.id === mod.id) setLastDeletedModule(null);

    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch { }

    try {
      await supabase.from('materials').delete().eq('id', mod.id);
    } catch { }

    if (inspectingModule?.id === mod.id) {
      setInspectingModule(null);
    }

    setSuccessToast(`🗑️ Permanently deleted "${mod.title}".`);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  // Open Comment dialog
  const handleOpenComment = (module) => {
    setCommentingModule(module);
    setCommentText(module.mswd_comments || module.revision_notes || '');
    setCommentDecision(module.verified_by_mswd ? 'approve' : 'keep');
  };

  // Save MSWD Review Comment & Decision
  const handleSaveComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentingModule) return;

    const updated = modules.map((m) => {
      if (m.id !== commentingModule.id) return m;

      let newStatus = m.status;
      let newVerified = m.verified_by_mswd;
      let newPosted = m.posted_to_students;

      if (commentDecision === 'approve') {
        newStatus = 'Approved';
        newVerified = true;
      } else if (commentDecision === 'revision') {
        newStatus = 'Rejected';
        newVerified = false;
        newPosted = false;
      }

      return {
        ...m,
        mswd_comments: commentText.trim(),
        revision_notes: commentDecision === 'revision' ? commentText.trim() : m.revision_notes,
        mswd_comment_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: newStatus,
        verified_by_mswd: newVerified,
        posted_to_students: newPosted,
      };
    });

    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }

    // Update status in Supabase so other devices see the approval/rejection immediately
    const sbStatus = commentDecision === 'approve' ? 'approved' : commentDecision === 'revision' ? 'rejected' : 'pending';
    try {
      await supabase.from('materials').update({ status: sbStatus }).eq('id', commentingModule.id);
    } catch (err) {
      console.warn('Error updating material status in Supabase:', err);
    }

    if (inspectingModule?.id === commentingModule.id) {
      setInspectingModule(updated.find((m) => m.id === commentingModule.id));
    }

    setCommentingModule(null);
    setCommentText('');
    setSuccessToast(
      commentDecision === 'approve'
        ? '✅ Complied activity APPROVED by MSWD! The teacher can now post it to their specific Student Dashboard.'
        : commentDecision === 'revision'
          ? '❌ Complied activity REJECTED by MSWD. The teacher has been notified.'
          : '✅ Review comment saved! The teacher will see your feedback in their dashboard.'
    );
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // Handle Verify / Approve Module
  const handleApproveModule = async (moduleId) => {
    const updated = modules.map((m) =>
      m.id === moduleId
        ? {
          ...m,
          status: 'Approved',
          verified_by_mswd: true,
          mswd_approved_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        }
        : m
    );
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }

    // Sync approval to Supabase materials table
    try {
      await supabase.from('materials').update({ status: 'approved' }).eq('id', moduleId);
    } catch (err) {
      console.warn('Error updating approval in Supabase:', err);
    }

    if (inspectingModule?.id === moduleId) {
      setInspectingModule((prev) => (prev ? { ...prev, status: 'Approved', verified_by_mswd: true } : null));
    }

    setSuccessToast('✅ Complied activity APPROVED by MSWD! The teacher can now post this activity to their specific Student Dashboard.');
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // Handle Reject Module directly or with feedback
  const handleRejectModule = async (moduleId) => {
    const updated = modules.map((m) =>
      m.id === moduleId
        ? {
          ...m,
          status: 'Rejected',
          verified_by_mswd: false,
          posted_to_students: false,
        }
        : m
    );
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }

    try {
      await supabase.from('materials').update({ status: 'rejected' }).eq('id', moduleId);
    } catch (err) {
      console.warn('Error updating rejection in Supabase:', err);
    }

    if (inspectingModule?.id === moduleId) {
      setInspectingModule((prev) => (prev ? { ...prev, status: 'Rejected', verified_by_mswd: false, posted_to_students: false } : null));
    }

    setSuccessToast('❌ Complied activity marked as REJECTED by MSWD.');
    setTimeout(() => setSuccessToast(''), 3500);
  };

  // Handle File Selection in Admin Record Post Modal (with size limit validation)
  const handleAdminFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFileError('');

    const validation = validateActivityFile(file);
    if (!validation.valid) {
      setNewFileError(validation.error);
      e.target.value = '';
      return;
    }

    setNewFileName(file.name);
    setNewFileSize(validation.sizeFormatted);
    setNewFileType(validation.fileType);

    if (validation.category === 'video') {
      setNewModuleType('Video Lesson Guide');
    } else if (validation.category === 'document') {
      setNewModuleType('Official PDF Document');
    }

    // Store large video/files (> 3 MB) in IndexedDB so localStorage never overflows
    if (file.size > 3 * 1024 * 1024) {
      const idbKey = `idb://${validation.category}-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
      await saveMediaBlobToIndexedDB(idbKey, file);
      setNewFilePreview(idbKey);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewFilePreview(ev.target?.result || null);
    };
    reader.readAsDataURL(file);
  };

  // Handle Add Module manually
  const handleCreateModule = (e) => {
    e.preventDefault();
    const teacher = realTeachersList.find((t) => t.id === newTeacherId);
    if (!teacher) {
      alert('Please select a teacher.');
      return;
    }

    const newModuleObj = {
      id: 'mod-' + Date.now(),
      title: newTitle.trim(),
      teacher_name: teacher.full_name,
      teacher_id: teacher.id,
      cdc_name: teacher.cdc_name,
      barangay: teacher.barangay,
      level: newLevel,
      quarter: parseInt(newQuarter, 10),
      week: newWeek,
      sub_theme: newSubTheme,
      theme: newLevel === 'Pre-K1' ? 'TELL ME ABOUT YOURSELF' : 'MORE ABOUT MYSELF AND MY SCHOOL',
      module_type: newModuleType,
      file_type: newFileType || (newModuleType.toLowerCase().includes('video') ? 'MP4' : 'PDF'),
      file_size: newFileSize || '2.5 MB',
      file_name: newFileName || null,
      content_url: newFilePreview || null,
      upload_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Approved',
      verified_by_mswd: true,
      is_deleted: false,
      description: newDescription.trim() || 'Teacher-prepared early childhood module for daycare learners.',
      downloads_count: 0,
      is_custom_teacher_upload: true,
    };

    const updated = [newModuleObj, ...modules];
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }

    setUploadSuccess('✅ Post successfully recorded and verified!');
    setTimeout(() => {
      setUploadModalOpen(false);
      setUploadSuccess('');
      setNewTitle('');
      setNewDescription('');
      setNewFilePreview(null);
      setNewFileName('');
      setNewFileSize('');
      setNewFileType('');
      setNewFileError('');
    }, 1200);
  };

  const activeModules = useMemo(() => modules.filter((m) => !m.is_deleted), [modules]);
  const deletedModules = useMemo(() => modules.filter((m) => m.is_deleted), [modules]);

  // Filtered Modules Feed
  const filteredModules = useMemo(() => {
    const sourceList = activeTab === 'trash' ? deletedModules : activeModules;
    return sourceList.filter((m) => {
      const cat = getItemCategory(m);

      // Tab filtering
      if (activeTab === 'activities' && cat !== 'activity') return false;
      if (activeTab === 'files' && cat !== 'file') return false;
      if (activeTab === 'videos' && cat !== 'video') return false;

      const matchesSearch =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cdc_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.sub_theme || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.barangay || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.module_type || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBarangay = !selectedBarangay || m.barangay?.toLowerCase() === selectedBarangay.toLowerCase();
      const matchesLevel = selectedLevel === 'all' || m.level?.toLowerCase() === selectedLevel.toLowerCase();
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'approved' && m.verified_by_mswd) ||
        (selectedStatus === 'pending' && !m.verified_by_mswd);

      return matchesSearch && matchesBarangay && matchesLevel && matchesStatus;
    });
  }, [activeModules, deletedModules, activeTab, searchTerm, selectedBarangay, selectedLevel, selectedStatus]);

  // Aggregate counts (active items + deleted count)
  const totalModules = activeModules.length;
  const activityCount = activeModules.filter((m) => getItemCategory(m) === 'activity').length;
  const fileCount = activeModules.filter((m) => getItemCategory(m) === 'file').length;
  const videoCount = activeModules.filter((m) => getItemCategory(m) === 'video').length;
  const deletedCount = deletedModules.length;
  const approvedModules = activeModules.filter((m) => m.verified_by_mswd).length;
  const pendingModules = activeModules.filter((m) => !m.verified_by_mswd).length;
  const activeTeachersCount = new Set(activeModules.map((m) => m.teacher_name)).size;

  // Center Upload Compliance calculation
  const cdcComplianceData = useMemo(() => {
    const list = cdcs.length > 0 ? cdcs : realCdcsList;
    return list.map((cdc) => {
      const cdcModules = modules.filter(
        (m) => m.cdc_name === cdc.name || m.barangay === cdc.barangay
      );
      const count = cdcModules.length;
      const target = 2;
      const rate = Math.min(100, Math.round((count / target) * 100));

      let complianceStatus = 'Compliant';
      if (count === 0) complianceStatus = 'No Uploads';
      else if (rate < 100) complianceStatus = 'Partial';

      return {
        ...cdc,
        moduleCount: count,
        complianceRate: rate,
        complianceStatus,
        recentModule: cdcModules[0] || null,
      };
    });
  }, [cdcs, modules]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-[#DCEBDD] border border-emerald-300 text-[#2E6B38] font-bold text-xs flex items-center justify-between gap-2 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔔</span>
            <span>{successToast}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastDeletedModule && (
              <button
                type="button"
                onClick={() => handleRetrieveModule(lastDeletedModule)}
                className="px-2.5 py-1 rounded-lg bg-[#2E6B38] hover:bg-[#23532B] text-white text-[11px] font-bold cursor-pointer"
              >
                ♻️ Retrieve / Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuccessToast('')}
              className="text-[#2E6B38] hover:text-[#23532B] font-bold text-sm px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row: Organized summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Teacher Posts
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {totalModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5 flex items-center gap-1.5">
            <span className="font-semibold text-amber-700">{activityCount} Activities</span>
            <span>•</span>
            <span className="font-semibold text-sky-700">{fileCount} Files</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Approved &amp; Verified
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {approvedModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {totalModules > 0 ? `${Math.round((approvedModules / totalModules) * 100)}% verified by MSWDO` : '0% verified by MSWDO'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
            Pending MSWD Review
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {pendingModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Awaiting verification</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-accent uppercase tracking-wider">
            Active Teachers
          </div>
          <div className="font-fraunces text-2xl font-bold text-accent mt-1">
            {activeTeachersCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {activeTeachersCount > 0
              ? `Across ${new Set(modules.map((m) => m.cdc_name)).size} CDC${new Set(modules.map((m) => m.cdc_name)).size === 1 ? '' : 's'}`
              : 'Awaiting uploads'}
          </div>
        </div>
      </div>

      {/* Main Monitoring Card */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        {/* Top Header & Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#F0E6D2]">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent bg-[#FFF5EE] px-2.5 py-0.5 rounded-full mb-1">
              <span>📋</span>
              <span>Activity &amp; File Monitoring</span>
            </div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Teacher Posted Activities &amp; Files Tracker
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Review and verify teaching activity worksheets, lesson guides, sensory crafts, and uploaded files submitted by teachers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewLayout === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
                title="Concise Table View"
              >
                📑 Concise Table
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewLayout === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
                title="Expanded Cards View"
              >
                🗂️ Cards
              </button>
            </div>

            <button
              type="button"
              onClick={loadSupabaseModules}
              disabled={isLoadingSupabase}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sync latest teacher uploads directly from Supabase across all devices"
            >
              <span className={isLoadingSupabase ? 'animate-spin' : ''}>🔄</span>
              <span>{isLoadingSupabase ? 'Syncing...' : 'Sync Supabase'}</span>
            </button>

            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Record Post Upload</span>
            </button>
          </div>
        </div>

        {/* Category Tabs: All, Activities, Files, Videos, Compliance */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
          <button
            onClick={() => setActiveTab('all_posts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'all_posts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
          >
            <span>📚 All Posts</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all_posts' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {totalModules}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'activities'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
          >
            <span>✏️ Activity Worksheets</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'activities' ? 'bg-white/20 text-white' : 'bg-amber-200/60 text-amber-900'}`}>
              {activityCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'files'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-sky-50 text-sky-900 hover:bg-sky-100'
              }`}
          >
            <span>📁 Files &amp; Documents</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'files' ? 'bg-white/20 text-white' : 'bg-sky-200/60 text-sky-900'}`}>
              {fileCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'videos'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
              }`}
          >
            <span>🎬 Video Lessons</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'videos' ? 'bg-white/20 text-white' : 'bg-purple-200/60 text-purple-900'}`}>
              {videoCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('trash')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'trash'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            title="View deleted activities and retrieve or permanently remove them"
          >
            <span>♻️ Deleted / Retrieve</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'trash' ? 'bg-white/20 text-white' : 'bg-rose-200/70 text-rose-900'}`}>
              {deletedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ml-auto ${activeTab === 'compliance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-[#FAF5EC] text-dash-ink hover:bg-[#F0E8D8]'
              }`}
          >
            <span>📊 Center Compliance Tracker</span>
          </button>
        </div>

        {/* Filter Toolbar (Search, Barangay, Level, Status) */}
        {activeTab !== 'compliance' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="relative">
              <IconSearch className="w-4 h-4 text-[#A89F91] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search activity, file, teacher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-semibold text-dash-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
              >
                <option value="">All 22 Barangays</option>
                {barangays.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
              >
                <option value="all">All Curriculum Levels</option>
                <option value="pre-k1">Pre-K 1 (3.11 years old)</option>
                <option value="pre-k2">Pre-K 2 (4.11 years old)</option>
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
              >
                <option value="all">All Verification Statuses</option>
                <option value="approved">Approved &amp; Verified</option>
                <option value="pending">Pending MSWD Review</option>
              </select>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: CONCISE TABLE VIEW FOR ACTIVITIES & FILES        */}
        {/* ======================================================== */}
        {activeTab !== 'compliance' && viewLayout === 'table' && (
          <div className="overflow-x-auto rounded-xl border border-card-border mt-2">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                  <th className="px-3.5 py-3 text-center">Type</th>
                  <th className="px-4 py-3">Topic &amp; Posted Title</th>
                  <th className="px-4 py-3">Teacher &amp; Day Care Center</th>
                  <th className="px-3 py-3 text-center">Level / Quarter</th>
                  <th className="px-3 py-3 text-center">File Details</th>
                  <th className="px-3 py-3 text-center">Date Posted</th>
                  <th className="px-3 py-3 text-center">MSWDO Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredModules.map((module) => {
                  const cat = getItemCategory(module);

                  return (
                    <tr key={module.id} className="hover:bg-[#FFFDF9] transition-colors">
                      {/* 1. Type Badge */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {cat === 'activity' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span>✏️ Activity</span>
                          </span>
                        )}
                        {cat === 'file' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <span>📁 File/Doc</span>
                          </span>
                        )}
                        {cat === 'video' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            <span>🎬 Video</span>
                          </span>
                        )}
                      </td>

                      {/* 2. Topic & Title */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-bold text-dash-ink text-xs line-clamp-1">
                          {module.title}
                        </div>
                        <div className="text-[11px] text-[#8C6200] font-medium mt-0.5 line-clamp-1">
                          {module.week}: {module.sub_theme || module.theme}
                        </div>
                        {module.description && (
                          <div className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                            {module.description}
                          </div>
                        )}
                        {module.mswd_comments && (
                          <div
                            className="text-[10px] text-amber-800 bg-amber-50/90 px-2 py-0.5 rounded border border-amber-200 mt-1 flex items-center gap-1 font-medium"
                            title={module.mswd_comments}
                          >
                            <span className="font-bold shrink-0">💬 MSWD Note:</span>
                            <span className="truncate">{module.mswd_comments}</span>
                          </div>
                        )}
                      </td>

                      {/* 3. Teacher & CDC */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{module.teacher_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <IconBuilding className="w-3 h-3 text-accent shrink-0" />
                          <span>{module.cdc_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Brgy. {module.barangay}
                        </div>
                      </td>

                      {/* 4. Level & Quarter */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold ${module.level === 'Pre-K1'
                            ? 'bg-[#DCEBDD] text-[#2E6B38]'
                            : 'bg-[#E0EFFE] text-[#1E5B94]'
                            }`}
                        >
                          {module.level} • Q{module.quarter}
                        </span>
                      </td>

                      {/* 5. File Details */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10.5px]">
                          {module.file_type || 'PDF'} • {module.file_size || '2.4 MB'}
                        </span>
                      </td>

                      {/* 6. Date */}
                      <td className="px-3 py-3 text-center whitespace-nowrap text-slate-600 font-medium">
                        {module.upload_date}
                      </td>

                      {/* 7. Status */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${module.verified_by_mswd || module.status === 'Approved'
                              ? 'bg-[#DCEBDD] text-[#2E6B38] border border-emerald-200'
                              : module.status === 'Rejected' || module.status === 'Needs Revision'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                          >
                            {module.verified_by_mswd || module.status === 'Approved'
                              ? 'Approved ✓'
                              : module.status === 'Rejected' || module.status === 'Needs Revision'
                                ? 'Rejected ✕'
                                : 'Pending Review'}
                          </span>
                          {(module.verified_by_mswd || module.status === 'Approved') && (
                            <span
                              className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${module.posted_to_students
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                            >
                              {module.posted_to_students
                                ? `🚀 Posted (${module.target_student_name || 'Class'})`
                                : '🔓 Teacher Can Post Now'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Actions: View, Comment, Approve, Delete / Retrieve */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                          {/* 1. View Button (Available before & after checking) */}
                          <button
                            onClick={() => setInspectingModule(module)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-[11px] transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1 shadow-2xs"
                            title="View or play activity file, image, or video before & after checking"
                          >
                            <span>👁️</span>
                            <span>View</span>
                          </button>

                          {!module.is_deleted ? (
                            <>
                              {/* 2. Comment Button */}
                              <button
                                onClick={() => handleOpenComment(module)}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-[11px] transition-colors cursor-pointer border border-sky-200 flex items-center gap-1 shadow-2xs"
                                title="Add MSWD review notes & comments"
                              >
                                <span>💬</span>
                                <span>{module.mswd_comments ? 'Commented' : 'Comment'}</span>
                              </button>

                              {/* 3. Approve / Reject Action Buttons */}
                              {!module.verified_by_mswd ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleApproveModule(module.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                    title="Approve and publish to this teacher's students"
                                  >
                                    <span>✓</span>
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectModule(module.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                                    title="Reject / Request revisions from teacher"
                                  >
                                    <span>✕</span>
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <span
                                    className="px-2.5 py-1.5 rounded-lg bg-[#DCEBDD] text-[#2E6B38] font-bold text-[11px] border border-emerald-300 inline-flex items-center gap-1"
                                    title="Officially approved by MSWD & live on student dashboard"
                                  >
                                    <span>✓</span>
                                    <span>Approved</span>
                                  </span>
                                  <button
                                    onClick={() => handleRejectModule(module.id)}
                                    className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Revoke approval or reject"
                                  >
                                    <span>Revoke</span>
                                  </button>
                                </div>
                              )}

                              {/* 4. Delete Button (Soft Delete to Deleted / Retrieve tab) */}
                              <button
                                onClick={() => handleDeleteModule(module)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="Delete activity (can be retrieved from Deleted / Retrieve tab)"
                              >
                                <span>🗑️</span>
                                <span>Delete</span>
                              </button>
                            </>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleRetrieveModule(module)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                title="Retrieve and restore this deleted activity"
                              >
                                <span>♻️</span>
                                <span>Retrieve</span>
                              </button>
                              <button
                                onClick={() => handlePermanentDeleteModule(module)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                title="Permanently delete this activity"
                              >
                                <span>🗑️</span>
                                <span>Delete Forever</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredModules.length === 0 && (
              <div className="text-center py-12 px-4 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xl flex items-center justify-center mx-auto mb-3">
                  📂
                </div>
                <h4 className="font-fraunces text-base font-bold text-dash-ink">
                  {totalModules === 0 ? 'No Teacher Activities Posted Yet' : 'No Matching Posts Found'}
                </h4>
                <p className="text-xs text-dash-ink-soft max-w-md mx-auto mt-1 leading-relaxed">
                  {totalModules === 0
                    ? 'When daycare teachers submit activity worksheets, lesson guides, or learning materials from their Teacher Dashboard, they will immediately appear here in real time for MSWD review, commenting, and approval.'
                    : 'No teacher posts match your current search query or active filter selections. Try clearing your filters or search term.'}
                </p>
                {totalModules === 0 && (
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>+ Record First Post Upload</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1 (ALTERNATIVE): EXPANDED CARDS VIEW                 */}
        {/* ======================================================== */}
        {activeTab !== 'compliance' && viewLayout === 'cards' && (
          <div className="space-y-3 pt-2">
            {filteredModules.map((module) => {
              const cat = getItemCategory(module);

              return (
                <div
                  key={module.id}
                  className="p-4 rounded-2xl bg-[#FFFDF9] border border-card-border hover:border-accent transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {cat === 'activity' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ✏️ Activity Worksheet
                        </span>
                      ) : cat === 'file' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-900 border border-sky-300">
                          📁 Document File / PDF
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-900 border border-purple-300">
                          🎬 Video Lesson
                        </span>
                      )}

                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${module.level === 'Pre-K1'
                          ? 'bg-[#DCEBDD] text-[#2E6B38]'
                          : 'bg-[#E0EFFE] text-[#1E5B94]'
                          }`}
                      >
                        {module.level} • Q{module.quarter}
                      </span>

                      <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2.5 py-0.5 rounded-md">
                        {module.week}: {module.sub_theme || module.theme}
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${module.verified_by_mswd
                          ? 'bg-[#DCEBDD] text-[#2E6B38]'
                          : module.status === 'Needs Revision'
                            ? 'bg-[#FDE2E2] text-danger'
                            : 'bg-[#FFF3D6] text-[#8C6200]'
                          }`}
                      >
                        {module.verified_by_mswd ? 'Verified by MSWDO ✓' : module.status || 'Pending Review'}
                      </span>
                    </div>

                    <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                      {module.title}
                    </h4>

                    <div className="text-xs text-dash-ink-soft flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Teacher: <b className="text-dash-ink font-semibold">{module.teacher_name}</b>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <IconBuilding className="w-3.5 h-3.5 text-accent" />
                        <span>{module.cdc_name}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <IconPin className="w-3 h-3 text-[#A89F91]" />
                        <span>Brgy. {module.barangay}</span>
                      </span>
                      <span>•</span>
                      <span>Uploaded: {module.upload_date}</span>
                    </div>

                    <p className="text-xs text-[#5A4C3C] m-0 leading-relaxed pt-0.5">
                      {module.description}
                    </p>

                    {module.mswd_comments && (
                      <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                        <span className="font-bold text-amber-800 shrink-0">💬 MSWD Note:</span>
                        <span className="italic leading-relaxed">{module.mswd_comments}</span>
                      </div>
                    )}

                    <div className="text-[11px] text-dash-ink-soft flex items-center gap-3 pt-1">
                      <span className="bg-[#FAF5EC] px-2 py-0.5 rounded border border-[#EBE1CF] font-mono">
                        📄 {module.module_type || 'Activity Worksheet'} ({module.file_type || 'PDF'} • {module.file_size || '2.4 MB'})
                      </span>
                      <span>📥 {module.downloads_count || 0} Downloads</span>
                    </div>
                  </div>

                  {/* Actions Cluster: View, Comment, Approve, Delete / Retrieve */}
                  <div className="flex sm:flex-row md:flex-col items-end justify-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* 1. View Button */}
                      <button
                        onClick={() => setInspectingModule(module)}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1 shadow-2xs"
                        title="View or play activity file, image, or video before & after checking"
                      >
                        <span>👁️</span>
                        <span>View</span>
                      </button>

                      {!module.is_deleted ? (
                        <>
                          {/* 2. Comment Button */}
                          <button
                            onClick={() => handleOpenComment(module)}
                            className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-xs transition-colors cursor-pointer border border-sky-200 flex items-center gap-1 shadow-2xs"
                            title="Add MSWD review feedback & comment"
                          >
                            <span>💬</span>
                            <span>{module.mswd_comments ? 'Edit Comment' : 'Comment'}</span>
                          </button>

                          {/* 3. Approve & Reject Buttons */}
                          {!module.verified_by_mswd ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleApproveModule(module.id)}
                                className="px-3 py-1.5 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                title="Approve and publish to this teacher's students"
                              >
                                <span>✓</span>
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleRejectModule(module.id)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="Reject / Request revisions from teacher"
                              >
                                <span>✕</span>
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="px-3 py-1.5 rounded-xl bg-[#DCEBDD] text-[#2E6B38] font-bold text-xs border border-emerald-300 flex items-center gap-1">
                                <span>✓</span>
                                <span>Approved</span>
                              </span>
                              <button
                                onClick={() => handleRejectModule(module.id)}
                                className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 text-[11px] font-bold transition-colors cursor-pointer"
                                title="Revoke approval or reject"
                              >
                                <span>Revoke</span>
                              </button>
                            </div>
                          )}

                          {/* 4. Delete Button */}
                          <button
                            onClick={() => handleDeleteModule(module)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                            title="Delete activity (can be retrieved from Deleted / Retrieve tab)"
                          >
                            <span>🗑️</span>
                            <span>Delete</span>
                          </button>
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleRetrieveModule(module)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            title="Retrieve and restore this deleted activity"
                          >
                            <span>♻️</span>
                            <span>Retrieve</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteModule(module)}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            title="Permanently delete this activity"
                          >
                            <span>🗑️</span>
                            <span>Delete Forever</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredModules.length === 0 && (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xl flex items-center justify-center mx-auto mb-3">
                  📂
                </div>
                <h4 className="font-fraunces text-base font-bold text-dash-ink">
                  {totalModules === 0 ? 'No Teacher Activities Posted Yet' : 'No Matching Posts Found'}
                </h4>
                <p className="text-xs text-dash-ink-soft max-w-md mx-auto mt-1 leading-relaxed">
                  {totalModules === 0
                    ? 'When daycare teachers submit activity worksheets, lesson guides, or learning materials from their Teacher Dashboard, they will immediately appear here in real time for MSWD review, commenting, and approval.'
                    : 'No teacher posts match your current search query or active filter selections. Try clearing your filters or search term.'}
                </p>
                {totalModules === 0 && (
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>+ Record First Post Upload</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: DAYCARE CENTER MODULE COMPLIANCE TRACKER          */}
        {/* ======================================================== */}
        {activeTab === 'compliance' && (
          <div className="space-y-4 pt-2">
            <div className="overflow-x-auto rounded-xl border border-card-border">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                    <th className="px-4 py-3">Daycare Center &amp; Barangay</th>
                    <th className="px-4 py-3 text-center">Modules Uploaded</th>
                    <th className="px-4 py-3">Monthly Target Progress</th>
                    <th className="px-4 py-3">Latest Module Title</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6F1E7]">
                  {cdcComplianceData.map((c) => (
                    <tr key={c.id || c.name} className="hover:bg-[#FFFDF9] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-dash-ink">{c.name}</div>
                        <div className="text-[11px] text-dash-ink-soft">
                          Brgy. {c.barangay}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-xs bg-[#FFF9ED] px-3 py-1 rounded-lg border border-[#F0E4CE]">
                          {c.moduleCount}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="w-full max-w-xs space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span>{c.complianceRate}% of target</span>
                            <span className="text-dash-ink-soft">{c.moduleCount} / 2 uploads</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#EFE8DC] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${c.complianceRate >= 100
                                ? 'bg-[#2E6B38]'
                                : c.complianceRate > 0
                                  ? 'bg-accent'
                                  : 'bg-danger'
                                }`}
                              style={{ width: `${c.complianceRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {c.recentModule ? (
                          <div className="max-w-xs">
                            <div className="font-bold text-xs truncate">
                              {c.recentModule.title}
                            </div>
                            <div className="text-[10.5px] text-dash-ink-soft">
                              {c.recentModule.upload_date} • {c.recentModule.teacher_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-dash-ink-soft italic text-[11px]">
                            No modules uploaded yet
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${c.complianceStatus === 'Compliant'
                            ? 'bg-[#DCEBDD] text-[#2E6B38]'
                            : c.complianceStatus === 'Partial'
                              ? 'bg-[#FFF3D6] text-[#8C6200]'
                              : 'bg-[#FDE2E2] text-danger'
                            }`}
                        >
                          {c.complianceStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: INSPECT MODULE DETAILS & VERIFY                   */}
      {/* ======================================================== */}
      {inspectingModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-card-border shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-[#F0E6D2]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${inspectingModule.level === 'Pre-K1'
                      ? 'bg-[#DCEBDD] text-[#2E6B38]'
                      : 'bg-[#E0EFFE] text-[#1E5B94]'
                      }`}
                  >
                    {inspectingModule.level} • Q{inspectingModule.quarter}
                  </span>
                  <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2 py-0.5 rounded">
                    {inspectingModule.week}: {inspectingModule.sub_theme || inspectingModule.theme}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${inspectingModule.verified_by_mswd
                      ? 'bg-[#DCEBDD] text-[#2E6B38]'
                      : 'bg-[#FFF3D6] text-[#8C6200]'
                      }`}
                  >
                    {inspectingModule.verified_by_mswd ? 'Verified by MSWDO ✓' : 'Pending Review'}
                  </span>
                </div>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink m-0">
                  {inspectingModule.title}
                </h3>
              </div>
              <button
                onClick={() => setInspectingModule(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] hover:bg-[#F0E6D2] flex items-center justify-center text-dash-ink-soft text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-card-border space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-dash-ink-soft block font-bold">Author / Submitting Teacher</span>
                  <span className="font-bold text-dash-ink text-sm">{inspectingModule.teacher_name}</span>
                </div>
                <div>
                  <span className="text-dash-ink-soft block font-bold">Child Development Center</span>
                  <span className="font-bold text-dash-ink text-sm">
                    {inspectingModule.cdc_name} (Brgy. {inspectingModule.barangay})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F0E6D2]">
                <div>
                  <span className="text-dash-ink-soft block">Post Category</span>
                  <span className="font-bold text-dash-ink">
                    {getItemCategory(inspectingModule) === 'video'
                      ? '🎬 Video Lesson'
                      : getItemCategory(inspectingModule) === 'file'
                        ? '📁 Document File / PDF'
                        : '✏️ Activity Worksheet'}
                  </span>
                </div>
                <div>
                  <span className="text-dash-ink-soft block">Format &amp; Size</span>
                  <span className="font-bold text-dash-ink">
                    {inspectingModule.file_type || 'PDF'} ({inspectingModule.file_size || '2.4 MB'})
                  </span>
                </div>
                <div>
                  <span className="text-dash-ink-soft block">Date Uploaded</span>
                  <span className="font-bold text-dash-ink">{inspectingModule.upload_date}</span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-dash-ink text-xs uppercase mb-1">
                ECCD Pedagogical Description &amp; Instructions
              </h5>
              <div className="p-3.5 rounded-xl bg-[#FAF5EC] border border-[#EBE1CF] text-xs text-[#4F422E] leading-relaxed">
                {inspectingModule.description}
              </div>
            </div>

            {/* Student linkage notice */}
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex items-center gap-2.5">
              <span className="text-base">🏫</span>
              <div>
                <span className="font-bold text-amber-900">MSWD Approval → Teacher Posts to Student Dashboard:</span> Once MSWD approves this complied activity, Teacher <span className="font-bold text-slate-900">{inspectingModule.teacher_name}</span> at <span className="font-bold text-slate-900">{inspectingModule.cdc_name || 'Assigned CDC'}</span> (Brgy. {inspectingModule.barangay}) can post it to their specific student dashboard.
              </div>
            </div>

            {/* Attached File / Image / Video Inline Preview (Before & After Checking) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-dash-ink text-xs uppercase m-0">
                  Teacher&apos;s Uploaded Material (View / Play Directly Without Downloading)
                </h5>
                {inspectingMediaUrl && (
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(inspectingModule, 'view')}
                    className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                  >
                    <span>🔍 View / Open in New Tab ↗</span>
                  </button>
                )}
              </div>

              {inspectingMediaLoading ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600 font-semibold">
                  ⏳ Loading teacher&apos;s uploaded material...
                </div>
              ) : inspectingMediaUrl ? (
                <div className="rounded-2xl border border-[#E5DAC4] bg-slate-900/5 overflow-hidden p-3 space-y-2">
                  {(() => {
                    const embedUrl = getEmbeddedVideoUrl(inspectingMediaUrl);
                    const isVid = isVideoItem({
                      url: inspectingMediaUrl,
                      file_name: inspectingModule.file_name,
                      file_type: inspectingModule.file_type,
                      category: inspectingModule.category,
                      module_type: inspectingModule.module_type,
                    });
                    const isImg = isImageItem({
                      url: inspectingMediaUrl,
                      file_name: inspectingModule.file_name,
                      file_type: inspectingModule.file_type,
                    });
                    const isPdf = isPdfItem({
                      url: inspectingMediaUrl,
                      file_name: inspectingModule.file_name,
                      file_type: inspectingModule.file_type,
                    });

                    if (embedUrl) {
                      return (
                        <iframe
                          src={embedUrl}
                          title={inspectingModule.title}
                          className="w-full aspect-video rounded-xl border border-slate-300 bg-black"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    }
                    if (isVid) {
                      return (
                        <video
                          key={inspectingMediaUrl}
                          src={inspectingMediaUrl}
                          controls
                          playsInline
                          preload="auto"
                          onLoadedMetadata={(e) => {
                            if (e.currentTarget.currentTime === 0) {
                              try {
                                e.currentTarget.currentTime = 0.05;
                              } catch { }
                            }
                          }}
                          className="w-full max-h-[400px] rounded-xl bg-black border border-slate-300 mx-auto block"
                        >
                          Your browser does not support HTML5 video playback.
                        </video>
                      );
                    }
                    if (isImg) {
                      return (
                        <div className="flex justify-center bg-white rounded-xl p-2 border border-slate-200">
                          <img
                            src={inspectingMediaUrl}
                            alt={inspectingModule.title}
                            className="max-h-[400px] w-auto object-contain rounded-lg"
                          />
                        </div>
                      );
                    }
                    if (isPdf) {
                      return (
                        <iframe
                          src={inspectingMediaUrl}
                          title={inspectingModule.title}
                          className="w-full h-[420px] rounded-xl border border-slate-200 bg-white"
                        />
                      );
                    }
                    return (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">📄</span>
                          <div>
                            <div className="font-bold text-xs text-slate-900">
                              {inspectingModule.file_name || inspectingModule.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {inspectingModule.file_type || 'Document'} • {inspectingModule.file_size || '1.2 MB'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(inspectingModule, 'view')}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
                        >
                          👁️ Open / View File
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">
                      📎 {inspectingModule.file_name || inspectingModule.title} ({inspectingModule.file_type || 'FILE'} • {inspectingModule.file_size || '2.4 MB'})
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      If this material was uploaded before cloud chunk sync was enabled, select the file once to cache and view/play it directly:
                    </div>
                  </div>
                  <label className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shrink-0 transition-colors">
                    📂 Load Teacher File / Video to View
                    <input
                      type="file"
                      accept="image/*,video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleRelinkAdminMedia(inspectingModule, f);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {inspectingModule.mswd_comments && (
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <span>💬</span>
                    <span>MSWDO Pedagogical Feedback &amp; Review Notes:</span>
                  </span>
                  {inspectingModule.mswd_comment_date && (
                    <span className="text-[11px] font-normal text-amber-700">
                      {inspectingModule.mswd_comment_date}
                    </span>
                  )}
                </div>
                <div className="leading-relaxed whitespace-pre-wrap">{inspectingModule.mswd_comments}</div>
              </div>
            )}

            {inspectingModule.revision_notes && !inspectingModule.mswd_comments && (
              <div className="p-3.5 rounded-xl bg-[#FDE2E2] border border-rose-200 text-xs text-danger space-y-1">
                <div className="font-bold">⚠️ Requested Revision Note:</div>
                <div>{inspectingModule.revision_notes}</div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-card-border">
              <div className="flex items-center gap-2">
                {inspectingMediaUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDownloadFile(inspectingModule, 'view');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>👁️ View / Open Material in New Tab</span>
                  </button>
                )}

                {!inspectingModule.is_deleted ? (
                  <button
                    onClick={() => handleDeleteModule(inspectingModule)}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Delete activity (can be retrieved from Deleted / Retrieve tab)"
                  >
                    <span>🗑️ Delete</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRetrieveModule(inspectingModule)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>♻️ Retrieve Activity</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenComment(inspectingModule)}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-xs transition-colors cursor-pointer border border-sky-300 flex items-center gap-1.5 shadow-2xs"
                >
                  <span>💬</span>
                  <span>{inspectingModule.mswd_comments ? 'Edit Feedback' : 'Add Note'}</span>
                </button>

                {!inspectingModule.verified_by_mswd ? (
                  <>
                    <button
                      onClick={() => handleRejectModule(inspectingModule.id)}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>✕</span>
                      <span>Reject Activity</span>
                    </button>
                    <button
                      onClick={() => {
                        handleApproveModule(inspectingModule.id);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>✓</span>
                      <span>Approve & Link to Students</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2E6B38] bg-[#DCEBDD] px-3.5 py-2 rounded-xl border border-emerald-300 flex items-center gap-1">
                      <span>✓</span>
                      <span>Officially Approved</span>
                    </span>
                    <button
                      onClick={() => handleRejectModule(inspectingModule.id)}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                    >
                      Revoke Approval
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MSWD REVIEW COMMENT & DECISION                    */}
      {/* ======================================================== */}
      {commentingModule && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-card-border shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E6D2]">
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-[#FFF5EE] px-2.5 py-0.5 rounded-full mb-1">
                  <span>💬 MSWD Activity Review</span>
                </div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Review &amp; Comment on Activity
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5">
                  Provide official pedagogical feedback and check compliance for Teacher {commentingModule.teacher_name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCommentingModule(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] hover:bg-[#F0E6D2] flex items-center justify-center text-dash-ink-soft text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#EBE1CF] space-y-1 text-xs">
              <div className="font-bold text-dash-ink">{commentingModule.title}</div>
              <div className="text-dash-ink-soft text-[11px] flex flex-wrap gap-x-2">
                <span>Teacher: <b className="text-dash-ink">{commentingModule.teacher_name}</b></span>
                <span>•</span>
                <span>CDC: <b className="text-dash-ink">{commentingModule.cdc_name}</b></span>
                <span>•</span>
                <span>Level: <b className="text-dash-ink">{commentingModule.level}</b></span>
              </div>
            </div>

            <form onSubmit={handleSaveComment} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-dash-ink block mb-1.5">
                  MSWDO Review Decision
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCommentDecision('approve')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${commentDecision === 'approve'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-white border-[#E5DCC9] text-dash-ink-soft hover:bg-slate-50'
                      }`}
                  >
                    <div className="text-base mb-0.5">✓</div>
                    <div className="text-[11.5px]">Approve &amp; Link</div>
                    <div className="text-[9.5px] font-normal opacity-80">Publish to Students</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCommentDecision('revision')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${commentDecision === 'revision'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs'
                      : 'bg-white border-[#E5DCC9] text-dash-ink-soft hover:bg-slate-50'
                      }`}
                  >
                    <div className="text-base mb-0.5">✕</div>
                    <div className="text-[11.5px]">Reject / Revision</div>
                    <div className="text-[9.5px] font-normal opacity-80">Notify Teacher to Fix</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCommentDecision('keep')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${commentDecision === 'keep'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                      : 'bg-white border-[#E5DCC9] text-dash-ink-soft hover:bg-slate-50'
                      }`}
                  >
                    <div className="text-base mb-0.5">💬</div>
                    <div className="text-[11.5px]">Comment Only</div>
                    <div className="text-[9.5px] font-normal opacity-80">Keep Current Status</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">
                  MSWDO Review Notes &amp; Guidance for the Teacher
                </label>
                <textarea
                  rows={4}
                  required
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add specific comments, recommendations, or guidelines for the teacher regarding this activity..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-medium text-dash-ink outline-none focus:border-accent resize-none text-xs leading-relaxed"
                />
                <span className="text-[10.5px] text-dash-ink-soft mt-1 block">
                  This comment will be visible to Teacher {commentingModule.teacher_name} in their Teacher Dashboard under this activity.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setCommentingModule(null)}
                  className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>💾 Save Comment &amp; Update Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECORD NEW MODULE / POST (ADMIN OVERRIDE)        */}
      {/* ======================================================== */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-card-border shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E6D2]">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Record Teacher Post (Activity or File)
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5">
                  Record and verify learning activities or files submitted by Day Care Teachers.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] hover:bg-[#F0E6D2] flex items-center justify-center text-dash-ink-soft text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-dash-ink block mb-1">Activity / File Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-K1 W1: Name Tracing & Action Song Activity"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">Submitting Teacher</label>
                <select
                  required
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                >
                  <option value="">-- Choose Submitting Teacher --</option>
                  {realTeachersList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} — Brgy. {t.barangay} ({t.cdc_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-dash-ink block mb-1">Curriculum Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="Pre-K1">Pre-K 1 (3.11 years old)</option>
                    <option value="Pre-K2">Pre-K 2 (4.11 years old)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-dash-ink block mb-1">Quarter</label>
                  <select
                    value={newQuarter}
                    onChange={(e) => setNewQuarter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="1">Quarter 1</option>
                    <option value="2">Quarter 2</option>
                    <option value="3">Quarter 3</option>
                    <option value="4">Quarter 4</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-dash-ink block mb-1">Week</label>
                  <input
                    type="text"
                    value={newWeek}
                    onChange={(e) => setNewWeek(e.target.value)}
                    placeholder="e.g. Week 1 or Week 2 & 3"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-bold text-dash-ink block mb-1">Sub-Theme</label>
                  <input
                    type="text"
                    value={newSubTheme}
                    onChange={(e) => setNewSubTheme(e.target.value)}
                    placeholder="e.g. I HAVE A NAME"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">Post / File Format</label>
                <select
                  value={newModuleType}
                  onChange={(e) => setNewModuleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                >
                  <option value="Activity Worksheet">✏️ Activity Worksheet</option>
                  <option value="Lesson Plan & Practice Sheet">📁 Lesson Plan &amp; Practice Sheet (File)</option>
                  <option value="Official PDF Document">📁 Official PDF Document (File)</option>
                  <option value="Cut-out Sorting Activity">✏️ Cut-out Sorting Activity</option>
                  <option value="Printable Emotion Flashcards">✏️ Printable Emotion Flashcards</option>
                  <option value="Video Lesson Guide">🎬 Video Lesson Guide</option>
                  <option value="Sensory Art & Parent Guide">📁 Sensory Art &amp; Parent Guide</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">Description &amp; Activity Instructions</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline toddler engagement steps and materials needed..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-semibold text-dash-ink outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Attach File / Image / Video + Applicable Size Limits */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF5EC] border border-[#E5DCC9]">
                <label className="font-bold text-dash-ink block">
                  Attach Activity File, Image, or Video (Optional)
                </label>
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] font-semibold text-amber-900">
                  📏 <span className="font-bold">Applicable File Size Limits:</span> 🖼️ Images: Max 10 MB • 📁 Files/Docs (PDF/Word/PPT): Max 15 MB • 🎬 Videos (MP4/WebM/MOV): Max 50 MB
                </div>
                <input
                  type="file"
                  accept="image/*,video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  onChange={handleAdminFileChange}
                  className="w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
                {newFileError && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
                    ⚠️ {newFileError}
                  </div>
                )}
                {newFileName && !newFileError && (
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-800 truncate">
                        ✓ Attached: {newFileName} ({newFileSize})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewFilePreview(null);
                          setNewFileName('');
                          setNewFileSize('');
                          setNewFileType('');
                        }}
                        className="text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {uploadSuccess && (
                <div className="p-3 rounded-xl bg-[#DCEBDD] text-[#2E6B38] font-bold text-center">
                  {uploadSuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Record &amp; Verify Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
