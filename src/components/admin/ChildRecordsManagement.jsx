import { useState } from 'react';
import { barangays } from '../../lib/supabaseClient';

export default function ChildRecordsManagement({
  learners = [],
  cdcs = [],
  onAddLearner,
  onUpdateLearner,
  onDeleteLearner,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedCdc, setSelectedCdc] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedAge, setSelectedAge] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLearner, setEditingLearner] = useState(null);
  const [viewingLearner, setViewingLearner] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    birthdate: '2023-03-15',
    gender: 'Female',
    age: 3,
    barangay: 'Tankulan (Poblacion)',
    cdc_id: '',
    cdc_name: '',
    parent_name: '',
    relationship: 'Mother',
    parent_contact: '',
    address: '',
    enrollment_status: 'Pending Verification',
  });

  // Calculate age from birthdate if available
  function calculateAge(bday) {
    if (!bday) return 3;
    const diff = Date.now() - new Date(bday).getTime();
    const ageDate = new Date(diff);
    const calculated = Math.abs(ageDate.getUTCFullYear() - 1970);
    return calculated >= 3 && calculated <= 4 ? calculated : 3;
  }

  // Filter learners
  const filteredLearners = learners.filter((l) => {
    const matchesSearch =
      l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.cdcs?.name || l.cdc_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBarangay = !selectedBarangay || l.barangay === selectedBarangay;
    const matchesCdc =
      !selectedCdc ||
      l.cdc_id === selectedCdc ||
      (l.cdcs?.name || l.cdc_name) === selectedCdc;

    const currentStatus = l.enrollment_status || 'Enrolled';
    const matchesStatus = !selectedStatus || currentStatus === selectedStatus;

    const childAge = l.age || calculateAge(l.birthdate);
    const matchesAge = !selectedAge || childAge.toString() === selectedAge;

    return matchesSearch && matchesBarangay && matchesCdc && matchesStatus && matchesAge;
  });

  // Stats
  const totalCount = learners.length;
  const verifiedCount = learners.filter(
    (l) => (l.enrollment_status || 'Enrolled') === 'Enrolled'
  ).length;
  const pendingCount = learners.filter(
    (l) => l.enrollment_status === 'Pending Verification'
  ).length;
  const waitlistCount = learners.filter(
    (l) => l.enrollment_status === 'Waitlisted'
  ).length;

  function handleOpenAdd() {
    setFormData({
      full_name: '',
      birthdate: '2023-04-10',
      gender: 'Female',
      age: 3,
      barangay: selectedBarangay || 'Tankulan (Poblacion)',
      cdc_id: '',
      cdc_name: '',
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
      birthdate: learner.birthdate || '2023-04-10',
      gender: learner.gender || 'Female',
      age: learner.age || calculateAge(learner.birthdate),
      barangay: learner.barangay || 'Tankulan (Poblacion)',
      cdc_id: learner.cdc_id || '',
      cdc_name: learner.cdcs?.name || learner.cdc_name || '',
      parent_name: learner.parent_name || '',
      relationship: learner.relationship || 'Mother',
      parent_contact: learner.parent_contact || '',
      address: learner.address || '',
      enrollment_status: learner.enrollment_status || 'Enrolled',
    });
  }

  function handleSaveForm(e) {
    e.preventDefault();
    if (!formData.full_name.trim()) return;

    if (editingLearner) {
      onUpdateLearner(editingLearner.id, formData);
      setEditingLearner(null);
    } else {
      onAddLearner(formData);
      setShowAddModal(false);
    }
  }

  function getStatusBadge(status = 'Enrolled') {
    switch (status) {
      case 'Enrolled':
        return 'bg-[#DCEBDD] text-[#2E6B38] border border-[#BDE0C0]';
      case 'Pending Verification':
        return 'bg-[#FFF3D6] text-[#8C6200] border border-[#F5DC9A]';
      case 'Waitlisted':
        return 'bg-[#E0EFFE] text-[#1E5B94] border border-[#BDDAFC]';
      case 'Inactive':
        return 'bg-[#EAE5DE] text-[#63584B] border border-[#D5CCC1]';
      default:
        return 'bg-[#DCEBDD] text-[#2E6B38] border border-[#BDE0C0]';
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Child Records
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Pre-K 1 &amp; Pre-K 2 (3.11 – 4.11 y/o)</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Verified & Enrolled
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {verifiedCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Attending local CDCs</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
            Pending Verification
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {pendingCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Requires MSWD review</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#1E5B94] uppercase tracking-wider">
            Waitlisted
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#1E5B94] mt-1">
            {waitlistCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Awaiting CDC slots</div>
        </div>
      </div>

      {/* Action Header & Search Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Child Records Management
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Verify enrollment, manage guardian details, and assign daycare centers across Manolo Fortich.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <span>+ Enroll New Child</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search by child, guardian, or daycare center..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Statuses</option>
              <option value="Enrolled">Enrolled</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Waitlisted">Waitlisted</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <select
              value={selectedAge}
              onChange={(e) => setSelectedAge(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Ages (3–4)</option>
              <option value="3">Age 3 Years Old</option>
              <option value="4">Age 4 Years Old</option>
            </select>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase tracking-wider">
                <th className="px-4 py-3">Child Name & Age</th>
                <th className="px-4 py-3">Daycare Center & Barangay</th>
                <th className="px-4 py-3">Guardian & Contact</th>
                <th className="px-4 py-3 text-center">Enrollment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F1E7] text-xs text-dash-ink">
              {filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dash-ink-soft">
                    No child records found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredLearners.map((learner) => {
                  const age = learner.age || calculateAge(learner.birthdate);
                  const status = learner.enrollment_status || 'Enrolled';
                  const cdcDisplayName =
                    learner.cdcs?.name || learner.cdc_name || 'Unassigned CDC';

                  return (
                    <tr key={learner.id} className="hover:bg-[#FFFDF9] transition-colors">
                      {/* Name & Age */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#FFE4D6] text-accent flex items-center justify-center font-bold text-xs shrink-0">
                            {learner.full_name?.charAt(0) || 'C'}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-dash-ink">
                              {learner.full_name}
                            </div>
                            <div className="text-[11px] text-dash-ink-soft flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-[#FAF5EC] font-semibold text-[#8C6D1F]">
                                Age {age} y/o
                              </span>
                              <span>• {learner.gender || 'Child'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Daycare Center & Barangay */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-dash-ink">
                          {cdcDisplayName}
                        </div>
                        <div className="text-[11px] text-dash-ink-soft">
                          Brgy. {learner.barangay || 'Not specified'}
                        </div>
                      </td>

                      {/* Guardian & Contact */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-dash-ink">
                          {learner.parent_name || 'No guardian listed'}
                        </div>
                        <div className="text-[11px] text-dash-ink-soft">
                          {learner.parent_contact || 'No phone'} •{' '}
                          {learner.relationship || 'Guardian'}
                        </div>
                      </td>

                      {/* Enrollment Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold ${getStatusBadge(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {status === 'Pending Verification' && (
                            <button
                              onClick={() =>
                                onUpdateLearner(learner.id, {
                                  enrollment_status: 'Enrolled',
                                })
                              }
                              title="Verify & Enroll"
                              className="px-2 py-1 rounded-lg bg-[#DCEBDD] text-[#2E6B38] font-bold text-[11px] hover:bg-[#C9E2CB]"
                            >
                              Verify ✓
                            </button>
                          )}
                          <button
                            onClick={() => setViewingLearner(learner)}
                            className="px-2 py-1 rounded-lg bg-[#F3ECE0] text-dash-ink font-bold text-[11px] hover:bg-[#EAE0D0]"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleOpenEdit(learner)}
                            className="px-2 py-1 rounded-lg bg-[#F3ECE0] text-dash-ink font-bold text-[11px] hover:bg-[#EAE0D0]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete record for ${learner.full_name}? This cannot be undone.`
                                )
                              ) {
                                onDeleteLearner(learner.id);
                              }
                            }}
                            className="px-2 py-1 rounded-lg text-danger hover:bg-[#FBEBE8] font-bold text-[11px]"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW PROFILE MODAL */}
      {viewingLearner && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-5 animate-pop">
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 tracking-wider">
                  MSWD Official Child Profile (Pre-K 1 &amp; 2: 3.11 – 4.11 y/o)
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {viewingLearner.full_name}
                </h3>
              </div>
              <button
                onClick={() => setViewingLearner(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC]"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FAF5EC]">
                <div className="text-[11px] text-dash-ink-soft">Age & Gender</div>
                <div className="font-bold text-dash-ink mt-0.5">
                  Age {viewingLearner.age || calculateAge(viewingLearner.birthdate)} y/o •{' '}
                  {viewingLearner.gender || 'Female'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC]">
                <div className="text-[11px] text-dash-ink-soft">Birthdate</div>
                <div className="font-bold text-dash-ink mt-0.5">
                  {viewingLearner.birthdate || 'Not specified'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC]">
                <div className="text-[11px] text-dash-ink-soft">Barangay Location</div>
                <div className="font-bold text-dash-ink mt-0.5">
                  {viewingLearner.barangay}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC]">
                <div className="text-[11px] text-dash-ink-soft">Assigned CDC</div>
                <div className="font-bold text-dash-ink mt-0.5">
                  {viewingLearner.cdcs?.name || viewingLearner.cdc_name || 'Unassigned'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] col-span-2">
                <div className="text-[11px] text-dash-ink-soft">Guardian Information</div>
                <div className="font-bold text-dash-ink mt-0.5">
                  {viewingLearner.parent_name} ({viewingLearner.relationship || 'Guardian'})
                </div>
                <div className="text-dash-ink-soft mt-0.5">
                  Contact: {viewingLearner.parent_contact || 'None'} • Address:{' '}
                  {viewingLearner.address || 'Barangay ' + viewingLearner.barangay}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-dash-ink-soft">Enrollment Status</div>
                  <div className="font-bold text-dash-ink mt-0.5">
                    {viewingLearner.enrollment_status || 'Enrolled'}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(
                    viewingLearner.enrollment_status || 'Enrolled'
                  )}`}
                >
                  {viewingLearner.enrollment_status || 'Enrolled'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
              <button
                onClick={() => {
                  const learner = viewingLearner;
                  setViewingLearner(null);
                  handleOpenEdit(learner);
                }}
                className="px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs"
              >
                Edit Profile
              </button>
              <button
                onClick={() => setViewingLearner(null)}
                className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {(showAddModal || editingLearner) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="font-fraunces text-lg font-bold text-dash-ink">
                {editingLearner ? 'Update Child Record' : 'Enroll New Child (Pre-K 1 & 2: 3.11 – 4.11 y/o)'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLearner(null);
                }}
                className="w-7 h-7 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs text-dash-ink">
              <div>
                <label className="block font-bold text-dash-ink mb-1">Child's Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Birthdate</label>
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) => {
                      const bday = e.target.value;
                      const calculated = calculateAge(bday);
                      setFormData({ ...formData, birthdate: bday, age: calculated });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-bold text-dash-ink mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Barangay *</label>
                  <select
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-dash-ink mb-1">Assigned CDC Center</label>
                  <select
                    value={formData.cdc_name || formData.cdc_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, cdc_name: val, cdc_id: val });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="">— Select CDC —</option>
                    {cdcs
                      .filter((c) => !formData.barangay || c.barangay === formData.barangay)
                      .map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    {cdcs.length === 0 && (
                      <option value="Tankulan Central CDC">Tankulan Central CDC</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Parent/Guardian Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Elena Santos"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-bold text-dash-ink mb-1">Contact Number</label>
                  <input
                    type="text"
                    placeholder="09XX-XXX-XXXX"
                    value={formData.parent_contact}
                    onChange={(e) => setFormData({ ...formData, parent_contact: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-dash-ink mb-1">Enrollment Status</label>
                <select
                  value={formData.enrollment_status}
                  onChange={(e) =>
                    setFormData({ ...formData, enrollment_status: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                >
                  <option value="Enrolled">Enrolled (Verified)</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Waitlisted">Waitlisted</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLearner(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-accent text-white font-bold text-xs shadow-xs hover:bg-[#B5673C]"
                >
                  {editingLearner ? 'Save Changes' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
