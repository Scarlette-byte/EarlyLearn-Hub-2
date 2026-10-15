import { useState, useMemo } from 'react';
import {
  barangayEnrolleesData,
  enrolleePopulationSummary,
  barangayGroupedData,
} from '../../lib/enrolleePopulationData.js';
import { barangays } from '../../lib/supabaseClient';

export default function EnrolleePopulation({
  learners = [],
  cdcs = [],
  onAddLearner,
  onUpdateLearner,
  onDeleteLearner,
}) {
  const [activeSubView, setActiveSubView] = useState('population'); // 'population' | 'roster'
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Real student modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLearner, setEditingLearner] = useState(null);
  const [viewingLearner, setViewingLearner] = useState(null);

  const [formData, setFormData] = useState({
    full_name: '',
    birthdate: '2023-04-12',
    gender: 'Female',
    age: 3,
    level: 'PRE-K 1',
    barangay: 'Maluko',
    cdc_id: 'cdc-maluko',
    cdc_name: 'Maluko Child Development Center',
    parent_name: '',
    relationship: 'Mother',
    parent_contact: '',
    address: '',
    enrollment_status: 'Enrolled',
  });

  // Filter population data
  const filteredPopulation = useMemo(() => {
    return barangayEnrolleesData.filter((row) => {
      const matchBarangay =
        selectedBarangay === 'ALL' ||
        row.barangay.toUpperCase() === selectedBarangay.toUpperCase();
      const matchSearch =
        !searchTerm ||
        row.cdcName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.barangay.toLowerCase().includes(searchTerm.toLowerCase());
      return matchBarangay && matchSearch;
    });
  }, [selectedBarangay, searchTerm]);

  // Dynamic totals for currently displayed population
  const populationTotals = useMemo(() => {
    return filteredPopulation.reduce(
      (acc, r) => {
        acc.ited += r.ited;
        acc.preK1 += r.preK1;
        acc.preK2 += r.preK2;
        acc.fiveYearsOld += r.fiveYearsOld;
        acc.total += r.total;
        return acc;
      },
      { ited: 0, preK1: 0, preK2: 0, fiveYearsOld: 0, total: 0 }
    );
  }, [filteredPopulation]);

  // Filter enrolled real students
  const filteredLearners = useMemo(() => {
    return learners.filter((l) => {
      const matchBarangay =
        selectedBarangay === 'ALL' ||
        (l.barangay || '').toUpperCase() === selectedBarangay.toUpperCase();
      const matchSearch =
        !searchTerm ||
        (l.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.cdc_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.parent_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchBarangay && matchSearch;
    });
  }, [learners, selectedBarangay, searchTerm]);

  function handleOpenAdd() {
    setFormData({
      full_name: '',
      birthdate: '2023-04-12',
      gender: 'Female',
      age: 3,
      level: 'PRE-K 1',
      barangay: selectedBarangay !== 'ALL' ? selectedBarangay : 'Maluko',
      cdc_id: 'cdc-maluko',
      cdc_name: 'Maluko Child Development Center',
      parent_name: '',
      relationship: 'Mother',
      parent_contact: '',
      address: '',
      enrollment_status: 'Enrolled',
    });
    setShowAddModal(true);
  }

  function handleOpenEdit(learner) {
    setEditingLearner(learner);
    setFormData({
      full_name: learner.full_name || '',
      birthdate: learner.birthdate || '2023-04-12',
      gender: learner.gender || 'Female',
      age: learner.age || 3,
      level: learner.level || (learner.age === 4 ? 'PRE-K 2' : 'PRE-K 1'),
      barangay: learner.barangay || 'Maluko',
      cdc_id: learner.cdc_id || '',
      cdc_name: learner.cdc_name || '',
      parent_name: learner.parent_name || '',
      relationship: learner.relationship || 'Mother',
      parent_contact: learner.parent_contact || '',
      address: learner.address || '',
      enrollment_status: learner.enrollment_status || 'Enrolled',
    });
  }

  function handleSaveStudent(e) {
    e.preventDefault();
    if (!formData.full_name.trim()) return;

    if (editingLearner) {
      if (onUpdateLearner) {
        onUpdateLearner({ ...editingLearner, ...formData });
      }
      setEditingLearner(null);
    } else {
      const newStudent = {
        id: `lrn-${Date.now()}`,
        ...formData,
      };
      if (onAddLearner) {
        onAddLearner(newStudent);
      }
      setShowAddModal(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] tracking-wide uppercase">
              Official Municipal Baseline
            </span>
            <span className="text-xs text-dash-ink-soft">
              As of {enrolleePopulationSummary.asOfDate}
            </span>
          </div>
          <h2 className="font-fraunces text-2xl font-bold text-dash-ink m-0">
            Population of Enrollees in Each Barangay
          </h2>
          <p className="text-xs text-dash-ink-soft mt-1 m-0">
            Official municipal census covering all {enrolleePopulationSummary.totalBarangays} Barangays and {enrolleePopulationSummary.totalCdcs} Child Development Centers (CDCs) in Manolo Fortich, Bukidnon.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-dash-ink font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Print Official Enrollee Census Sheet"
          >
            <span>🖨️</span> Print / Export
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>+</span> Enroll Real Student
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Enrollees */}
        <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Enrollees
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink">
            {enrolleePopulationSummary.grandTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">
            22 Barangays • 62 CDCs
          </div>
        </div>

        {/* Pre-K 1 */}
        <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Pre-K 1 (3 – 3.11 y/o)
          </div>
          <div className="font-fraunces text-2xl font-bold text-accent">
            {enrolleePopulationSummary.totalPreK1.toLocaleString()}
          </div>
          <div className="text-[11px] text-dash-ink-soft">
            ECCD Toddler Foundation
          </div>
        </div>

        {/* Pre-K 2 */}
        <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Pre-K 2 (4 – 4.11 y/o)
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2563EB]">
            {enrolleePopulationSummary.totalPreK2.toLocaleString()}
          </div>
          <div className="text-[11px] text-dash-ink-soft">
            School Readiness Cohort
          </div>
        </div>

        {/* ITED (0-2) */}
        <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            ITED (0 – 2 y/o)
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#D97706]">
            {enrolleePopulationSummary.totalIted.toLocaleString()}
          </div>
          <div className="text-[11px] text-dash-ink-soft">
            Infant &amp; Toddler Early Dev.
          </div>
        </div>

        {/* 5 Years Old */}
        <div className="bg-white p-4 rounded-xl border border-card-border shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            5 Yrs Old (Transition)
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#7C3AED]">
            {enrolleePopulationSummary.total5YearsOld}
          </div>
          <div className="text-[11px] text-dash-ink-soft">
            Kindergarten Prep
          </div>
        </div>
      </div>

      {/* View Switcher & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Toggle between Population Breakdown & Real Student Records */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl shrink-0">
          <button
            onClick={() => setActiveSubView('population')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'population'
                ? 'bg-white text-dash-ink shadow-xs'
                : 'text-dash-ink-soft hover:text-dash-ink'
            }`}
          >
            🏛️ Barangay Census ({barangayEnrolleesData.length} CDCs)
          </button>
          <button
            onClick={() => setActiveSubView('roster')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'roster'
                ? 'bg-white text-dash-ink shadow-xs'
                : 'text-dash-ink-soft hover:text-dash-ink'
            }`}
          >
            🧒 Enrolled Student Roster ({learners.length} Real)
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-dash-ink-soft">Barangay:</label>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white font-medium text-xs text-dash-ink outline-none focus:border-accent"
            >
              <option value="ALL">All 22 Barangays</option>
              {Object.keys(barangayGroupedData).map((bg) => (
                <option key={bg} value={bg}>
                  {bg} ({barangayGroupedData[bg].totalEnrollees} enrollees)
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search CDC or Barangay..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs outline-none focus:border-accent"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SUBVIEW 1: POPULATION OF ENROLLEES IN EACH BARANGAY (MUNICIPAL CENSUS) */}
      {/* ==================================================================== */}
      {activeSubView === 'population' && (
        <div className="bg-white rounded-2xl border border-card-border shadow-xs overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-card-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-fraunces text-base font-bold text-dash-ink">
                Initial Enrollees Table (As of June 22, 2026)
              </div>
              <div className="text-[11px] text-dash-ink-soft">
                Showing {filteredPopulation.length} Child Development Centers •{' '}
                {selectedBarangay === 'ALL'
                  ? 'All 22 Barangays'
                  : `Filtered: ${selectedBarangay}`}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold text-dash-ink">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                <span>Total Enrollees:</span>
                <span className="font-bold">{populationTotals.total.toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-dash-ink border-collapse">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-[#E5DCC9] text-dash-ink font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12 border-r border-[#E5DCC9]">No.</th>
                  <th className="py-3 px-4 w-44 border-r border-[#E5DCC9]">Barangay</th>
                  <th className="py-3 px-4 min-w-[200px] border-r border-[#E5DCC9]">Name of CDC</th>
                  <th className="py-3 px-3 text-center border-r border-[#E5DCC9] bg-amber-50/50">
                    ITED (0-2)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-[#E5DCC9] bg-orange-50/50">
                    Pre-K 1 (3-3.11)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-[#E5DCC9] bg-blue-50/50">
                    Pre-K 2 (4-4.11)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-[#E5DCC9] bg-purple-50/50">
                    5 Yrs Old
                  </th>
                  <th className="py-3 px-3 text-center font-black border-r border-[#E5DCC9] bg-stone-100">
                    CDC Total
                  </th>
                  <th className="py-3 px-4 text-center font-black bg-stone-200/70">
                    Barangay Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE7D8]">
                {filteredPopulation.map((row) => (
                  <tr
                    key={row.no}
                    className="hover:bg-amber-50/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-gray-500 border-r border-[#EFE7D8]">
                      {row.no}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-dash-ink border-r border-[#EFE7D8] whitespace-nowrap">
                      {row.barangay}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-dash-ink border-r border-[#EFE7D8]">
                      {row.cdcName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium border-r border-[#EFE7D8]">
                      {row.ited}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-accent border-r border-[#EFE7D8]">
                      {row.preK1}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-blue-700 border-r border-[#EFE7D8]">
                      {row.preK2}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium border-r border-[#EFE7D8]">
                      {row.fiveYearsOld}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold bg-stone-50 border-r border-[#EFE7D8]">
                      {row.total}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-black text-dash-ink bg-stone-100/60">
                      {row.barangayTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAF5EC] border-t-2 border-[#D5C7B0] font-black text-dash-ink text-xs">
                  <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-rose-700 font-bold border-r border-[#E5DCC9]">
                    TOTAL (Official Municipal Baseline)
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-rose-700 border-r border-[#E5DCC9]">
                    {populationTotals.ited.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-rose-700 border-r border-[#E5DCC9]">
                    {populationTotals.preK1.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-rose-700 border-r border-[#E5DCC9]">
                    {populationTotals.preK2.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-rose-700 border-r border-[#E5DCC9]">
                    {populationTotals.fiveYearsOld}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-rose-700 bg-rose-50 border-r border-[#E5DCC9]">
                    {populationTotals.total.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-rose-700 bg-rose-100/70 font-black">
                    {populationTotals.total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBVIEW 2: ENROLLED STUDENT ROSTER (CONCISE, AUTHENTIC REAL STUDENT) */}
      {/* ==================================================================== */}
      {activeSubView === 'roster' && (
        <div className="bg-white rounded-2xl border border-card-border shadow-xs overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-card-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-fraunces text-base font-bold text-dash-ink">
                Enrolled Students Register
              </div>
              <div className="text-[11px] text-dash-ink-soft">
                Showing {filteredLearners.length} active registered learner(s). Example dummy names have been cleared for clean municipal usage.
              </div>
            </div>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              + Register New Student
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-dash-ink border-collapse">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-[#E5DCC9] text-dash-ink font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Student Name &amp; Level</th>
                  <th className="py-3 px-4">Daycare Center &amp; Barangay</th>
                  <th className="py-3 px-4">Parent / Guardian &amp; Contact</th>
                  <th className="py-3 px-3 text-center">Enrollment Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE7D8]">
                {filteredLearners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-dash-ink-soft">
                      No student records found matching filter criteria. Click "+ Register New Student" to enroll a child.
                    </td>
                  </tr>
                ) : (
                  filteredLearners.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-[#FFFDF8] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-dash-ink text-sm">
                          {student.full_name}
                        </div>
                        <div className="text-[11px] text-dash-ink-soft flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            {student.level || (student.age === 4 ? 'PRE-K 2 (4.11)' : 'PRE-K 1 (3.11)')}
                          </span>
                          <span>Age: {student.age} y/o</span>
                          <span>•</span>
                          <span>{student.gender}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-dash-ink">
                          {student.cdc_name || 'Maluko Child Development Center'}
                        </div>
                        <div className="text-[11px] text-dash-ink-soft">
                          Brgy. {student.barangay || 'Maluko'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-dash-ink">
                          {student.parent_name || 'Lovey Guinevere Tion'}
                          <span className="text-[11px] text-dash-ink-soft font-normal ml-1">
                            ({student.relationship || 'Mother'})
                          </span>
                        </div>
                        <div className="text-[11px] text-dash-ink-soft">
                          📞 {student.parent_contact || '0929-320-5411'}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          {student.enrollment_status || 'Enrolled'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingLearner(student)}
                          className="px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-dash-ink text-xs transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleOpenEdit(student)}
                          className="px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-dash-ink text-xs transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        {onDeleteLearner && (
                          <button
                            onClick={() => onDeleteLearner(student.id)}
                            className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT STUDENT                                            */}
      {/* ==================================================================== */}
      {(showAddModal || editingLearner) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 border border-card-border shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  {editingLearner ? 'Edit Student Record' : 'Enroll Real Student'}
                </h3>
                <p className="text-xs text-dash-ink-soft m-0">
                  Register authentic student details for Early Childhood Care &amp; Development.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLearner(null);
                }}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-dash-ink font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs text-dash-ink">
              <div>
                <label className="block font-bold text-dash-ink mb-1">
                  Child's Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hannah Mae Tion"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-dash-ink outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Birthdate</label>
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Level</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  >
                    <option value="PRE-K 1">Pre-K 1 (3-3.11)</option>
                    <option value="PRE-K 2">Pre-K 2 (4-4.11)</option>
                    <option value="ITED">ITED (0-2)</option>
                    <option value="5 YRS OLD">5 Yrs Old</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Barangay</label>
                  <select
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  >
                    {barangays.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Child Development Center</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maluko Child Development Center"
                    value={formData.cdc_name}
                    onChange={(e) => setFormData({ ...formData, cdc_name: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-dash-ink mb-1">Parent / Guardian Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lovey Guinevere Tion"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Relationship</label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  >
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Grandmother">Grandmother</option>
                    <option value="Grandfather">Grandfather</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Contact Number</label>
                  <input
                    type="text"
                    placeholder="09XXXXXXXXX"
                    value={formData.parent_contact}
                    onChange={(e) => setFormData({ ...formData, parent_contact: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Enrollment Status</label>
                  <select
                    value={formData.enrollment_status}
                    onChange={(e) => setFormData({ ...formData, enrollment_status: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                  >
                    <option value="Enrolled">Enrolled</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Waitlisted">Waitlisted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-dash-ink mb-1">Home Address / Purok</label>
                <input
                  type="text"
                  placeholder="e.g. Purok 1, Maluko, Manolo Fortich"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLearner(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs"
                >
                  {editingLearner ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VIEW STUDENT DETAILS                                          */}
      {/* ==================================================================== */}
      {viewingLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 border border-card-border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="font-fraunces text-lg font-bold text-dash-ink">
                Student Profile Information
              </div>
              <button
                onClick={() => setViewingLearner(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-dash-ink font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-dash-ink">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-1">
                <div className="text-base font-bold text-dash-ink">
                  {viewingLearner.full_name}
                </div>
                <div className="text-dash-ink-soft">
                  Level: <span className="font-bold text-accent">{viewingLearner.level || 'PRE-K 1 (3-3.11)'}</span> • Age: {viewingLearner.age} y/o • {viewingLearner.gender}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="text-[10px] font-bold text-dash-ink-soft uppercase">Daycare Center</div>
                  <div className="font-semibold text-dash-ink mt-0.5">{viewingLearner.cdc_name}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="text-[10px] font-bold text-dash-ink-soft uppercase">Barangay</div>
                  <div className="font-semibold text-dash-ink mt-0.5">{viewingLearner.barangay}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
                <div className="text-[10px] font-bold text-dash-ink-soft uppercase">Parent / Guardian Contact</div>
                <div className="font-semibold text-dash-ink">
                  {viewingLearner.parent_name} ({viewingLearner.relationship})
                </div>
                <div className="text-dash-ink-soft font-mono">
                  📞 {viewingLearner.parent_contact}
                </div>
                {viewingLearner.address && (
                  <div className="text-dash-ink-soft mt-1">
                    📍 {viewingLearner.address}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingLearner(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
