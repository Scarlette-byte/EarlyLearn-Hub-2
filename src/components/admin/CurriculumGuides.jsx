import { useState, useMemo } from 'react';
import {
  preK1Curriculum,
  preK2Curriculum,
  realTeachersList,
  realCdcsList,
  initialCurriculumAssignments,
  initialTeacherModules,
} from '../../lib/curriculumData.js';
import { barangays } from '../../lib/supabaseClient';
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

  // Curriculum assignments state (persisted to localStorage)
  const [assignments, setAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_curriculum_assignments');
      return saved ? JSON.parse(saved) : initialCurriculumAssignments;
    } catch {
      return initialCurriculumAssignments;
    }
  });

  // Modal State for Assigning Curriculum
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedQuarterForModal, setSelectedQuarterForModal] = useState('all');
  const [targetType, setTargetType] = useState('teacher'); // 'teacher' | 'barangay' | 'cdc'
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedBarangayForAssign, setSelectedBarangayForAssign] = useState('');
  const [selectedCdcForAssign, setSelectedCdcForAssign] = useState('');
  const [selectedLevelForAssign, setSelectedLevelForAssign] = useState('Pre-K1');
  const [selectedQuartersForAssign, setSelectedQuartersForAssign] = useState([1, 2]);
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

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

  // Helper to count modules uploaded for a quarter
  const getModulesCountForQuarter = (levelStr, quarterNum) => {
    return initialTeacherModules.filter(
      (m) => m.level.toLowerCase() === levelStr.toLowerCase() && m.quarter === quarterNum
    ).length;
  };

  // Open modal with pre-selected quarter if clicked from matrix
  const handleOpenAssignModal = (quarterNum = null) => {
    if (quarterNum) {
      setSelectedQuarterForModal(quarterNum);
      setSelectedQuartersForAssign([quarterNum]);
    } else {
      setSelectedQuarterForModal('all');
      setSelectedQuartersForAssign([1, 2, 3, 4]);
    }
    setSelectedLevelForAssign(selectedLevel === 'PRE-K1' ? 'Pre-K1' : 'Pre-K2');
    setAssignSuccessMsg('');
    setAssignModalOpen(true);
  };

  // Save new assignment
  const handleSaveAssignment = (e) => {
    e.preventDefault();
    let newAssignmentsList = [...assignments];

    if (targetType === 'teacher') {
      const teacher = realTeachersList.find((t) => t.id === selectedTeacherId);
      if (!teacher) {
        alert('Please select a teacher.');
        return;
      }

      // Check if already assigned this level
      const existingIdx = newAssignmentsList.findIndex(
        (a) => a.teacherId === teacher.id && a.level === selectedLevelForAssign
      );

      const newAssignmentObj = {
        id: 'asg-' + Date.now(),
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        barangay: teacher.barangay,
        cdcName: teacher.cdc_name,
        level: selectedLevelForAssign,
        quarters: selectedQuartersForAssign,
        schoolYear,
        status: 'Active',
        assignedDate: new Date().toISOString().split('T')[0],
      };

      if (existingIdx >= 0) {
        newAssignmentsList[existingIdx] = {
          ...newAssignmentsList[existingIdx],
          quarters: Array.from(new Set([...newAssignmentsList[existingIdx].quarters, ...selectedQuartersForAssign])),
          schoolYear,
        };
      } else {
        newAssignmentsList.push(newAssignmentObj);
      }
    } else if (targetType === 'barangay') {
      if (!selectedBarangayForAssign) {
        alert('Please select a Barangay.');
        return;
      }
      const teachersInBrgy = realTeachersList.filter((t) => t.barangay === selectedBarangayForAssign);
      if (teachersInBrgy.length === 0) {
        alert('No teachers found in this Barangay.');
        return;
      }

      teachersInBrgy.forEach((teacher) => {
        const existingIdx = newAssignmentsList.findIndex(
          (a) => a.teacherId === teacher.id && a.level === selectedLevelForAssign
        );
        if (existingIdx >= 0) {
          newAssignmentsList[existingIdx] = {
            ...newAssignmentsList[existingIdx],
            quarters: Array.from(new Set([...newAssignmentsList[existingIdx].quarters, ...selectedQuartersForAssign])),
          };
        } else {
          newAssignmentsList.push({
            id: 'asg-' + Date.now() + '-' + teacher.id,
            teacherId: teacher.id,
            teacherName: teacher.full_name,
            barangay: teacher.barangay,
            cdcName: teacher.cdc_name,
            level: selectedLevelForAssign,
            quarters: selectedQuartersForAssign,
            schoolYear,
            status: 'Active',
            assignedDate: new Date().toISOString().split('T')[0],
          });
        }
      });
    } else if (targetType === 'cdc') {
      if (!selectedCdcForAssign) {
        alert('Please select a CDC.');
        return;
      }
      const teachersInCdc = realTeachersList.filter((t) => t.cdc_name === selectedCdcForAssign);
      if (teachersInCdc.length === 0) {
        alert('No teachers found assigned to this CDC.');
        return;
      }

      teachersInCdc.forEach((teacher) => {
        const existingIdx = newAssignmentsList.findIndex(
          (a) => a.teacherId === teacher.id && a.level === selectedLevelForAssign
        );
        if (existingIdx >= 0) {
          newAssignmentsList[existingIdx] = {
            ...newAssignmentsList[existingIdx],
            quarters: Array.from(new Set([...newAssignmentsList[existingIdx].quarters, ...selectedQuartersForAssign])),
          };
        } else {
          newAssignmentsList.push({
            id: 'asg-' + Date.now() + '-' + teacher.id,
            teacherId: teacher.id,
            teacherName: teacher.full_name,
            barangay: teacher.barangay,
            cdcName: teacher.cdc_name,
            level: selectedLevelForAssign,
            quarters: selectedQuartersForAssign,
            schoolYear,
            status: 'Active',
            assignedDate: new Date().toISOString().split('T')[0],
          });
        }
      });
    }

    setAssignments(newAssignmentsList);
    try {
      localStorage.setItem('earlylearn_curriculum_assignments', JSON.stringify(newAssignmentsList));
    } catch {
      // Ignored
    }

    setAssignSuccessMsg('✅ Curriculum Guide successfully assigned!');
    setTimeout(() => {
      setAssignModalOpen(false);
      setAssignSuccessMsg('');
    }, 1200);
  };

  // Remove assignment
  const handleRemoveAssignment = (id) => {
    if (!confirm('Remove this curriculum assignment?')) return;
    const updated = assignments.filter((a) => a.id !== id);
    setAssignments(updated);
    try {
      localStorage.setItem('earlylearn_curriculum_assignments', JSON.stringify(updated));
    } catch {
      // Ignored
    }
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
      return matchesSearch && matchesBrgy && matchesLevel;
    });
  }, [assignments, searchQuery, selectedBarangayFilter, selectedLevel]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header Card */}
      <div className="bg-gradient-to-r from-[#FAF5EC] via-[#FFFDF8] to-[#FFF9F0] p-6 rounded-3xl border border-card-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE4D6] text-accent text-xs font-bold">
            <IconMaterials className="w-3.5 h-3.5" />
            <span>Official MSWD ECCD Curriculum Guides • Municipality of Manolo Fortich</span>
          </div>
          <h2 className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink m-0">
            Curriculum Guides & Teacher Assignments
          </h2>
          <p className="text-xs sm:text-sm text-dash-ink-soft leading-relaxed m-0">
            Official DepEd / ECCD Early Childhood Care curriculum guidelines. Manage weekly themes, sub-themes, and assign specific curriculum quarters to Child Development Teachers across all 46 Daycare Centers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleOpenAssignModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Assign Guide to Teachers</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Bar (Tabs & View Controls) */}
      <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Pre-K Level Excel-style Tabs */}
        <div className="flex items-center gap-2 border-b lg:border-b-0 pb-2 lg:pb-0 border-[#F0E6D2]">
          <span className="text-xs font-bold text-[#8A7F66] uppercase tracking-wider mr-1">
            Curriculum Level:
          </span>
          <button
            onClick={() => setSelectedLevel('PRE-K1')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedLevel === 'PRE-K1'
                ? 'bg-[#2E6B38] text-white shadow-xs scale-102'
                : 'bg-[#F2F8F3] text-[#2E6B38] hover:bg-[#E3EFE4]'
            }`}
          >
            <span>🌱</span>
            <span>PRE-K1 (Ages 3–4)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedLevel === 'PRE-K1' ? 'bg-white/25 text-white' : 'bg-[#DCEBDD] text-[#2E6B38]'}`}>
              4 Quarters
            </span>
          </button>

          <button
            onClick={() => setSelectedLevel('PRE-K2')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedLevel === 'PRE-K2'
                ? 'bg-[#1E5B94] text-white shadow-xs scale-102'
                : 'bg-[#F0F7FF] text-[#1E5B94] hover:bg-[#E0EFFE]'
            }`}
          >
            <span>🌿</span>
            <span>PRE-K2 (Ages 4–5)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedLevel === 'PRE-K2' ? 'bg-white/25 text-white' : 'bg-[#E0EFFE] text-[#1E5B94]'}`}>
              4 Quarters
            </span>
          </button>
        </div>

        {/* View Toggle: Matrix vs Teacher Assignments */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#FAF5EC] p-1 border border-card-border">
            <button
              onClick={() => setActiveView('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'matrix'
                  ? 'bg-white text-dash-ink shadow-xs'
                  : 'text-dash-ink-soft hover:text-dash-ink'
              }`}
            >
              📋 Curriculum Matrix
            </button>
            <button
              onClick={() => setActiveView('assignments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'assignments'
                  ? 'bg-white text-dash-ink shadow-xs'
                  : 'text-dash-ink-soft hover:text-dash-ink'
              }`}
            >
              <span>👩‍🏫 Assigned Teachers</span>
              <span className="bg-accent text-white text-[10px] px-1.5 py-0.2 rounded-full">
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
                <option value="all">All 13 Barangays</option>
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
                className="bg-white rounded-2xl border border-card-border shadow-card overflow-hidden"
              >
                {/* Quarter Header Banner (Authentic Excel Peach Tint) */}
                <div className="bg-[#F8D7BE] px-5 py-3.5 border-b border-[#ECC4A7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-fraunces font-black text-sm uppercase tracking-wider text-[#5A2C14] bg-white/70 px-3 py-1 rounded-lg border border-[#E4B595]">
                      {q.quarter}
                    </span>
                    <span className="font-fraunces font-bold text-base text-[#4A200B]">
                      {q.suggestedContent} • <span className="font-semibold text-xs text-[#6B371B]">({q.month})</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#5A2C14] bg-white/60 px-3 py-1 rounded-lg">
                      <IconTeachers className="w-3.5 h-3.5 text-accent" />
                      <span>{assignedTeachersForQ.length} Teachers Assigned</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#2E6B38] bg-white/60 px-3 py-1 rounded-lg">
                      <IconMaterials className="w-3.5 h-3.5 text-[#2E6B38]" />
                      <span>{uploadedModulesForQ} Modules Uploaded</span>
                    </div>

                    <button
                      onClick={() => handleOpenAssignModal(q.quarterNumber)}
                      className="px-3 py-1 rounded-lg bg-accent hover:bg-[#B5673C] text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      + Assign Q{q.quarterNumber}
                    </button>
                  </div>
                </div>

                {/* Excel-Exact Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#FAF5EC] border-b border-[#E8DFC9] text-[11px] font-bold text-[#6D634C] uppercase">
                        <th className="px-4 py-3 border-r border-[#E8DFC9] w-[180px]">
                          Quarter/Term &amp; Suggested Content
                        </th>
                        <th className="px-4 py-3 border-r border-[#E8DFC9] w-[210px] bg-[#FFF2B2] text-[#634900]">
                          THEME
                        </th>
                        <th className="px-4 py-3 border-r border-[#E8DFC9] w-[130px]">WEEK</th>
                        <th className="px-4 py-3 border-r border-[#E8DFC9]">SUB-THEMES</th>
                        <th className="px-4 py-3 border-r border-[#E8DFC9] w-[140px]">MONTH</th>
                        <th className="px-4 py-3 text-center w-[120px]">SUGGESTED ACTIVITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE7D8]">
                      {q.filteredWeeks.map((w, wIdx) => (
                        <tr key={w.week + wIdx} className="hover:bg-[#FFFDF9] transition-colors">
                          {/* Span Content across the first row of each Quarter */}
                          {wIdx === 0 && (
                            <td
                              rowSpan={q.filteredWeeks.length}
                              className="px-4 py-4 font-bold text-dash-ink align-middle border-r border-[#E8DFC9] bg-[#FCF9F3]"
                            >
                              <div className="text-sm font-fraunces text-accent font-bold mb-1">
                                {q.quarter}
                              </div>
                              <div className="text-xs text-dash-ink font-semibold leading-relaxed">
                                {q.suggestedContent}
                              </div>
                            </td>
                          )}

                          {/* Yellow Theme Column matching user Excel sheet */}
                          {wIdx === 0 && (
                            <td
                              rowSpan={q.filteredWeeks.length}
                              className="px-4 py-4 align-middle border-r border-[#E8DFC9] bg-[#FFF9CC] text-[#4A3B00]"
                            >
                              <div className="font-fraunces font-extrabold text-xs tracking-wider uppercase leading-snug">
                                {q.theme}
                              </div>
                            </td>
                          )}

                          <td className="px-4 py-3 font-bold text-dash-ink border-r border-[#E8DFC9] whitespace-nowrap bg-white">
                            <span className="inline-block bg-[#F4EDE0] text-[#5C523D] px-2 py-0.5 rounded-md text-[11px] font-bold">
                              {w.week}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-bold text-[#2A2315] border-r border-[#E8DFC9] bg-white">
                            <div className="text-xs tracking-wide">{w.subTheme}</div>
                          </td>

                          <td className="px-4 py-3 text-[#6B614E] border-r border-[#E8DFC9] whitespace-nowrap bg-white text-[11.5px]">
                            {q.month}
                          </td>

                          <td className="px-4 py-3 bg-white text-dash-ink-soft text-[11px] leading-relaxed">
                            {w.suggestedActivities}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Assigned Teachers Bar for this Quarter */}
                <div className="p-3.5 bg-[#FAF6EE] border-t border-[#EFE7D8] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-dash-ink">Assigned Teachers for {q.quarter}:</span>
                    {assignedTeachersForQ.length === 0 ? (
                      <span className="text-dash-ink-soft italic">No teachers assigned yet.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedTeachersForQ.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E5DCC9] text-[11px] font-bold text-dash-ink"
                          >
                            <span>👩‍🏫</span>
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
                Overview of all Child Development Teachers and the specific Curriculum Guides (Pre-K1 / Pre-K2) and Quarters assigned to their Child Development Centers.
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

          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                  <th className="px-4 py-3">Teacher / Child Development Worker</th>
                  <th className="px-4 py-3">Barangay &amp; Child Development Center</th>
                  <th className="px-4 py-3 text-center">Curriculum Level</th>
                  <th className="px-4 py-3">Assigned Quarters</th>
                  <th className="px-4 py-3 text-center">Uploaded Modules</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredAssignments.map((asg) => {
                  const teacherModules = initialTeacherModules.filter(
                    (m) => m.teacher_name === asg.teacherName || m.teacher_id === asg.teacherId
                  );

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
                        <div className="flex flex-wrap gap-1">
                          {asg.quarters.map((q) => (
                            <span
                              key={q}
                              className="px-2 py-0.5 bg-[#FAF3E8] border border-[#E8DFC9] rounded-md text-[10.5px] font-bold text-[#5C5036]"
                            >
                              Quarter {q}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-xs text-dash-ink bg-[#FFF9ED] px-2.5 py-1 rounded-lg border border-[#F0E4CE]">
                          {teacherModules.length} Modules
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#DCEBDD] text-[#2E6B38]">
                          {asg.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleRemoveAssignment(asg.id)}
                          className="px-2.5 py-1 rounded-lg text-danger hover:bg-danger/10 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
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
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('teacher')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      targetType === 'teacher'
                        ? 'border-accent bg-[#FFF5EE] text-accent'
                        : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                    }`}
                  >
                    👩‍🏫 Individual Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('barangay')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
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
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      targetType === 'cdc'
                        ? 'border-accent bg-[#FFF5EE] text-accent'
                        : 'border-[#E5DCC9] bg-white text-dash-ink-soft'
                    }`}
                  >
                    🏫 Specific CDC
                  </button>
                </div>
              </div>

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
                    {realTeachersList.map((t) => (
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
                <label className="font-bold text-dash-ink block">Curriculum Level</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${
                      selectedLevelForAssign === 'Pre-K1'
                        ? 'border-[#2E6B38] bg-[#F2F8F3] text-[#2E6B38] font-bold'
                        : 'border-[#E5DCC9] bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="curriculumLevel"
                      value="Pre-K1"
                      checked={selectedLevelForAssign === 'Pre-K1'}
                      onChange={() => setSelectedLevelForAssign('Pre-K1')}
                      className="accent-[#2E6B38]"
                    />
                    <div>
                      <div className="font-bold">PRE-K1</div>
                      <div className="text-[11px] text-dash-ink-soft">Ages 3 to 4 Years Old</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${
                      selectedLevelForAssign === 'Pre-K2'
                        ? 'border-[#1E5B94] bg-[#F0F7FF] text-[#1E5B94] font-bold'
                        : 'border-[#E5DCC9] bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="curriculumLevel"
                      value="Pre-K2"
                      checked={selectedLevelForAssign === 'Pre-K2'}
                      onChange={() => setSelectedLevelForAssign('Pre-K2')}
                      className="accent-[#1E5B94]"
                    />
                    <div>
                      <div className="font-bold">PRE-K2</div>
                      <div className="text-[11px] text-dash-ink-soft">Ages 4 to 5 Years Old</div>
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
