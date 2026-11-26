import { useState, useMemo } from 'react';
import {
  barangayEnrolleesData,
  enrolleePopulationSummary,
  barangayGroupedData,
} from '../../lib/enrolleePopulationData.js';
import { barangays } from '../../lib/supabaseClient';
import Icon from '../Icons.jsx';
import { Button, Card, Modal, Badge, Tabs, StatCard, PageHeader, EmptyState } from '../ui/index.js';
import { input } from '../../lib/ui.js';

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
    <div className="space-y-5 min-w-0">
      {/* Page Title & Actions */}
      <Card accentBar className="no-print">
        <PageHeader
          className="!pb-0 !border-b-0"
          icon="landmark"
          eyebrow={`Official Municipal Baseline • As of ${enrolleePopulationSummary.asOfDate}`}
          title="Population of Enrollees in Each Barangay"
          subtitle={`Official municipal census covering all ${enrolleePopulationSummary.totalBarangays} Barangays and ${enrolleePopulationSummary.totalCdcs} Child Development Centers (CDCs) in Manolo Fortich, Bukidnon.`}
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon="printer"
              onClick={handlePrint}
              title="Print Official Enrollee Census Sheet"
            >
              Print / Export
            </Button>
          }
        />
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 no-print">
        <StatCard
          label="Total Enrollees"
          value={enrolleePopulationSummary.grandTotal.toLocaleString()}
          sublabel="22 Barangays • 62 CDCs"
          icon="users"
          tone="leaf"
        />
        <StatCard
          label="Pre-K 1 (3 – 3.11 y/o)"
          value={enrolleePopulationSummary.totalPreK1.toLocaleString()}
          sublabel="ECCD Toddler Foundation"
          icon="child"
          tone="gold"
        />
        <StatCard
          label="Pre-K 2 (4 – 4.11 y/o)"
          value={enrolleePopulationSummary.totalPreK2.toLocaleString()}
          sublabel="School Readiness Cohort"
          icon="book"
          tone="info"
        />
        <StatCard
          label="ITED (0 – 2 y/o)"
          value={enrolleePopulationSummary.totalIted.toLocaleString()}
          sublabel="Infant & Toddler Early Dev."
          icon="baby"
          tone="coral"
        />
        <StatCard
          label="5 Yrs Old (Transition)"
          value={enrolleePopulationSummary.total5YearsOld}
          sublabel="Kindergarten Prep"
          icon="star"
          tone="panel"
        />
      </div>

      {/* View Switcher & Filters */}
      <Card padding="sm" className="no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 min-w-0">
          <Tabs
            ariaLabel="Enrollee population subviews"
            activeKey={activeSubView}
            onChange={setActiveSubView}
            tabs={[
              {
                key: 'population',
                label: 'Barangay Census',
                icon: 'landmark',
                count: `${barangayEnrolleesData.length} CDCs`,
              },
              {
                key: 'roster',
                label: 'Enrolled Student Roster',
                icon: 'child',
                count: learners.length,
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="enrollee-brgy" className="text-xs font-bold text-ui-ink-secondary shrink-0">
                Barangay:
              </label>
              <select
                id="enrollee-brgy"
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className={`${input} !w-auto !py-2 !text-xs cursor-pointer`}
              >
                <option value="ALL">All 22 Barangays</option>
                {Object.keys(barangayGroupedData).map((bg) => (
                  <option key={bg} value={bg}>
                    {bg} ({barangayGroupedData[bg].totalEnrollees} enrollees)
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[210px] flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Search CDC or Barangay..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${input} !pl-9 !pr-8 !py-2 !text-xs`}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-ink-muted pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ui-ink-muted hover:text-ui-ink text-xs flex items-center justify-center bg-transparent border-none cursor-pointer"
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* SUBVIEW 1: POPULATION OF ENROLLEES IN EACH BARANGAY (MUNICIPAL CENSUS) */}
      {/* ==================================================================== */}
      {activeSubView === 'population' && (
        <div className="bg-ui-surface rounded-ui-card border border-ui-border shadow-card overflow-hidden">
          <div className="p-4 sm:px-5 bg-ui-surface-subtle border-b border-ui-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-baloo text-base sm:text-lg font-extrabold text-ui-ink">
                Initial Enrollees Table (As of June 22, 2026)
              </div>
              <div className="text-[11px] text-ui-ink-muted">
                Showing {filteredPopulation.length} Child Development Centers •{' '}
                {selectedBarangay === 'ALL'
                  ? 'All 22 Barangays'
                  : `Filtered: ${selectedBarangay}`}
              </div>
            </div>

            <Badge variant="gold" size="md">
              Total Enrollees: {populationTotals.total.toLocaleString()}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ui-ink border-collapse">
              <thead>
                <tr className="bg-ui-surface-warm/70 border-b border-ui-border text-ui-ink-secondary font-extrabold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12 border-r border-ui-border">No.</th>
                  <th className="py-3 px-4 w-44 border-r border-ui-border">Barangay</th>
                  <th className="py-3 px-4 min-w-[200px] border-r border-ui-border">Name of CDC</th>
                  <th className="py-3 px-3 text-center border-r border-ui-border bg-brand-yellow-tint/60 text-brand-yellow-deep">
                    ITED (0-2)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-ui-border bg-brand-leaf-tint/60 text-brand-leaf-deep">
                    Pre-K 1 (3-3.11)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-ui-border bg-status-info-bg/60 text-status-info">
                    Pre-K 2 (4-4.11)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-ui-border">
                    5 Yrs Old
                  </th>
                  <th className="py-3 px-3 text-center font-black border-r border-ui-border bg-ui-surface-warm">
                    CDC Total
                  </th>
                  <th className="py-3 px-4 text-center font-black bg-ui-panel text-white">
                    Barangay Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border/70">
                {filteredPopulation.map((row) => (
                  <tr
                    key={row.no}
                    className="hover:bg-brand-leaf-tint/35 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-ui-ink-muted border-r border-ui-border/70">
                      {row.no}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-ui-ink border-r border-ui-border/70 whitespace-nowrap">
                      {row.barangay}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-ui-ink border-r border-ui-border/70">
                      {row.cdcName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium border-r border-ui-border/70">
                      {row.ited}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-brand-leaf-deep border-r border-ui-border/70">
                      {row.preK1}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-status-info border-r border-ui-border/70">
                      {row.preK2}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium border-r border-ui-border/70">
                      {row.fiveYearsOld}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-extrabold bg-ui-surface-subtle border-r border-ui-border/70">
                      {row.total}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-black text-ui-ink bg-ui-surface-warm/60">
                      {row.barangayTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ui-surface-warm border-t-2 border-ui-border-strong font-black text-ui-ink text-xs">
                  <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-brand-leaf-deep font-extrabold border-r border-ui-border">
                    TOTAL (Official Municipal Baseline)
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-ui-ink border-r border-ui-border">
                    {populationTotals.ited.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-brand-leaf-deep border-r border-ui-border">
                    {populationTotals.preK1.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-status-info border-r border-ui-border">
                    {populationTotals.preK2.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-ui-ink border-r border-ui-border">
                    {populationTotals.fiveYearsOld}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-brand-leaf-deep bg-brand-leaf-tint border-r border-ui-border">
                    {populationTotals.total.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-white bg-ui-panel font-black">
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
        <div className="bg-ui-surface rounded-ui-card border border-ui-border shadow-card overflow-hidden">
          <div className="p-4 sm:px-5 bg-ui-surface-subtle border-b border-ui-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-baloo text-base sm:text-lg font-extrabold text-ui-ink">
                Enrolled Students Register
              </div>
              <div className="text-[11px] text-ui-ink-muted">
                Showing {filteredLearners.length} active registered learner(s).
              </div>
            </div>
            <Button variant="primary" size="sm" icon="plus" onClick={handleOpenAdd}>
              Enroll Student
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ui-ink border-collapse">
              <thead>
                <tr className="bg-ui-surface-warm/70 border-b border-ui-border text-ui-ink-secondary font-extrabold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Student Name &amp; Level</th>
                  <th className="py-3 px-4">Daycare Center &amp; Barangay</th>
                  <th className="py-3 px-4">Parent / Guardian &amp; Contact</th>
                  <th className="py-3 px-3 text-center">Enrollment Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border/70">
                {filteredLearners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6">
                      <EmptyState
                        icon="learners"
                        title="No student records found"
                        description="No learners match your current barangay or search filter."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredLearners.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-brand-leaf-tint/35 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-ui-ink text-sm">
                          {student.full_name}
                        </div>
                        <div className="text-[11px] text-ui-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="gold" size="xs">
                            {student.level || (student.age === 4 ? 'PRE-K 2 (4.11)' : 'PRE-K 1 (3.11)')}
                          </Badge>
                          <span>Age: {student.age} y/o</span>
                          <span>•</span>
                          <span>{student.gender}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-ui-ink">
                          {student.cdc_name || 'Maluko Child Development Center'}
                        </div>
                        <div className="text-[11px] text-ui-ink-muted">
                          Brgy. {student.barangay || 'Maluko'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-ui-ink">
                          {student.parent_name || 'Lovey Guinevere Tion'}
                          <span className="text-[11px] text-ui-ink-muted font-normal ml-1">
                            ({student.relationship || 'Mother'})
                          </span>
                        </div>
                        <div className="text-[11px] text-ui-ink-muted flex items-center gap-1 mt-0.5">
                          <Icon name="phone" size={11} />
                          <span>{student.parent_contact || '0929-320-5411'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Badge variant="success">
                          {student.enrollment_status || 'Enrolled'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Button variant="secondary" size="xs" onClick={() => setViewingLearner(student)}>
                          Details
                        </Button>
                        <Button variant="secondary" size="xs" icon="edit" onClick={() => handleOpenEdit(student)}>
                          Edit
                        </Button>
                        {onDeleteLearner && (
                          <Button
                            variant="dangerSoft"
                            size="xs"
                            onClick={() => onDeleteLearner(student.id)}
                            aria-label="Delete Record"
                            title="Delete Record"
                          >
                            <Icon name="trash" size={13} />
                          </Button>
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

      {/* MODAL: ADD / EDIT STUDENT */}
      <Modal
        open={Boolean(showAddModal || editingLearner)}
        onClose={() => {
          setShowAddModal(false);
          setEditingLearner(null);
        }}
        icon="learners"
        title={editingLearner ? 'Edit Student Record' : 'Enroll Real Student'}
        subtitle="Register authentic student details for Early Childhood Care & Development."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs text-ui-ink">
          <div>
            <label className="block font-bold text-ui-ink mb-1">
              Child&apos;s Full Name <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Maria Santos"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className={input}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-ui-ink mb-1">Birthdate</label>
              <input
                type="date"
                value={formData.birthdate}
                onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                className={`${input} !text-xs`}
              />
            </div>
            <div>
              <label className="block font-bold text-ui-ink mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className={`${input} !text-xs cursor-pointer`}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-ui-ink mb-1">Level</label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className={`${input} !text-xs cursor-pointer`}
              >
                <option value="PRE-K 1">Pre-K 1 (3-3.11)</option>
                <option value="PRE-K 2">Pre-K 2 (4-4.11)</option>
                <option value="ITED">ITED (0-2)</option>
                <option value="5 YRS OLD">5 Yrs Old</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-ui-ink mb-1">Barangay</label>
              <select
                value={formData.barangay}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                className={`${input} !text-xs cursor-pointer`}
              >
                {barangays.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-ui-ink mb-1">Child Development Center</label>
              <input
                type="text"
                required
                placeholder="e.g. Maluko Child Development Center"
                value={formData.cdc_name}
                onChange={(e) => setFormData({ ...formData, cdc_name: e.target.value })}
                className={`${input} !text-xs`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-ui-ink mb-1">Parent / Guardian Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Lovey Guinevere Tion"
                value={formData.parent_name}
                onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                className={`${input} !text-xs`}
              />
            </div>
            <div>
              <label className="block font-bold text-ui-ink mb-1">Relationship</label>
              <select
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                className={`${input} !text-xs cursor-pointer`}
              >
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Grandmother">Grandmother</option>
                <option value="Grandfather">Grandfather</option>
                <option value="Guardian">Guardian</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-ui-ink mb-1">Contact Number</label>
              <input
                type="text"
                placeholder="09XXXXXXXXX"
                value={formData.parent_contact}
                onChange={(e) => setFormData({ ...formData, parent_contact: e.target.value })}
                className={`${input} !text-xs`}
              />
            </div>
            <div>
              <label className="block font-bold text-ui-ink mb-1">Enrollment Status</label>
              <select
                value={formData.enrollment_status}
                onChange={(e) => setFormData({ ...formData, enrollment_status: e.target.value })}
                className={`${input} !text-xs cursor-pointer`}
              >
                <option value="Enrolled">Enrolled</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Waitlisted">Waitlisted</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-ui-ink mb-1">Home Address / Purok</label>
            <input
              type="text"
              placeholder="e.g. Purok 1, Maluko, Manolo Fortich"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={`${input} !text-xs`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-ui-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowAddModal(false);
                setEditingLearner(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" icon="save">
              {editingLearner ? 'Save Changes' : 'Enroll Student'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VIEW STUDENT DETAILS */}
      <Modal
        open={Boolean(viewingLearner)}
        onClose={() => setViewingLearner(null)}
        icon="child"
        title="Student Profile Information"
        maxWidth="max-w-md"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setViewingLearner(null)}>
            Close
          </Button>
        }
      >
        {viewingLearner && (
          <div className="space-y-3 text-xs text-ui-ink">
            <div className="bg-brand-leaf-tint p-3.5 rounded-xl border border-brand-leaf/30 space-y-1">
              <div className="font-baloo text-base font-extrabold text-ui-ink">
                {viewingLearner.full_name}
              </div>
              <div className="text-ui-ink-secondary">
                Level:{' '}
                <span className="font-extrabold text-brand-leaf-deep">
                  {viewingLearner.level || 'PRE-K 1 (3-3.11)'}
                </span>{' '}
                • Age: {viewingLearner.age} y/o • {viewingLearner.gender}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-ui-surface-subtle border border-ui-border">
                <div className="text-[10px] font-bold text-ui-ink-muted uppercase">Daycare Center</div>
                <div className="font-bold text-ui-ink mt-0.5">{viewingLearner.cdc_name}</div>
              </div>
              <div className="p-3 rounded-xl bg-ui-surface-subtle border border-ui-border">
                <div className="text-[10px] font-bold text-ui-ink-muted uppercase">Barangay</div>
                <div className="font-bold text-ui-ink mt-0.5">{viewingLearner.barangay}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-ui-surface-subtle border border-ui-border space-y-1">
              <div className="text-[10px] font-bold text-ui-ink-muted uppercase">
                Parent / Guardian Contact
              </div>
              <div className="font-bold text-ui-ink">
                {viewingLearner.parent_name} ({viewingLearner.relationship})
              </div>
              <div className="text-ui-ink-secondary font-mono flex items-center gap-1.5">
                <Icon name="phone" size={12} />
                <span>{viewingLearner.parent_contact}</span>
              </div>
              {viewingLearner.address && (
                <div className="text-ui-ink-secondary mt-1 flex items-center gap-1.5">
                  <Icon name="pin" size={12} />
                  <span>{viewingLearner.address}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
