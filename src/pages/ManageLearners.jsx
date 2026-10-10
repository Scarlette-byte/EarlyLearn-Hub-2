import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import {
  cardBox,
  table,
  th,
  td,
} from '../lib/ui.js';
import {
  IconSearch,
  IconPlus,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconClose,
  IconLearners,
  IconBuilding,
  IconCalendar,
} from '../components/Icons.jsx';

// Helper to compute learner's current age
function calculateAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function ManageLearners() {
  const [learners, setLearners] = useState([]);
  const [cdcs, setCdcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [cdcFilter, setCdcFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');

  // Modals
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [editModalLearner, setEditModalLearner] = useState(null);

  // Enroll Form
  const [newFullName, setNewFullName] = useState('');
  const [newBirthdate, setNewBirthdate] = useState('');
  const [newBarangay, setNewBarangay] = useState('');
  const [newCdcId, setNewCdcId] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newParentContact, setNewParentContact] = useState('');
  const [enrollSaving, setEnrollSaving] = useState(false);

  // Edit Form
  const [editFullName, setEditFullName] = useState('');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editCdcId, setEditCdcId] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editParentContact, setEditParentContact] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Load learners and CDCs
  const loadLearners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('learners')
      .select('id, full_name, birthdate, barangay, cdc_id, parent_name, parent_contact, cdcs(id, name, barangay)')
      .order('full_name');

    if (error) {
      setMsg({ text: 'Failed to load learners: ' + error.message, type: 'error' });
    } else {
      setLearners(data || []);
    }
    setLoading(false);
  }, []);

  const loadCdcs = useCallback(async () => {
    const { data } = await supabase.from('cdcs').select('*').order('barangay, name');
    setCdcs(data || []);
  }, []);

  useEffect(() => {
    loadLearners();
    loadCdcs();
  }, [loadLearners, loadCdcs]);

  // Dynamic CDCs for a selected barangay
  const cdcsForBarangay = (brgy) => cdcs.filter((c) => c.barangay === brgy);

  // Filtered learners
  const filteredLearners = learners.filter((l) => {
    const age = calculateAge(l.birthdate);
    const matchesSearch =
      (l.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.parent_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.parent_contact || '').includes(search) ||
      (l.cdcs?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.barangay || '').toLowerCase().includes(search.toLowerCase());

    const matchesBarangay =
      barangayFilter === 'all' || (l.barangay || '').toLowerCase() === barangayFilter.toLowerCase();

    const matchesCdc =
      cdcFilter === 'all' || String(l.cdc_id) === cdcFilter || l.cdcs?.name === cdcFilter;

    const matchesAge =
      ageFilter === 'all' ||
      (ageFilter === '3' && age === 3) ||
      (ageFilter === '4' && age === 4) ||
      (ageFilter === 'other' && age !== 3 && age !== 4);

    return matchesSearch && matchesBarangay && matchesCdc && matchesAge;
  });

  // KPI Calculations
  const totalLearners = learners.length;
  const aged3Count = learners.filter((l) => calculateAge(l.birthdate) === 3).length;
  const aged4Count = learners.filter((l) => calculateAge(l.birthdate) === 4).length;
  const assignedToCdc = learners.filter((l) => l.cdc_id || l.cdcs?.name).length;
  const barangaysCovered = new Set(learners.map((l) => l.barangay).filter(Boolean)).size;

  // --- Enroll Learner ---
  async function handleEnrollLearner(e) {
    e.preventDefault();
    if (!newFullName.trim()) {
      alert('Please enter child full name.');
      return;
    }
    if (!newBarangay) {
      alert('Please select a barangay.');
      return;
    }

    setEnrollSaving(true);
    setMsg({ text: '', type: '' });

    const { error } = await supabase.from('learners').insert({
      full_name: newFullName.trim(),
      birthdate: newBirthdate || null,
      barangay: newBarangay,
      cdc_id: newCdcId || null,
      parent_name: newParentName.trim() || null,
      parent_contact: newParentContact.trim() || null,
    });

    setEnrollSaving(false);

    if (error) {
      alert('Failed to enroll learner: ' + error.message);
    } else {
      setMsg({ text: `Learner "${newFullName.trim()}" enrolled successfully.`, type: 'ok' });
      setNewFullName('');
      setNewBirthdate('');
      setNewBarangay('');
      setNewCdcId('');
      setNewParentName('');
      setNewParentContact('');
      setEnrollModalOpen(false);
      loadLearners();
    }
  }

  // --- Edit Learner ---
  function openEditModal(learner) {
    setEditModalLearner(learner);
    setEditFullName(learner.full_name || '');
    setEditBirthdate(learner.birthdate || '');
    setEditBarangay(learner.barangay || '');
    setEditCdcId(learner.cdc_id || '');
    setEditParentName(learner.parent_name || '');
    setEditParentContact(learner.parent_contact || '');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editModalLearner) return;
    if (!editFullName.trim()) {
      alert('Full name cannot be empty.');
      return;
    }
    if (!editBarangay) {
      alert('Please select a barangay.');
      return;
    }

    setEditSaving(true);
    const { error } = await supabase
      .from('learners')
      .update({
        full_name: editFullName.trim(),
        birthdate: editBirthdate || null,
        barangay: editBarangay,
        cdc_id: editCdcId || null,
        parent_name: editParentName.trim() || null,
        parent_contact: editParentContact.trim() || null,
      })
      .eq('id', editModalLearner.id);

    setEditSaving(false);

    if (error) {
      alert('Failed to update learner: ' + error.message);
    } else {
      setMsg({ text: `Learner "${editFullName.trim()}" updated successfully.`, type: 'ok' });
      setEditModalLearner(null);
      loadLearners();
    }
  }

  // --- Delete Learner ---
  async function handleDeleteLearner(l) {
    if (
      !confirm(
        `Are you sure you want to delete enrollment record for "${l.full_name}"?\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    const { error } = await supabase.from('learners').delete().eq('id', l.id);

    if (error) {
      setMsg({ text: 'Failed to delete learner: ' + error.message, type: 'error' });
    } else {
      setMsg({ text: `Learner "${l.full_name}" deleted successfully.`, type: 'ok' });
      loadLearners();
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* 1. KPI SUMMARY METRICS                               */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink block">
            {totalLearners}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Enrolled
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#2A5E85] block">
            {aged3Count}
          </span>
          <span className="text-[11px] font-bold text-[#2A5E85] uppercase tracking-wider">
            Aged 3 Learners
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#2E6B39] block">
            {aged4Count}
          </span>
          <span className="text-[11px] font-bold text-[#2E6B39] uppercase tracking-wider">
            Aged 4 Learners
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#8A6420] block">
            {assignedToCdc}
          </span>
          <span className="text-[11px] font-bold text-[#8A6420] uppercase tracking-wider">
            Assigned to Center
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center col-span-2 sm:col-span-1">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-accent block">
            {barangaysCovered}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Barangays Active
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN LEARNERS DIRECTORY CARD                      */}
      {/* ---------------------------------------------------- */}
      <div className={cardBox}>
        {/* Module Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F5EDE0] mb-4">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Day Care Learners Registry
            </h3>
            <p className="text-xs text-dash-ink-soft mt-1 m-0">
              Manage enrolled children aged 3–4, linked parent/guardian contacts, and Day Care Center assignments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEnrollModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-accent hover:opacity-90 text-white font-nunito font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              <span>Enroll New Learner</span>
            </button>

            <button
              onClick={() => {
                loadLearners();
                loadCdcs();
              }}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1.5"
              title="Refresh learners list"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {msg.text && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold mb-4 flex items-center justify-between ${
              msg.type === 'error'
                ? 'bg-danger/10 text-danger border border-danger/20'
                : 'bg-[#EDF6EE] text-[#2E6B39] border border-[#C8DEC9]'
            }`}
          >
            <span>{msg.text}</span>
            <button
              onClick={() => setMsg({ text: '', type: '' })}
              className="text-xs bg-transparent border-none cursor-pointer font-bold ml-2"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by learner, parent, or center..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={barangayFilter}
              onChange={(e) => {
                setBarangayFilter(e.target.value);
                setCdcFilter('all');
              }}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={cdcFilter}
              onChange={(e) => setCdcFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">All Centers (CDC)</option>
              {(barangayFilter === 'all' ? cdcs : cdcsForBarangay(barangayFilter)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">All Age Groups</option>
              <option value="3">3 Years Old ({aged3Count})</option>
              <option value="4">4 Years Old ({aged4Count})</option>
              <option value="other">Other Ages</option>
            </select>
          </div>
        </div>

        {/* Learners Table */}
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Learner Name</th>
                <th className={th}>Age & Birthdate</th>
                <th className={th}>Barangay</th>
                <th className={th}>Day Care Center (CDC)</th>
                <th className={th}>Parent / Guardian</th>
                <th className={th}>Contact Number</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLearners.map((l) => {
                const age = calculateAge(l.birthdate);

                return (
                  <tr key={l.id} className="hover:bg-[#FAF8F5] transition-colors">
                    {/* Learner Name & Avatar */}
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#EBF4FA] text-[#2A5E85] flex items-center justify-center font-bold text-xs shrink-0">
                          {(l.full_name || 'L').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-dash-ink">
                            {l.full_name || '(No name set)'}
                          </div>
                          <div className="text-[11px] text-dash-ink-soft font-mono">
                            ID: {l.id ? l.id.slice(0, 8) + '...' : '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Age & Birthdate */}
                    <td className={td}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {age !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              age === 3
                                ? 'bg-[#EBF4FA] text-[#2A5E85] border border-[#CADFF0]'
                                : age === 4
                                ? 'bg-[#EDF6EE] text-[#2E6B39] border border-[#C8DEC9]'
                                : 'bg-[#FAF5EC] text-dash-ink-soft border border-[#E5DAC4]'
                            }`}
                          >
                            {age} yrs old
                          </span>
                        ) : (
                          <span className="text-xs text-dash-ink-soft italic">No birthdate</span>
                        )}
                        {l.birthdate && (
                          <span className="text-[11px] text-dash-ink-soft font-mono block">
                            {l.birthdate}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Barangay */}
                    <td className={td}>
                      {l.barangay ? (
                        <span className="text-xs font-semibold text-dash-ink">{l.barangay}</span>
                      ) : (
                        <span className="text-xs text-dash-ink-soft italic">Unassigned</span>
                      )}
                    </td>

                    {/* Assigned Day Care Center */}
                    <td className={td}>
                      {l.cdcs?.name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EDF6EE] border border-[#D1E5D3] text-[#22572C] text-xs font-semibold">
                          <IconBuilding className="w-3.5 h-3.5" />
                          <span>{l.cdcs.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-dash-ink-soft italic">No center assigned</span>
                      )}
                    </td>

                    {/* Parent Name */}
                    <td className={td}>
                      <span className="text-xs font-semibold text-dash-ink">
                        {l.parent_name || '-'}
                      </span>
                    </td>

                    {/* Contact Number */}
                    <td className={td}>
                      <span className="text-xs text-dash-ink font-mono">
                        {l.parent_contact || '-'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(l)}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1"
                          title="Edit learner details"
                        >
                          <IconEdit className="w-3 h-3 text-dash-ink-soft" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDeleteLearner(l)}
                          className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors cursor-pointer border border-transparent hover:border-danger/20"
                          title="Delete enrollment record"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLearners.length === 0 && !loading && (
          <div className="text-center py-8 text-dash-ink-soft text-sm">
            No enrolled learners found matching your search criteria.
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: ENROLL LEARNER                              */}
      {/* ---------------------------------------------------- */}
      {enrollModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Enroll Early Learner
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Register a child aged 3–4 into the Manolo Fortich Day Care program.
                </p>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEnrollLearner} className="space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Child Full Name <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Dela Cruz Jr."
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-dash-ink">
                    Birthdate (Ages 3–4)
                  </label>
                  {newBirthdate && calculateAge(newBirthdate) !== null && (
                    <span className="text-[11px] font-bold text-[#2A5E85]">
                      Age: {calculateAge(newBirthdate)} years old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={newBirthdate}
                  onChange={(e) => setNewBirthdate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Barangay <span className="text-coral">*</span>
                  </label>
                  <select
                    required
                    value={newBarangay}
                    onChange={(e) => {
                      setNewBarangay(e.target.value);
                      setNewCdcId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">— select barangay —</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Assigned Day Care Center (CDC)
                  </label>
                  <select
                    value={newCdcId}
                    onChange={(e) => setNewCdcId(e.target.value)}
                    disabled={!newBarangay}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer disabled:opacity-50"
                  >
                    <option value="">— select center —</option>
                    {cdcsForBarangay(newBarangay).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Parent / Guardian Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maria Dela Cruz"
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Parent Contact Number
                  </label>
                  <input
                    type="text"
                    placeholder="09XX-XXX-XXXX"
                    value={newParentContact}
                    onChange={(e) => setNewParentContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSaving}
                  className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {enrollSaving ? 'Enrolling...' : 'Enroll Learner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: EDIT LEARNER                                */}
      {/* ---------------------------------------------------- */}
      {editModalLearner && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Edit Learner Details
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Update child enrollment record and guardian information.
                </p>
              </div>
              <button
                onClick={() => setEditModalLearner(null)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Child Full Name <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-dash-ink">
                    Birthdate
                  </label>
                  {editBirthdate && calculateAge(editBirthdate) !== null && (
                    <span className="text-[11px] font-bold text-[#2A5E85]">
                      Age: {calculateAge(editBirthdate)} years old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={editBirthdate}
                  onChange={(e) => setEditBirthdate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Barangay <span className="text-coral">*</span>
                  </label>
                  <select
                    required
                    value={editBarangay}
                    onChange={(e) => {
                      setEditBarangay(e.target.value);
                      setEditCdcId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">— select barangay —</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Day Care Center (CDC)
                  </label>
                  <select
                    value={editCdcId}
                    onChange={(e) => setEditCdcId(e.target.value)}
                    disabled={!editBarangay}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer disabled:opacity-50"
                  >
                    <option value="">— select center —</option>
                    {cdcsForBarangay(editBarangay).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Parent / Guardian Full Name
                  </label>
                  <input
                    type="text"
                    value={editParentName}
                    onChange={(e) => setEditParentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Parent Contact Number
                  </label>
                  <input
                    type="text"
                    value={editParentContact}
                    onChange={(e) => setEditParentContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditModalLearner(null)}
                  className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}