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

    if (targetType === 'all') {
      realTeachersList.forEach((teacher) => {
        const existingIdx = newAssignmentsList.findIndex(
          (a) => a.teacherId === teacher.id && a.level === selectedLevelForAssign
        );
        if (existingIdx >= 0) {
          newAssignmentsList[existingIdx] = {
            ...newAssignmentsList[existingIdx],
            quarters: Array.from(new Set([...newAssignmentsList[existingIdx].quarters, ...selectedQuartersForAssign])),
            schoolYear,
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
    } else if (targetType === 'teacher') {
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
                            <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                              {w.week}
                            </span>
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
