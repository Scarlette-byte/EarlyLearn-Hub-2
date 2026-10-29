import { useState, useMemo, useEffect } from 'react';
import {
  preK1Curriculum,
  preK2Curriculum,
  realTeachersList,
  realCdcsList,
  initialCurriculumAssignments,
  getCleanCurriculumAssignments,
  getCleanTeacherModulesList,
  initialTeacherModules,
  formatAssignmentCoverage,
} from '../../lib/curriculumData.js';
import { supabase, barangays } from '../../lib/supabaseClient';
import {
  cardBox,
  cardBoxTitle,
  table,
  th,
  td,
  pillClass,
  btnAdd,
  input,
} from '../../lib/ui.js';
import {
  IconSearch,
  IconPlus,
  IconCheck,
  IconClose,
  IconTeachers,
  IconMaterials,
  IconPin,
  IconBuilding,
} from '../Icons.jsx';

export default function CurriculumGuides({
  onNavigateToActivityMonitoring,
}) {
  const [selectedLevel, setSelectedLevel] = useState('PRE-K1'); // 'PRE-K1' or 'PRE-K2'
  const [activeView, setActiveView] = useState('matrix'); // 'matrix' or 'assignments'
  const [quarterFilter, setQuarterFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangayFilter, setSelectedBarangayFilter] = useState('all');
  const [teacherUpdateTick, setTeacherUpdateTick] = useState(0);
  const [dbTeachers, setDbTeachers] = useState([]);

  // Curriculum assignments state (persisted to localStorage)
  const [assignments, setAssignments] = useState(getCleanCurriculumAssignments);

  // Sync when teacher profiles or assignments update
  useEffect(() => {
    async function fetchSupabaseTeachers() {
      try {
        const { data: teachersData } = await supabase
          .from('teachers')
          .select('id, full_name, barangay, contact_number, email, cdc_id, cdcs(name)');
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'teacher');

        const list = [...(teachersData || [])];
        if (profilesData && profilesData.length > 0) {
          profilesData.forEach((prof) => {
            const cleanProfName = (prof.full_name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
            const existing = list.find(
              (t) =>
                t.id === prof.id ||
                (t.full_name && cleanProfName && t.full_name.toLowerCase().includes(cleanProfName)) ||
                (cleanProfName && t.full_name && cleanProfName.includes(t.full_name.toLowerCase()))
            );
            if (existing) {
              existing.full_name = prof.full_name || existing.full_name;
              existing.barangay = prof.barangay || existing.barangay;
              if (prof.contact_number) existing.contact_number = prof.contact_number;
              if (prof.cdc_name) existing.cdc_name = prof.cdc_name;
            } else {
              list.push({
                id: prof.id,
                full_name: prof.full_name,
                barangay: prof.barangay,
                contact_number: prof.contact_number || null,
                email: prof.email || null,
                cdc_name: prof.cdc_name || null,
              });
            }
          });
        }
        setDbTeachers(list);
      } catch {
        // ignore
      }
    }

    async function fetchSupabaseAssignments() {
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('id, title, content_text, created_at')
          .ilike('title', '[MSWD_ASSIGNMENT]%')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const sbAssigns = [];
          data.forEach((row) => {
            if (row.content_text && row.content_text.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(row.content_text);
                if (parsed && parsed.__mswd_assignment && parsed.assignment) {
                  sbAssigns.push({
                    ...parsed.assignment,
                    sb_row_id: row.id,
                  });
                }
              } catch {}
            }
          });
          if (sbAssigns.length > 0) {
            const localClean = getCleanCurriculumAssignments();
            const seen = new Set();
            const merged = [];
            [...sbAssigns, ...localClean].forEach((a) => {
              if (a && a.id && !seen.has(a.id)) {
                seen.add(a.id);
                merged.push(a);
              }
            });
            setAssignments(merged);
            try {
              localStorage.setItem('earlylearn_curriculum_assignments', JSON.stringify(merged));
            } catch {}
          }
        }
      } catch {
        // ignore
      }
    }

    fetchSupabaseTeachers();
    fetchSupabaseAssignments();

    const handleSync = () => {
      setTeacherUpdateTick((prev) => prev + 1);
      setAssignments(getCleanCurriculumAssignments());
      fetchSupabaseTeachers();
      fetchSupabaseAssignments();
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('earlylearn_teachers_updated', handleSync);
    window.addEventListener('earlylearn_assignments_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_teachers_updated', handleSync);
      window.removeEventListener('earlylearn_assignments_updated', handleSync);
    };
  }, []);

  // Real active teachers list merged with Supabase and local overrides
  const activeTeachersList = useMemo(() => {
    let base = [...realTeachersList];
    if (dbTeachers.length > 0) {
      const existingNames = new Set(
        dbTeachers.map((t) => (t.full_name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase())
      );
      const nonDuplicateBaseline = base.filter((b) => {
        const bName = (b.full_name || '').toLowerCase();
        return !Array.from(existingNames).some((e) => e && (bName.includes(e) || e.includes(bName)));
      });
      base = [...dbTeachers, ...nonDuplicateBaseline];
    }

    try {
      const overrides = JSON.parse(localStorage.getItem('earlylearn_teacher_profiles_override') || '{}');
      return base.map((t) => {
        const ov =
          overrides[t.id] ||
          (t.email && overrides[t.email.toLowerCase()]) ||
          (t.full_name && overrides[t.full_name.toLowerCase()]);
        if (ov) {
          return {
            ...t,
            full_name: ov.full_name || t.full_name,
            barangay: ov.barangay || t.barangay,
            cdc_name: ov.cdc_name || t.cdc_name,
            contact_number: ov.contact_number || t.contact_number,
          };
        }
        return t;
      });
    } catch {
      return base;
    }
  }, [teacherUpdateTick, dbTeachers]);

  // Modal State for Assigning Curriculum
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedQuarterForModal, setSelectedQuarterForModal] = useState('all');
  const [targetType, setTargetType] = useState('teacher'); // 'teacher' | 'barangay' | 'cdc'
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedBarangayForAssign, setSelectedBarangayForAssign] = useState('');
  const [selectedCdcForAssign, setSelectedCdcForAssign] = useState('');
  const [selectedLevelForAssign, setSelectedLevelForAssign] = useState('Pre-K1');
  const [selectedQuartersForAssign, setSelectedQuartersForAssign] = useState([1, 2]);
  const [weekScopeMode, setWeekScopeMode] = useState('all'); // 'all' | 'specific'
  const [selectedWeeksForAssign, setSelectedWeeksForAssign] = useState([]);
  const [assignedWeekFilter, setAssignedWeekFilter] = useState('all');
  const [assignedQuarterFilter, setAssignedQuarterFilter] = useState('all');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

  // Enhanced topic and deadline assignment states
  const [assignmentDeadline, setAssignmentDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [selectedSpecificTopic, setSelectedSpecificTopic] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Active Curriculum Data depending on tab
  const currentCurriculum = selectedLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;

  // Filtered Quarters for the Matrix
  const filteredCurriculum = useMemo(() => {
    return currentCurriculum
      .filter((q) => {
        if (quarterFilter === 'all') return true;
        return q.quarterNumber === parseInt(quarterFilter, 10);
      })
      .map((q) => {
        const matchingWeeks = q.weeks.filter((w) => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return (
            w.week.toLowerCase().includes(query) ||
            w.subTheme.toLowerCase().includes(query) ||
            q.theme.toLowerCase().includes(query) ||
            q.suggestedContent.toLowerCase().includes(query)
          );
        });
        return {
          ...q,
          filteredWeeks: matchingWeeks,
        };
      })
      .filter((q) => q.filteredWeeks.length > 0);
  }, [currentCurriculum, quarterFilter, searchQuery]);

  // Helper to get assigned teachers for a level & quarter
  const getAssignedTeachersForQuarter = (levelStr, quarterNum) => {
    return assignments.filter(
      (a) => a.level.toLowerCase() === levelStr.toLowerCase() && a.quarters.includes(quarterNum)
    );
  };

  // Helper to get authentic uploaded modules
  const getCleanModules = () => {
    return getCleanTeacherModulesList();
  };

  // Helper to count modules uploaded for a quarter
  const getModulesCountForQuarter = (levelStr, quarterNum) => {
    return getCleanModules().filter(
      (m) => m.level.toLowerCase() === levelStr.toLowerCase() && m.quarter === quarterNum
    ).length;
  };

  // Open modal with pre-selected quarter, optional specific week, and optional topic details
  const handleOpenAssignModal = (quarterNum = null, specificWeek = null, specificTopicObj = null) => {
    const targetLevel = selectedLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2';
    setSelectedLevelForAssign(targetLevel);
    const curr = targetLevel === 'Pre-K1' ? preK1Curriculum : preK2Curriculum;

    if (quarterNum) {
      setSelectedQuarterForModal(quarterNum);
      setSelectedQuartersForAssign([quarterNum]);
    } else {
      setSelectedQuarterForModal(1);
      setSelectedQuartersForAssign([1]);
    }

    const qObj = curr.find((q) => q.quarterNumber === (quarterNum || 1)) || curr[0];
    if (specificWeek) {
      setWeekScopeMode('specific');
      setSelectedWeeksForAssign([specificWeek]);
    } else {
      setWeekScopeMode('specific');
      setSelectedWeeksForAssign(qObj?.weeks?.[0] ? [qObj.weeks[0].week] : []);
    }

    setSelectedSpecificTopic(specificTopicObj || null);
    setAssignSuccessMsg('');

    // Default deadline to 7 days ahead
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setAssignmentDeadline(d.toISOString().split('T')[0]);
    setAdminNotes('');
    setAssignModalOpen(true);
  };

  // Available weeks in the modal based on selected quarters & level
  const availableWeeksInModal = useMemo(() => {
    const curr = selectedLevelForAssign === 'Pre-K1' ? preK1Curriculum : preK2Curriculum;
    const qList = curr.filter((q) => selectedQuartersForAssign.includes(q.quarterNumber));
    const weekItems = [];
    const seen = new Set();
    qList.forEach((q) => {
      q.weeks.forEach((w) => {
        const key = `${q.quarterNumber}-${w.week}`;
        if (!seen.has(key)) {
          seen.add(key);
          weekItems.push({ ...w, quarterNumber: q.quarterNumber, theme: q.theme, suggestedContent: q.suggestedContent });
        }
      });
    });
    return weekItems;
  }, [selectedLevelForAssign, selectedQuartersForAssign]);

  // Save new assignment
  const handleSaveAssignment = (e) => {
    e.preventDefault();
    let newAssignmentsList = [...assignments];
    const targetWeeks = weekScopeMode === 'all' || selectedWeeksForAssign.length === 0 ? 'all' : selectedWeeksForAssign;

    // Build exact MSWD topic items from selected weeks or specific topic
    const matchedTopicItems =
      selectedSpecificTopic
        ? [
            {
              quarter: selectedSpecificTopic.quarterNumber || selectedQuartersForAssign[0] || 1,
              week: selectedSpecificTopic.week,
              subTheme: selectedSpecificTopic.subTheme,
              theme: selectedSpecificTopic.theme,
              suggestedActivities: selectedSpecificTopic.suggestedActivities || '',
            },
          ]
        : weekScopeMode === 'specific' && selectedWeeksForAssign.length > 0
        ? availableWeeksInModal
            .filter((w) => selectedWeeksForAssign.includes(w.week))
            .map((w) => ({
              quarter: w.quarterNumber || selectedQuartersForAssign[0] || 1,
              week: w.week,
              subTheme: w.subTheme,
              theme: w.theme,
              suggestedActivities: w.suggestedActivities || '',
            }))
        : availableWeeksInModal.map((w) => ({
            quarter: w.quarterNumber || selectedQuartersForAssign[0] || 1,
            week: w.week,
            subTheme: w.subTheme,
            theme: w.theme,
            suggestedActivities: w.suggestedActivities || '',
          }));

    const firstTopic = matchedTopicItems[0] || availableWeeksInModal[0] || {};
    const resolvedTopic =
      selectedSpecificTopic?.subTheme ||
      (matchedTopicItems.length === 1
        ? firstTopic.subTheme
        : matchedTopicItems.length > 1
        ? `${firstTopic.subTheme} (+${matchedTopicItems.length - 1} more MSWD topics)`
        : 'I HAVE A NAME');

    const resolvedWeekStr =
      selectedSpecificTopic?.week ||
      (Array.isArray(targetWeeks) && targetWeeks.length === 1
        ? targetWeeks[0]
        : targetWeeks === 'all'
        ? firstTopic.week || 'Week 1'
        : targetWeeks[0] || 'Week 1');

    const buildAssignmentForTeacher = (teacher, suffix = '') => ({
      id: 'asg-' + Date.now() + '-' + (suffix || teacher.id),
      targetType: targetType,
      teacherId: teacher.id,
      teacherName: teacher.full_name,
      barangay: teacher.barangay,
      cdcName: teacher.cdc_name,
      level: selectedLevelForAssign,
      quarters: selectedQuartersForAssign,
      quarter: firstTopic.quarter || selectedQuartersForAssign[0] || 1,
      weeks: targetWeeks === 'all' ? matchedTopicItems.map((t) => t.week) : targetWeeks,
      week: resolvedWeekStr,
      topicTitle: resolvedTopic,
      subTheme: firstTopic.subTheme || resolvedTopic,
      theme:
        selectedSpecificTopic?.theme ||
        firstTopic.theme ||
        (selectedLevelForAssign === 'Pre-K1' ? 'TELL ME ABOUT YOURSELF' : 'MORE ABOUT MYSELF AND MY SCHOOL'),
      suggestedContent: selectedSpecificTopic?.suggestedContent || firstTopic.suggestedContent || '',
      suggestedActivities: selectedSpecificTopic?.suggestedActivities || firstTopic.suggestedActivities || '',
      assignedTopics: matchedTopicItems,
      deadline: assignmentDeadline,
      notes: adminNotes.trim(),
      schoolYear,
      status: 'Pending',
      assignedDate: new Date().toISOString().split('T')[0],
    });

    const createdOnly = [];
    if (targetType === 'all') {
      activeTeachersList.forEach((teacher) => {
        const built = buildAssignmentForTeacher(teacher, teacher.id);
        newAssignmentsList.push(built);
        createdOnly.push(built);
      });
    } else if (targetType === 'teacher') {
      const teacher = activeTeachersList.find((t) => t.id === selectedTeacherId);
      if (!teacher) {
        alert('Please select a teacher.');
        return;
      }
      const built = buildAssignmentForTeacher(teacher, Math.random().toString(36).slice(2, 6));
      newAssignmentsList.push(built);
      createdOnly.push(built);
    } else if (targetType === 'barangay') {
      if (!selectedBarangayForAssign) {
        alert('Please select a Barangay.');
        return;
      }
      const teachersInBrgy = activeTeachersList.filter((t) => t.barangay === selectedBarangayForAssign);
      if (teachersInBrgy.length === 0) {
        alert('No teachers found in this Barangay.');
        return;
      }
      teachersInBrgy.forEach((teacher) => {
        const built = buildAssignmentForTeacher(teacher, teacher.id);
        newAssignmentsList.push(built);
        createdOnly.push(built);
      });
    } else if (targetType === 'cdc') {
      if (!selectedCdcForAssign) {
        alert('Please select a CDC.');
        return;
      }
      const teachersInCdc = activeTeachersList.filter((t) => t.cdc_name === selectedCdcForAssign);
      if (teachersInCdc.length === 0) {
        alert('No teachers found assigned to this CDC.');
        return;
      }
      teachersInCdc.forEach((teacher) => {
        const built = buildAssignmentForTeacher(teacher, teacher.id);
        newAssignmentsList.push(built);
        createdOnly.push(built);
      });
    }

    setAssignments(newAssignmentsList);
    try {
      localStorage.setItem('earlylearn_curriculum_assignments', JSON.stringify(newAssignmentsList));
      window.dispatchEvent(new CustomEvent('earlylearn_assignments_updated', { detail: newAssignmentsList }));
    } catch {
      // Ignored
    }

    // Sync newly assigned topics to Supabase so teachers on other devices see them immediately
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const rowsToInsert = createdOnly.map((asg) => ({
          title: `[MSWD_ASSIGNMENT] ${asg.id}`,
          type: 'text',
          age_range: asg.level === 'Pre-K1' ? '3-4' : '4-5',
          status: 'approved',
          created_by: user?.id || null,
          content_text: JSON.stringify({
            __mswd_assignment: true,
            assignment: asg,
          }),
        }));
        if (rowsToInsert.length > 0) {
          await supabase.from('materials').insert(rowsToInsert);
        }
      } catch {}
    })();

    setAssignSuccessMsg(`✅ Topic "${resolvedTopic}" assigned successfully with deadline ${assignmentDeadline}!`);
    setTimeout(() => {
      setAssignModalOpen(false);
      setAssignSuccessMsg('');
    }, 1200);
  };

  // Remove assignment
  const handleRemoveAssignment = async (id) => {
    if (!confirm('Remove this curriculum assignment?')) return;
    const target = assignments.find((a) => a.id === id);
    const updated = assignments.filter((a) => a.id !== id);
    setAssignments(updated);
    try {
      localStorage.setItem('earlylearn_curriculum_assignments', JSON.stringify(updated));
    } catch {
      // Ignored
    }
    try {
      if (target?.sb_row_id) {
        await supabase.from('materials').delete().eq('id', target.sb_row_id);
      } else {
        await supabase.from('materials').delete().eq('title', `[MSWD_ASSIGNMENT] ${id}`);
      }
    } catch {}
  };

  // Toggle quarter checkbox
  const toggleQuarterCheckbox = (qNum) => {
    if (selectedQuartersForAssign.includes(qNum)) {
      if (selectedQuartersForAssign.length === 1) return; // keep at least 1
      setSelectedQuartersForAssign(selectedQuartersForAssign.filter((q) => q !== qNum));
    } else {
      setSelectedQuartersForAssign([...selectedQuartersForAssign, qNum].sort());
    }
  };

  // Filtered assignments list
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        a.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.cdcName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.barangay.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrgy =
        selectedBarangayFilter === 'all' || a.barangay.toLowerCase() === selectedBarangayFilter.toLowerCase();
      const matchesLevel =
        selectedLevel === 'all' || a.level.toLowerCase() === (selectedLevel === 'PRE-K1' ? 'pre-k1' : 'pre-k2');
      const matchesQuarter =
        assignedQuarterFilter === 'all' || a.quarters.includes(parseInt(assignedQuarterFilter, 10));
      const matchesWeek =
        assignedWeekFilter === 'all' ||
        a.weeks === 'all' ||
        (Array.isArray(a.weeks) &&
          a.weeks.some((w) => w.toLowerCase().includes(assignedWeekFilter.toLowerCase())));
      return matchesSearch && matchesBrgy && matchesLevel && matchesQuarter && matchesWeek;
    });
  }, [assignments, searchQuery, selectedBarangayFilter, selectedLevel, assignedQuarterFilter, assignedWeekFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
            <IconMaterials className="w-3.5 h-3.5 text-slate-500" />
            <span>Official ECCD Curriculum Guidelines • MSWDO Manolo Fortich</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 m-0 tracking-tight">
            Curriculum Guides & Teacher Assignments
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed m-0">
            Official prescribed ECCD early childhood lesson plans for Pre-K 1 (3.11 years old) and Pre-K 2 (4.11 years old). Assign quarterly curriculum competencies to Child Development Teachers across all 64 centers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setTargetType('all');
              setSelectedLevelForAssign(selectedLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2');
              setSelectedQuartersForAssign([1, 2, 3, 4]);
              setAssignSuccessMsg('');
              setAssignModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <IconCheck className="w-3.5 h-3.5" />
            <span>Assign to All Teachers</span>
          </button>

          <button
            onClick={() => handleOpenAssignModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Assign Specific Teacher/CDC</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Bar (Tabs & View Controls) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Pre-K Level Government-style Tabs */}
        <div className="flex items-center gap-2 border-b lg:border-b-0 pb-2 lg:pb-0 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Level:
          </span>
          <button
            onClick={() => setSelectedLevel('PRE-K1')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              selectedLevel === 'PRE-K1'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>PRE-K 1 (3.11 years old)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedLevel === 'PRE-K1' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              Q1 – Q4
            </span>
          </button>

          <button
            onClick={() => setSelectedLevel('PRE-K2')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              selectedLevel === 'PRE-K2'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>PRE-K 2 (4.11 years old)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedLevel === 'PRE-K2' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              Q1 – Q4
            </span>
          </button>
        </div>

        {/* View Toggle: Matrix vs Teacher Assignments */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveView('matrix')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Curriculum Matrix
            </button>
            <button
              onClick={() => setActiveView('assignments')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'assignments'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Assigned Teachers</span>
              <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {assignments.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH ROW */}
      <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-4 h-4 text-[#A89F91] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search themes, weeks, sub-themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-semibold text-dash-ink outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeView === 'matrix' ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-dash-ink-soft whitespace-nowrap">Quarter:</span>
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
              >
                <option value="all">All Quarters (Q1 - Q4)</option>
                <option value="1">Quarter 1</option>
                <option value="2">Quarter 2</option>
                <option value="3">Quarter 3</option>
                <option value="4">Quarter 4</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-dash-ink-soft whitespace-nowrap">Barangay:</span>
              <select
                value={selectedBarangayFilter}
                onChange={(e) => setSelectedBarangayFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
              >
                <option value="all">All 22 Barangays</option>
                {barangays.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: CURRICULUM MATRIX VIEW (Matching Excel Guide)     */}
      {/* ======================================================== */}
      {activeView === 'matrix' && (
        <div className="space-y-6">
          {filteredCurriculum.map((q) => {
            const assignedTeachersForQ = getAssignedTeachersForQuarter(
              selectedLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2',
              q.quarterNumber
            );
            const uploadedModulesForQ = getModulesCountForQuarter(
              selectedLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2',
              q.quarterNumber
            );

            return (
              <div
                key={q.quarter}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Quarter Header Banner */}
                <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs uppercase tracking-wider text-white bg-slate-900 px-2.5 py-1 rounded">
                      {q.quarter}
                    </span>
                    <span className="font-bold text-sm text-slate-800">
                      {q.suggestedContent} • <span className="font-normal text-xs text-slate-500">({q.month})</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded">
                      <IconTeachers className="w-3.5 h-3.5 text-slate-500" />
                      <span>{assignedTeachersForQ.length} Teachers Assigned</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                      <IconMaterials className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{uploadedModulesForQ} Modules Uploaded</span>
                    </div>

                    <button
                      onClick={() => handleOpenAssignModal(q.quarterNumber)}
                      className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
                    >
                      + Assign Q{q.quarterNumber}
                    </button>
                  </div>
                </div>

                {/* ECCD Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                        <th className="px-4 py-3 border-r border-slate-200 w-[180px]">
                          Quarter &amp; Suggested Content
                        </th>
                        <th className="px-4 py-3 border-r border-slate-200 w-[210px] bg-amber-50 text-amber-900">
                          THEME (FOCUS AREA)
                        </th>
                        <th className="px-4 py-3 border-r border-slate-200 w-[110px]">WEEK</th>
                        <th className="px-4 py-3 border-r border-slate-200">SUB-THEMES / COMPETENCIES</th>
                        <th className="px-4 py-3 border-r border-slate-200 w-[130px]">MONTH</th>
                        <th className="px-4 py-3 text-center w-[130px]">DEPED ECCD ACTIVITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {q.filteredWeeks.map((w, wIdx) => (
                        <tr key={w.week + wIdx} className="hover:bg-slate-50/70 transition-colors">
                          {/* Span Content across the first row of each Quarter */}
                          {wIdx === 0 && (
                            <td
                              rowSpan={q.filteredWeeks.length}
                              className="px-4 py-4 font-semibold text-slate-900 align-middle border-r border-slate-200 bg-slate-50/50"
                            >
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                {q.quarter}
                              </div>
                              <div className="text-xs text-slate-800 font-semibold leading-relaxed">
                                {q.suggestedContent}
                              </div>
                            </td>
                          )}

                          {/* Soft Amber Theme Column matching administrative highlight */}
                          {wIdx === 0 && (
                            <td
                              rowSpan={q.filteredWeeks.length}
                              className="px-4 py-4 align-middle border-r border-slate-200 bg-amber-50/80 text-amber-950 border-l-2 border-l-amber-400"
                            >
                              <div className="font-bold text-xs uppercase leading-snug tracking-wide">
                                {q.theme}
                              </div>
                            </td>
                          )}

                          <td className="px-4 py-3 font-semibold text-slate-800 border-r border-slate-200 whitespace-nowrap bg-white">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                              <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {w.week}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenAssignModal(q.quarterNumber, w.week, {
                                    quarterNumber: q.quarterNumber,
                                    week: w.week,
                                    subTheme: w.subTheme,
                                    theme: q.theme,
                                    suggestedActivities: w.suggestedActivities,
                                    suggestedContent: q.suggestedContent,
                                  })
                                }
                                className="text-[10.5px] font-bold text-accent hover:text-white bg-amber-50 hover:bg-accent border border-amber-300 px-2 py-0.5 rounded-md cursor-pointer transition-colors shadow-2xs whitespace-nowrap flex items-center gap-1"
                                title={`Assign "${w.subTheme}" (${w.week}) to teacher`}
                              >
                                <span>🎯</span>
                                <span>+ Assign Topic</span>
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-800 border-r border-slate-200 bg-white">
                            <div className="text-xs tracking-wide leading-relaxed">{w.subTheme}</div>
                          </td>

                          <td className="px-4 py-3 text-slate-600 border-r border-slate-200 whitespace-nowrap bg-white text-[11px]">
                            {q.month}
                          </td>

                          <td className="px-4 py-3 bg-white text-slate-500 text-[11px] leading-relaxed">
                            {w.suggestedActivities}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Assigned Teachers Bar for this Quarter */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-700">Assigned Teachers for {q.quarter}:</span>
                    {assignedTeachersForQ.length === 0 ? (
                      <span className="text-slate-400 italic">No teachers assigned yet.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedTeachersForQ.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-800"
                          >
                            <IconTeachers className="w-3 h-3 text-slate-400" />
                            <span>{t.teacherName}</span>
                            <span className="text-[10px] text-dash-ink-soft">({t.barangay})</span>
                          </span>
                        ))}
                        {assignedTeachersForQ.length > 4 && (
                          <span className="text-[11px] font-bold text-accent self-center">
                            +{assignedTeachersForQ.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenAssignModal(q.quarterNumber)}
                    className="text-xs font-bold text-accent hover:underline cursor-pointer"
                  >
                    Manage Quarter Assignments →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: TEACHER ASSIGNMENTS OVERVIEW (Master Matrix)      */}
      {/* ======================================================== */}
      {activeView === 'assignments' && (
        <div className="bg-white rounded-2xl border border-card-border shadow-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                Curriculum Guide Teacher Assignments Roster
              </h3>
              <p className="text-xs text-dash-ink-soft mt-0.5">
                Overview of Child Development Teachers and assigned Curriculum Guides (Pre-K1 / Pre-K2), Quarters, and specific Weeks across CDCs.
              </p>
            </div>

            <button
              onClick={() => handleOpenAssignModal()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Assign New Teacher</span>
            </button>
          </div>

          {/* Filters Bar for Roster */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-slate-700">Filter By:</span>

            {/* Quarter Filter */}
            <select
              value={assignedQuarterFilter}
              onChange={(e) => setAssignedQuarterFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none"
            >
              <option value="all">All Quarters</option>
              <option value="1">Quarter 1</option>
              <option value="2">Quarter 2</option>
              <option value="3">Quarter 3</option>
              <option value="4">Quarter 4</option>
            </select>

            {/* Week Filter */}
            <select
              value={assignedWeekFilter}
              onChange={(e) => setAssignedWeekFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none"
            >
              <option value="all">All Weeks</option>
              <option value="Week 1">Week 1</option>
              <option value="Week 2">Week 2</option>
              <option value="Week 3">Week 3</option>
              <option value="Week 4">Week 4</option>
              <option value="Week 5">Week 5</option>
              <option value="Week 6">Week 6</option>
              <option value="Week 7">Week 7</option>
              <option value="Week 8">Week 8</option>
              <option value="Week 9">Week 9</option>
              <option value="Week 10">Week 10</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search teacher, CDC, or barangay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none"
              />
              <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {(assignedQuarterFilter !== 'all' || assignedWeekFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setAssignedQuarterFilter('all');
                  setAssignedWeekFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-accent hover:underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                  <th className="px-4 py-3">Teacher / Child Development Worker</th>
                  <th className="px-4 py-3">Barangay &amp; Child Development Center</th>
                  <th className="px-4 py-3 text-center">Level</th>
                  <th className="px-4 py-3">Assigned Topic &amp; Focus</th>
                  <th className="px-4 py-3 text-center">Submission Deadline</th>
                  <th className="px-4 py-3">Complied Activity &amp; MSWD Status</th>
                  <th className="px-4 py-3 text-center">Compliance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredAssignments.map((asg) => {
                  const teacherModules = getCleanModules().filter(
                    (m) =>
                      m.assignment_id === asg.id ||
                      ((m.teacher_name === asg.teacherName || m.teacher_id === asg.teacherId) &&
                        ((asg.subTheme && m.sub_theme?.toLowerCase() === asg.subTheme.toLowerCase()) ||
                          (asg.topicTitle && m.title?.toLowerCase().includes(asg.topicTitle.toLowerCase()))))
                  );
                  const latestMod = teacherModules[0] || null;
                  const isPastDeadline = asg.deadline && new Date(asg.deadline + 'T23:59:59') < new Date();
                  const isCompleted = asg.status === 'Completed' || teacherModules.length > 0;

                  return (
                    <tr key={asg.id} className="hover:bg-[#FFFDF9] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-dash-ink text-[12.5px]">{asg.teacherName}</div>
                        <div className="text-[11px] text-dash-ink-soft">
                          SY {asg.schoolYear} • Assigned: {asg.assignedDate}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#423722] flex items-center gap-1">
                          <IconBuilding className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span>{asg.cdcName}</span>
                        </div>
                        <div className="text-[11px] text-dash-ink-soft flex items-center gap-1 mt-0.5">
                          <IconPin className="w-3 h-3 text-[#A89F91] shrink-0" />
                          <span>Brgy. {asg.barangay}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold ${
                            asg.level === 'Pre-K1'
                              ? 'bg-[#DCEBDD] text-[#2E6B38]'
                              : 'bg-[#E0EFFE] text-[#1E5B94]'
                          }`}
                        >
                          {asg.level}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800 text-xs">
                          {asg.topicTitle || formatAssignmentCoverage(asg)}
                        </div>
                        {asg.subTheme && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                            Focus: {asg.subTheme}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {asg.quarters.map((q) => (
                            <span
                              key={q}
                              className="px-2 py-0.5 bg-[#FAF3E8] border border-[#E8DFC9] rounded-md text-[10px] font-bold text-[#5C5036]"
                            >
                              Q{q}
                            </span>
                          ))}
                          {asg.weeks && asg.weeks !== 'all' && Array.isArray(asg.weeks) && asg.weeks.map((w) => (
                            <span
                              key={w}
                              className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-md text-[10px] font-bold"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {asg.deadline ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isPastDeadline
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              📅 {asg.deadline}
                            </span>
                            <span className="text-[10px] mt-0.5 font-medium text-slate-500">
                              {isCompleted
                                ? '✓ Complied'
                                : isPastDeadline
                                ? '⚠️ Deadline Passed'
                                : '⏳ Open for Upload'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No deadline set</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {latestMod ? (
                          <div className="space-y-1 max-w-[220px]">
                            <div className="font-bold text-slate-800 text-xs truncate" title={latestMod.title}>
                              {latestMod.title}
                            </div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                latestMod.verified_by_mswd || latestMod.status === 'Approved'
                                  ? 'bg-[#DCEBDD] text-[#2E6B38]'
                                  : latestMod.status === 'Rejected' || latestMod.status === 'Needs Revision'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {latestMod.verified_by_mswd || latestMod.status === 'Approved'
                                ? latestMod.posted_to_students
                                  ? '✓ Approved & Posted to Students'
                                  : '✓ Approved by MSWD'
                                : latestMod.status === 'Rejected' || latestMod.status === 'Needs Revision'
                                ? '✕ Rejected by MSWD'
                                : '⏳ Pending MSWD Decision'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not complied yet</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isPastDeadline
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isCompleted ? 'Complied ✓' : isPastDeadline ? 'Expired' : 'Pending'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {latestMod && onNavigateToActivityMonitoring && (
                            <button
                              type="button"
                              onClick={onNavigateToActivityMonitoring}
                              className="px-2.5 py-1 rounded-lg bg-accent hover:bg-[#B5673C] text-white text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              View &amp; Decide →
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveAssignment(asg.id)}
                            className="px-2.5 py-1 rounded-lg text-danger hover:bg-danger/10 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredAssignments.length === 0 && (
            <p className="text-xs text-center py-6 text-dash-ink-soft">
              No teacher curriculum assignments found matching your filter criteria.
            </p>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ASSIGN CURRICULUM TO TEACHERS                     */}
      {/* ======================================================== */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-card-border shadow-2xl max-w-xl w-full p-6 space-y-5 animate-scaleUp max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E6D2]">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Assign Curriculum Guide to Teacher(s)
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5">
                  Select teacher, Child Development Center, and the ECCD quarters to deploy.
                </p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] hover:bg-[#F0E6D2] flex items-center justify-center text-dash-ink-soft text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
              {/* Assignment Scope / Target Type */}
              <div className="space-y-1.5">
                <label className="font-bold text-dash-ink block">Assignment Target Scope</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                      targetType === 'all'
                        ? 'border-[#2E6B38] bg-[#F2F8F3] text-[#2E6B38]'
                        : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                    }`}
                  >
                    🌟 All Teachers
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('teacher')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                      targetType === 'teacher'
                        ? 'border-accent bg-[#FFF5EE] text-accent'
                        : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                    }`}
                  >
                    👩‍🏫 Single Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('barangay')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                      targetType === 'barangay'
                        ? 'border-accent bg-[#FFF5EE] text-accent'
                        : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                    }`}
                  >
                    🏘️ Whole Barangay
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('cdc')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                      targetType === 'cdc'
                        ? 'border-accent bg-[#FFF5EE] text-accent'
                        : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                    }`}
                  >
                    🏫 Specific CDC
                  </button>
                </div>
              </div>

              {targetType === 'all' && (
                <div className="p-3 bg-[#F2F8F3] border border-[#CDE5D1] rounded-xl text-xs text-[#25572D] font-semibold leading-relaxed">
                  📢 <b>Deploy to All Teachers:</b> This will assign the selected <b>{selectedLevelForAssign}</b> curriculum guide and chosen quarters to <b>all 84 Child Development Teachers across 64 Daycare Centers</b> in Manolo Fortich.
                </div>
              )}

              {/* Target Selector */}
              {targetType === 'teacher' && (
                <div className="space-y-1">
                  <label className="font-bold text-dash-ink block">Select Teacher</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="">-- Choose Teacher from 46 CDCs --</option>
                    {activeTeachersList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} — Brgy. {t.barangay} ({t.cdc_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'barangay' && (
                <div className="space-y-1">
                  <label className="font-bold text-dash-ink block">Select Barangay</label>
                  <select
                    value={selectedBarangayForAssign}
                    onChange={(e) => setSelectedBarangayForAssign(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="">-- Choose Barangay (All CDCs & Teachers) --</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'cdc' && (
                <div className="space-y-1">
                  <label className="font-bold text-dash-ink block">Select Child Development Center (CDC)</label>
                  <select
                    value={selectedCdcForAssign}
                    onChange={(e) => setSelectedCdcForAssign(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="">-- Choose Child Development Center --</option>
                    {realCdcsList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} (Brgy. {c.barangay})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Curriculum Level */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Curriculum Level</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLevelForAssign === 'Pre-K1'
                        ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="curriculumLevel"
                      value="Pre-K1"
                      checked={selectedLevelForAssign === 'Pre-K1'}
                      onChange={() => setSelectedLevelForAssign('Pre-K1')}
                      className="accent-slate-900"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">PRE-K 1</div>
                      <div className="text-[11px] text-slate-500">3.11 years old (3 – 3.11)</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLevelForAssign === 'Pre-K2'
                        ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="curriculumLevel"
                      value="Pre-K2"
                      checked={selectedLevelForAssign === 'Pre-K2'}
                      onChange={() => setSelectedLevelForAssign('Pre-K2')}
                      className="accent-slate-900"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">PRE-K 2</div>
                      <div className="text-[11px] text-slate-500">4.11 years old (4 – 4.11)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Quarters Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-dash-ink block">Quarters to Assign</label>
                  <button
                    type="button"
                    onClick={() => setSelectedQuartersForAssign([1, 2, 3, 4])}
                    className="text-[11px] font-bold text-accent hover:underline cursor-pointer"
                  >
                    Select All Quarters
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((qNum) => {
                    const isChecked = selectedQuartersForAssign.includes(qNum);
                    return (
                      <button
                        type="button"
                        key={qNum}
                        onClick={() => toggleQuarterCheckbox(qNum)}
                        className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          isChecked
                            ? 'border-accent bg-[#FFF5EE] text-accent'
                            : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                        }`}
                      >
                        Quarter {qNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Week Assignment Scope */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Week Scope <span className="text-slate-400 font-normal">(assign full quarter or specific weeks)</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWeekScopeMode('all');
                      setSelectedWeeksForAssign([]);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                      weekScopeMode === 'all'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    📅 All Weeks in Quarter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWeekScopeMode('specific');
                      if (selectedWeeksForAssign.length === 0 && availableWeeksInModal.length > 0) {
                        setSelectedWeeksForAssign([availableWeeksInModal[0].week]);
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                      weekScopeMode === 'specific'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    📌 Specific Week(s) Only
                  </button>
                </div>

                {weekScopeMode === 'specific' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                      <span>Click to select specific weeks:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedWeeksForAssign(availableWeeksInModal.map((w) => w.week))}
                          className="text-accent hover:underline font-bold"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedWeeksForAssign([])}
                          className="text-slate-500 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {availableWeeksInModal.map((w) => {
                        const isSelected = selectedWeeksForAssign.includes(w.week);
                        return (
                          <button
                            type="button"
                            key={w.week}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedWeeksForAssign(selectedWeeksForAssign.filter((x) => x !== w.week));
                              } else {
                                setSelectedWeeksForAssign([...selectedWeeksForAssign, w.week]);
                              }
                            }}
                            className={`p-2 text-left rounded border transition-all cursor-pointer flex items-start gap-2 ${
                              isSelected
                                ? 'border-accent bg-amber-50/70 text-amber-950 font-semibold'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                isSelected ? 'bg-amber-200/80 text-amber-900' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {w.week}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] truncate leading-tight">{w.subTheme}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedWeeksForAssign.length === 0 && (
                      <p className="text-[11px] text-amber-700 italic m-0">
                        ⚠️ Please click at least one week to assign, or choose "All Weeks in Quarter" above.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Assignment Deadline */}
              <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-950 block">
                    ⏰ Activity Submission Deadline <span className="text-coral">*</span>
                  </label>
                  <span className="text-[10.5px] text-amber-800">
                    Teacher cannot upload once this deadline expires
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={assignmentDeadline}
                  onChange={(e) => setAssignmentDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-bold text-slate-800 outline-none focus:border-accent"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10.5px] font-semibold text-slate-500">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      setAssignmentDeadline(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-200 text-[10.5px] font-semibold text-slate-700 cursor-pointer"
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setAssignmentDeadline(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-200 text-[10.5px] font-semibold text-slate-700 cursor-pointer"
                  >
                    +1 Week (7 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 14);
                      setAssignmentDeadline(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-200 text-[10.5px] font-semibold text-slate-700 cursor-pointer"
                  >
                    +2 Weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                      setAssignmentDeadline(endOfMonth.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-200 text-[10.5px] font-semibold text-slate-700 cursor-pointer"
                  >
                    End of Month
                  </button>
                </div>
              </div>

              {/* Instructions / Topic Notes for Teacher */}
              <div className="space-y-1">
                <label className="font-bold text-dash-ink block">
                  Instructions / Topic Notes for Teacher <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please post interactive toddler worksheets and tactile coloring crafts for this topic..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-medium text-dash-ink outline-none focus:border-accent text-xs"
                />
              </div>

              {/* School Year */}
              <div className="space-y-1">
                <label className="font-bold text-dash-ink block">Academic School Year</label>
                <input
                  type="text"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                />
              </div>

              {assignSuccessMsg && (
                <div className="p-3 rounded-xl bg-[#DCEBDD] text-[#2E6B38] font-bold text-xs text-center">
                  {assignSuccessMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0E6D2]">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D5C7B0] hover:bg-[#FAF5EC] text-dash-ink font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Confirm &amp; Assign Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
