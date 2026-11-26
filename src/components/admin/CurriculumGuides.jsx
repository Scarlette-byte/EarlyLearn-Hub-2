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
  cleanTeacherDisplayName,
  isDummyTeacherAccount,
  purgeDummyTeacherAccountsFromLocalStorage,
  fetchSyncedTeachersList,
} from '../../lib/curriculumData.js';
import { supabase, barangays } from '../../lib/supabaseClient';
import { Button, Card, Modal, Badge, Tabs, PageHeader, EmptyState, Toast } from '../ui/index.js';
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
import Icon, {
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
    purgeDummyTeacherAccountsFromLocalStorage();

    async function fetchSupabaseTeachers() {
      try {
        const synced = await fetchSyncedTeachersList(supabase);
        setDbTeachers(synced.filter((t) => !isDummyTeacherAccount(t)));
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
                  const asg = parsed.assignment;
                  if (asg.is_deleted || isDummyTeacherAccount(asg.teacherName)) {
                    return;
                  }
                  sbAssigns.push({
                    ...asg,
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
              if (
                a &&
                a.id &&
                !a.is_deleted &&
                !isDummyTeacherAccount(a.teacherName) &&
                !seen.has(a.id)
              ) {
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
    window.addEventListener('earlylearn_teacher_profile_saved', handleSync);
    window.addEventListener('earlylearn_assignments_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_teachers_updated', handleSync);
      window.removeEventListener('earlylearn_teacher_profile_saved', handleSync);
      window.removeEventListener('earlylearn_assignments_updated', handleSync);
    };
  }, []);

  // Real active teachers list merged with Supabase and local overrides
  const activeTeachersList = useMemo(() => {
    const base = dbTeachers.length > 0 ? [...dbTeachers] : [...realTeachersList];
    return base
      .filter((t) => !isDummyTeacherAccount(t))
      .map((t) => ({
        ...t,
        full_name: cleanTeacherDisplayName(t.full_name) || t.full_name,
      }));
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
      const built = {
        id: 'asg-' + Date.now() + '-all',
        targetType: 'all',
        teacherId: 'all',
        teacherName: 'All Teachers',
        barangay: 'all',
        cdcName: 'All Child Development Centers',
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
      };
      newAssignmentsList.push(built);
      createdOnly.push(built);
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
        let catId = null;
        try {
          const { data: cats } = await supabase.from('categories').select('id').limit(1);
          catId = cats?.[0]?.id || null;
        } catch { }

        const { data: { user } } = await supabase.auth.getUser();
        const rowsToInsert = createdOnly.map((asg) => ({
          category_id: catId,
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

    setAssignSuccessMsg(`Topic "${resolvedTopic}" assigned successfully with deadline ${assignmentDeadline}!`);
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
    <div className="space-y-5 min-w-0">
      {/* Top Banner / Header Card */}
      <Card accentBar>
        <PageHeader
          className="!pb-0 !border-b-0"
          icon="materials"
          eyebrow="Official ECCD Curriculum Guidelines • MSWDO Manolo Fortich"
          title="Curriculum Guides & Teacher Assignments"
          subtitle="Official prescribed ECCD early childhood lesson plans for Pre-K 1 (3.11 years old) and Pre-K 2 (4.11 years old). Assign quarterly curriculum competencies to Child Development Teachers across all 64 centers."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon="check"
                onClick={() => {
                  setTargetType('all');
                  setSelectedLevelForAssign(selectedLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2');
                  setSelectedQuartersForAssign([1, 2, 3, 4]);
                  setAssignSuccessMsg('');
                  setAssignModalOpen(true);
                }}
              >
                Assign to All Teachers
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => handleOpenAssignModal()}
              >
                Assign Specific Teacher/CDC
              </Button>
            </div>
          }
        />
      </Card>

      {/* Primary Navigation Bar (Tabs & View Controls) */}
      <Card padding="sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <span className="text-xs font-extrabold text-ui-ink-muted uppercase tracking-wider">
              Level:
            </span>
            <Tabs
              ariaLabel="Pre-K curriculum level"
              activeKey={selectedLevel}
              onChange={setSelectedLevel}
              tabs={[
                { key: 'PRE-K1', label: 'PRE-K 1 (3.11 y/o)', count: 'Q1–Q4' },
                { key: 'PRE-K2', label: 'PRE-K 2 (4.11 y/o)', count: 'Q1–Q4' },
              ]}
            />
          </div>

          <Tabs
            ariaLabel="Curriculum view mode"
            activeKey={activeView}
            onChange={setActiveView}
            tabs={[
              { key: 'matrix', label: 'Curriculum Matrix', icon: 'book' },
              { key: 'assignments', label: 'Assigned Teachers', icon: 'teachers', count: assignments.length },
            ]}
          />
        </div>
      </Card>

      {/* FILTER & SEARCH ROW */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between min-w-0">
          <div className="relative w-full sm:w-80">
            <IconSearch className="w-4 h-4 text-ui-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search themes, weeks, sub-themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${input} !pl-9 !py-2 !text-xs`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {activeView === 'matrix' ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-ui-ink-secondary whitespace-nowrap">Quarter:</span>
                <select
                  value={quarterFilter}
                  onChange={(e) => setQuarterFilter(e.target.value)}
                  className={`${input} !w-auto !py-2 !text-xs cursor-pointer`}
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
                <span className="text-xs font-bold text-ui-ink-secondary whitespace-nowrap">Barangay:</span>
                <select
                  value={selectedBarangayFilter}
                  onChange={(e) => setSelectedBarangayFilter(e.target.value)}
                  className={`${input} !w-auto !py-2 !text-xs cursor-pointer`}
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
      </Card>

      {/* VIEW 1: CURRICULUM MATRIX VIEW */}
      {activeView === 'matrix' && (
        <div className="space-y-5">
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
                className="bg-ui-surface rounded-ui-card border border-ui-border shadow-card overflow-hidden"
              >
                {/* Quarter Header Banner */}
                <div className="bg-ui-surface-subtle px-5 py-3.5 border-b border-ui-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <Badge variant="dark" size="md">
                      {q.quarter}
                    </Badge>
                    <span className="font-bold text-sm text-ui-ink break-words">
                      {q.suggestedContent} •{' '}
                      <span className="font-semibold text-xs text-ui-ink-muted">({q.month})</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Badge variant="neutral" icon="teachers">
                      {assignedTeachersForQ.length} Teachers Assigned
                    </Badge>
                    <Badge variant="success" icon="materials">
                      {uploadedModulesForQ} Modules Uploaded
                    </Badge>
                    <Button
                      variant="primary"
                      size="xs"
                      icon="plus"
                      onClick={() => handleOpenAssignModal(q.quarterNumber)}
                    >
                      Assign Q{q.quarterNumber}
                    </Button>
                  </div>
                </div>

                {/* ECCD Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-ui-surface-warm/60 border-b border-ui-border text-[11px] font-extrabold text-ui-ink-secondary uppercase tracking-wider">
                        <th className="px-4 py-3 border-r border-ui-border w-[180px]">
                          Quarter &amp; Suggested Content
                        </th>
                        <th className="px-4 py-3 border-r border-ui-border w-[210px] bg-brand-yellow-tint text-brand-yellow-deep">
                          THEME (FOCUS AREA)
                        </th>
                        <th className="px-4 py-3 border-r border-ui-border w-[130px]">WEEK</th>
                        <th className="px-4 py-3 border-r border-ui-border">SUB-THEMES / COMPETENCIES</th>
                        <th className="px-4 py-3 border-r border-ui-border w-[130px]">MONTH</th>
                        <th className="px-4 py-3 text-center w-[150px]">DEPED ECCD ACTIVITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ui-border/70">
                      {q.filteredWeeks.map((w, wIdx) => (
                        <tr key={w.week + wIdx} className="hover:bg-brand-leaf-tint/30 transition-colors">
                          {wIdx === 0 && (
                            <td
                              rowSpan={q.filteredWeeks.length}
                              className="px-4 py-4 font-semibold text-ui-ink align-middle border-r border-ui-border bg-ui-surface-subtle"
                            >
                              <div className="text-xs font-extrabold text-brand-leaf-deep uppercase tracking-wider mb-1">
                                {q.quarter}
                              </div>
                              <div className="text-xs text-ui-ink font-semibold leading-relaxed">
                                {q.suggestedContent}
                              </div>
                            </td>
                          )}

                          {wIdx === 0 && (
                            <td
                              rowSpan={q.filteredWeeks.length}
                              className="px-4 py-4 align-middle border-r border-ui-border bg-brand-yellow-tint/70 text-ui-ink border-l-2 border-l-brand-yellow"
                            >
                              <div className="font-extrabold text-xs uppercase leading-snug tracking-wide">
                                {q.theme}
                              </div>
                            </td>
                          )}

                          <td className="px-4 py-3 font-semibold text-ui-ink border-r border-ui-border whitespace-nowrap bg-ui-surface">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                              <Badge variant="neutral" size="xs">
                                {w.week}
                              </Badge>
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
                                className="text-[10.5px] font-extrabold text-brand-leaf-deep hover:text-white bg-brand-leaf-tint hover:bg-brand-leaf-deep border border-brand-leaf/40 px-2 py-0.5 rounded-md cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                                title={`Assign "${w.subTheme}" (${w.week}) to teacher`}
                              >
                                <Icon name="target" size={12} />
                                <span>+ Assign Topic</span>
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-semibold text-ui-ink border-r border-ui-border bg-ui-surface">
                            <div className="text-xs tracking-wide leading-relaxed">{w.subTheme}</div>
                          </td>

                          <td className="px-4 py-3 text-ui-ink-muted border-r border-ui-border whitespace-nowrap bg-ui-surface text-[11px]">
                            {q.month}
                          </td>

                          <td className="px-4 py-3 bg-ui-surface text-ui-ink-secondary text-[11px] leading-relaxed">
                            {w.suggestedActivities}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Assigned Teachers Bar for this Quarter */}
                <div className="p-3.5 bg-ui-surface-subtle border-t border-ui-border flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ui-ink-secondary">Assigned Teachers for {q.quarter}:</span>
                    {assignedTeachersForQ.length === 0 ? (
                      <span className="text-ui-ink-muted italic">No teachers assigned yet.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedTeachersForQ.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-ui-surface border border-ui-border text-[11px] font-bold text-ui-ink"
                          >
                            <IconTeachers className="w-3 h-3 text-brand-leaf-deep" />
                            <span>{t.teacherName}</span>
                            <span className="text-[10px] text-ui-ink-muted">({t.barangay})</span>
                          </span>
                        ))}
                        {assignedTeachersForQ.length > 4 && (
                          <span className="text-[11px] font-extrabold text-brand-leaf-deep self-center">
                            +{assignedTeachersForQ.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(q.quarterNumber)}
                    className="text-xs font-extrabold text-brand-leaf-deep hover:underline cursor-pointer bg-transparent border-none inline-flex items-center gap-1"
                  >
                    <span>Manage Quarter Assignments</span>
                    <Icon name="arrow-right" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: TEACHER ASSIGNMENTS OVERVIEW */}
      {activeView === 'assignments' && (
        <Card
          icon="teachers"
          title="Curriculum Guide Teacher Assignments Roster"
          subtitle="Overview of Child Development Teachers and assigned Curriculum Guides (Pre-K1 / Pre-K2), Quarters, and specific Weeks across CDCs."
          action={
            <Button variant="primary" size="sm" icon="plus" onClick={() => handleOpenAssignModal()}>
              Assign New Teacher
            </Button>
          }
          bodyClassName="space-y-4"
        >
          {/* Filters Bar for Roster */}
          <div className="p-3 bg-ui-surface-subtle border border-ui-border rounded-xl flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-bold text-ui-ink-secondary">Filter By:</span>

            <select
              value={assignedQuarterFilter}
              onChange={(e) => setAssignedQuarterFilter(e.target.value)}
              className={`${input} !w-auto !py-1.5 !text-xs cursor-pointer`}
            >
              <option value="all">All Quarters</option>
              <option value="1">Quarter 1</option>
              <option value="2">Quarter 2</option>
              <option value="3">Quarter 3</option>
              <option value="4">Quarter 4</option>
            </select>

            <select
              value={assignedWeekFilter}
              onChange={(e) => setAssignedWeekFilter(e.target.value)}
              className={`${input} !w-auto !py-1.5 !text-xs cursor-pointer`}
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

            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search teacher, CDC, or barangay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${input} !pl-8 !py-1.5 !text-xs`}
              />
              <IconSearch className="w-3.5 h-3.5 text-ui-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {(assignedQuarterFilter !== 'all' || assignedWeekFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setAssignedQuarterFilter('all');
                  setAssignedWeekFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-brand-leaf-deep hover:underline font-extrabold cursor-pointer bg-transparent border-none"
              >
                Reset
              </button>
            )}
          </div>

          {filteredAssignments.length === 0 ? (
            <EmptyState
              icon="teachers"
              title="No teacher curriculum assignments found"
              description="Try clearing your search or quarter/week filters, or assign a new topic above."
            />
          ) : (
            <div className="overflow-x-auto rounded-ui-card border border-ui-border">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-ui-surface-subtle border-b border-ui-border text-[11px] font-extrabold text-ui-ink-secondary uppercase tracking-wider">
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
                <tbody className="divide-y divide-ui-border/70">
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
                      <tr key={asg.id} className="hover:bg-brand-leaf-tint/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-ui-ink text-[12.5px]">{asg.teacherName}</div>
                          <div className="text-[11px] text-ui-ink-muted">
                            SY {asg.schoolYear} • Assigned: {asg.assignedDate}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-ui-ink flex items-center gap-1">
                            <IconBuilding className="w-3.5 h-3.5 text-brand-leaf-deep shrink-0" />
                            <span>{asg.cdcName}</span>
                          </div>
                          <div className="text-[11px] text-ui-ink-muted flex items-center gap-1 mt-0.5">
                            <IconPin className="w-3 h-3 text-ui-ink-muted shrink-0" />
                            <span>Brgy. {asg.barangay}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <Badge variant={asg.level === 'Pre-K1' ? 'primary' : 'info'}>
                            {asg.level}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-ui-ink text-xs">
                            {asg.topicTitle || formatAssignmentCoverage(asg)}
                          </div>
                          {asg.subTheme && (
                            <div className="text-[11px] text-ui-ink-muted mt-0.5 line-clamp-1 italic">
                              Focus: {asg.subTheme}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {asg.quarters.map((q) => (
                              <Badge key={q} variant="neutral" size="xs">Q{q}</Badge>
                            ))}
                            {asg.weeks && asg.weeks !== 'all' && Array.isArray(asg.weeks) && asg.weeks.map((w) => (
                              <Badge key={w} variant="gold" size="xs">{w}</Badge>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {asg.deadline ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <Badge
                                variant={isCompleted ? 'success' : isPastDeadline ? 'danger' : 'warning'}
                                icon="calendar"
                              >
                                {asg.deadline}
                              </Badge>
                              <span className="text-[10px] font-semibold text-ui-ink-muted">
                                {isCompleted ? 'Complied' : isPastDeadline ? 'Deadline Passed' : 'Open for Upload'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-ui-ink-muted text-xs italic">No deadline set</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {latestMod ? (
                            <div className="space-y-1 max-w-[220px]">
                              <div className="font-bold text-ui-ink text-xs truncate" title={latestMod.title}>
                                {latestMod.title}
                              </div>
                              <Badge
                                variant={
                                  latestMod.verified_by_mswd || latestMod.status === 'Approved'
                                    ? 'success'
                                    : latestMod.status === 'Rejected' || latestMod.status === 'Needs Revision'
                                      ? 'danger'
                                      : 'warning'
                                }
                                size="xs"
                              >
                                {latestMod.verified_by_mswd || latestMod.status === 'Approved'
                                  ? latestMod.posted_to_students
                                    ? 'Approved & Posted'
                                    : 'Approved by MSWD'
                                  : latestMod.status === 'Rejected' || latestMod.status === 'Needs Revision'
                                    ? 'Rejected by MSWD'
                                    : 'Pending MSWD Decision'}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-[11px] text-ui-ink-muted italic">Not complied yet</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <Badge
                            variant={isCompleted ? 'success' : isPastDeadline ? 'danger' : 'warning'}
                            icon={isCompleted ? 'check' : undefined}
                          >
                            {isCompleted ? 'Complied' : isPastDeadline ? 'Expired' : 'Pending'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {latestMod && onNavigateToActivityMonitoring && (
                              <Button
                                variant="primary"
                                size="xs"
                                iconRight="arrow-right"
                                onClick={onNavigateToActivityMonitoring}
                              >
                                View &amp; Decide
                              </Button>
                            )}
                            <Button
                              variant="dangerSoft"
                              size="xs"
                              onClick={() => handleRemoveAssignment(asg.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* MODAL: ASSIGN CURRICULUM TO TEACHERS */}
      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        icon="target"
        title="Assign Curriculum Guide to Teacher(s)"
        subtitle="Select teacher, Child Development Center, and the ECCD quarters to deploy."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
          {/* Assignment Scope / Target Type */}
          <div className="space-y-1.5">
            <label className="font-bold text-ui-ink block">Assignment Target Scope</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'all', label: 'All Teachers', icon: 'sparkles' },
                { key: 'teacher', label: 'Single Teacher', icon: 'teachers' },
                { key: 'barangay', label: 'Whole Barangay', icon: 'neighborhood' },
                { key: 'cdc', label: 'Specific CDC', icon: 'school' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTargetType(opt.key)}
                  className={`py-2 px-2.5 rounded-ui-btn font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    targetType === opt.key
                      ? 'border-brand-leaf-deep bg-brand-leaf-tint text-brand-leaf-deep shadow-2xs'
                      : 'border-ui-border bg-ui-surface text-ui-ink-secondary hover:border-ui-border-strong'
                  }`}
                >
                  <Icon name={opt.icon} size={13} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {targetType === 'all' && (
            <div className="p-3 bg-brand-leaf-tint border border-brand-leaf/35 rounded-xl text-xs text-brand-leaf-deep font-semibold leading-relaxed flex items-start gap-2">
              <Icon name="megaphone" size={15} className="mt-0.5 shrink-0" />
              <span>
                <b>Deploy to All Teachers:</b> This will assign the selected <b>{selectedLevelForAssign}</b> curriculum guide and chosen quarters to <b>all 84 Child Development Teachers across 64 Daycare Centers</b> in Manolo Fortich.
              </span>
            </div>
          )}

          {targetType === 'teacher' && (
            <div className="space-y-1">
              <label className="font-bold text-ui-ink block">Select Teacher</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                required
                className={`${input} !text-xs cursor-pointer`}
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
              <label className="font-bold text-ui-ink block">Select Barangay</label>
              <select
                value={selectedBarangayForAssign}
                onChange={(e) => setSelectedBarangayForAssign(e.target.value)}
                required
                className={`${input} !text-xs cursor-pointer`}
              >
                <option value="">-- Choose Barangay (All CDCs &amp; Teachers) --</option>
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
              <label className="font-bold text-ui-ink block">Select Child Development Center (CDC)</label>
              <select
                value={selectedCdcForAssign}
                onChange={(e) => setSelectedCdcForAssign(e.target.value)}
                required
                className={`${input} !text-xs cursor-pointer`}
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
            <label className="text-xs font-bold text-ui-ink block">Curriculum Level</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: 'Pre-K1', title: 'PRE-K 1', sub: '3.11 years old (3 – 3.11)' },
                { val: 'Pre-K2', title: 'PRE-K 2', sub: '4.11 years old (4 – 4.11)' },
              ].map((lvl) => (
                <label
                  key={lvl.val}
                  className={`flex items-center gap-2.5 p-3 rounded-ui-input border cursor-pointer transition-colors ${
                    selectedLevelForAssign === lvl.val
                      ? 'border-brand-leaf-deep bg-brand-leaf-tint text-ui-ink font-semibold'
                      : 'border-ui-border bg-ui-surface text-ui-ink-secondary hover:bg-ui-surface-subtle'
                  }`}
                >
                  <input
                    type="radio"
                    name="curriculumLevel"
                    value={lvl.val}
                    checked={selectedLevelForAssign === lvl.val}
                    onChange={() => setSelectedLevelForAssign(lvl.val)}
                    className="accent-brand-leaf-deep"
                  />
                  <div>
                    <div className="text-xs font-extrabold text-ui-ink">{lvl.title}</div>
                    <div className="text-[11px] text-ui-ink-muted">{lvl.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quarters Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-ui-ink block">Quarters to Assign</label>
              <button
                type="button"
                onClick={() => setSelectedQuartersForAssign([1, 2, 3, 4])}
                className="text-[11px] font-extrabold text-brand-leaf-deep hover:underline cursor-pointer bg-transparent border-none"
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
                    className={`py-2 px-3 rounded-ui-btn font-bold border transition-all cursor-pointer text-center ${
                      isChecked
                        ? 'border-brand-leaf-deep bg-brand-leaf-tint text-brand-leaf-deep'
                        : 'border-ui-border bg-ui-surface text-ui-ink-secondary'
                    }`}
                  >
                    Quarter {qNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Week Assignment Scope */}
          <div className="space-y-2 pt-2 border-t border-ui-border">
            <label className="text-xs font-bold text-ui-ink block">
              Week Scope <span className="text-ui-ink-muted font-normal">(assign full quarter or specific weeks)</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setWeekScopeMode('all');
                  setSelectedWeeksForAssign([]);
                }}
                className={`py-2 px-3 rounded-ui-btn text-xs font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                  weekScopeMode === 'all'
                    ? 'border-ui-panel bg-ui-panel text-white'
                    : 'border-ui-border bg-ui-surface text-ui-ink-secondary hover:bg-ui-surface-subtle'
                }`}
              >
                <Icon name="calendar" size={13} />
                <span>All Weeks in Quarter</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeekScopeMode('specific');
                  if (selectedWeeksForAssign.length === 0 && availableWeeksInModal.length > 0) {
                    setSelectedWeeksForAssign([availableWeeksInModal[0].week]);
                  }
                }}
                className={`py-2 px-3 rounded-ui-btn text-xs font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                  weekScopeMode === 'specific'
                    ? 'border-ui-panel bg-ui-panel text-white'
                    : 'border-ui-border bg-ui-surface text-ui-ink-secondary hover:bg-ui-surface-subtle'
                }`}
              >
                <Icon name="push-pin" size={13} />
                <span>Specific Week(s) Only</span>
              </button>
            </div>

            {weekScopeMode === 'specific' && (
              <div className="p-3 bg-ui-surface-subtle border border-ui-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px] text-ui-ink-secondary font-semibold">
                  <span>Click to select specific weeks:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWeeksForAssign(availableWeeksInModal.map((w) => w.week))}
                      className="text-brand-leaf-deep hover:underline font-extrabold bg-transparent border-none cursor-pointer"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedWeeksForAssign([])}
                      className="text-ui-ink-muted hover:underline bg-transparent border-none cursor-pointer"
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
                        className={`p-2 text-left rounded-lg border transition-all cursor-pointer flex items-start gap-2 ${
                          isSelected
                            ? 'border-brand-leaf-deep bg-brand-leaf-tint text-ui-ink font-semibold'
                            : 'border-ui-border bg-ui-surface text-ui-ink-secondary hover:border-ui-border-strong'
                        }`}
                      >
                        <Badge variant={isSelected ? 'primary' : 'neutral'} size="xs">
                          {w.week}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] truncate leading-tight">{w.subTheme}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedWeeksForAssign.length === 0 && (
                  <p className="text-[11px] text-status-warn italic m-0 flex items-center gap-1">
                    <Icon name="warning" size={12} />
                    <span>Please click at least one week to assign, or choose &ldquo;All Weeks in Quarter&rdquo; above.</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Assignment Deadline */}
          <div className="space-y-1.5 p-3.5 rounded-xl bg-brand-yellow-tint/70 border border-brand-yellow/60">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="font-bold text-ui-ink flex items-center gap-1.5">
                <Icon name="alarm" size={14} className="text-brand-yellow-deep" />
                <span>Activity Submission Deadline <span className="text-status-error">*</span></span>
              </label>
              <span className="text-[10.5px] text-brand-yellow-deep font-semibold">
                Teacher cannot upload once this deadline expires
              </span>
            </div>
            <input
              type="date"
              required
              value={assignmentDeadline}
              onChange={(e) => setAssignmentDeadline(e.target.value)}
              className={`${input} !bg-ui-surface !text-xs font-bold`}
            />
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10.5px] font-semibold text-ui-ink-muted">Quick Presets:</span>
              {[
                { label: '+3 Days', days: 3 },
                { label: '+1 Week (7 Days)', days: 7 },
                { label: '+2 Weeks', days: 14 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + preset.days);
                    setAssignmentDeadline(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 rounded-md bg-ui-surface hover:bg-brand-yellow-tint border border-ui-border text-[10.5px] font-bold text-ui-ink cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                  setAssignmentDeadline(endOfMonth.toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 rounded-md bg-ui-surface hover:bg-brand-yellow-tint border border-ui-border text-[10.5px] font-bold text-ui-ink cursor-pointer"
              >
                End of Month
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-ui-ink block">
              Instructions / Topic Notes for Teacher <span className="text-ui-ink-muted font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please post interactive toddler worksheets and tactile coloring crafts for this topic..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className={`${input} !text-xs`}
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-ui-ink block">Academic School Year</label>
            <input
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className={`${input} !text-xs font-bold`}
            />
          </div>

          {assignSuccessMsg && (
            <Toast floating={false} type="success" message={assignSuccessMsg} />
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ui-border">
            <Button variant="secondary" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" icon="check">
              Confirm &amp; Assign Guide
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
