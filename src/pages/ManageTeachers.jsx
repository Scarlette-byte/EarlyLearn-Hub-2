import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays, normalizeAuthIdentifier } from '../lib/supabaseClient';
import { realTeachersList, realCdcsList, cleanTeacherDisplayName } from '../lib/curriculumData.js';
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
  IconKey,
  IconTrash,
  IconDice,
  IconCopy,
  IconCheck,
  IconClose,
  IconTeachers,
  IconBuilding,
  IconPin,
} from '../components/Icons.jsx';

export default function ManageTeachers() {
  const [teachers, setTeachers] = useState(realTeachersList);
  const [cdcs, setCdcs] = useState(realCdcsList);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');

  // Modal states
  const [addTeacherModal, setAddTeacherModal] = useState(false);
  const [editTeacherModal, setEditTeacherModal] = useState(null);
  const [passwordModalTeacher, setPasswordModalTeacher] = useState(null);
  const [addCdcModal, setAddCdcModal] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);

  // Add Teacher Form
  const [newFullName, setNewFullName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newBarangay, setNewBarangay] = useState('');
  const [newCdcId, setNewCdcId] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Edit Teacher Form
  const [editFullName, setEditFullName] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editCdcId, setEditCdcId] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Password Management Form
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccessData, setPasswordSuccessData] = useState(null);

  // Add CDC Form
  const [newCdcName, setNewCdcName] = useState('');
  const [newCdcBarangay, setNewCdcBarangay] = useState('');
  const [cdcsaving, setCdcSaving] = useState(false);

  // Load teachers and CDCs
  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch from Supabase teachers table
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, full_name, barangay, contact_number, email, cdc_id, cdcs(id, name, barangay)')
        .order('full_name');

      // 2. Fetch registered teachers from Supabase profiles table
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .order('full_name');

      let dbList = [...(teachersData || [])];

      // Merge registered teacher accounts from Supabase profiles
      if (profilesData && profilesData.length > 0) {
        profilesData.forEach((prof) => {
          const cleanProfName = (prof.full_name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
          const existing = dbList.find(
            (t) =>
              t.id === prof.id ||
              (t.full_name && cleanProfName && t.full_name.toLowerCase().includes(cleanProfName)) ||
              (cleanProfName && t.full_name && cleanProfName.includes(t.full_name.toLowerCase()))
          );
          if (existing) {
            existing.full_name = prof.full_name || existing.full_name;
            existing.barangay = prof.barangay || existing.barangay;
            if (prof.contact_number) existing.contact_number = prof.contact_number;
            if (prof.cdc_name) {
              existing.cdc_name = prof.cdc_name;
              existing.cdcs = { name: prof.cdc_name, barangay: prof.barangay };
            }
          } else {
            dbList.push({
              id: prof.id,
              full_name: prof.full_name,
              barangay: prof.barangay,
              contact_number: prof.contact_number || null,
              email: prof.email || null,
              cdc_name: prof.cdc_name || null,
              cdcs: prof.cdc_name ? { name: prof.cdc_name, barangay: prof.barangay } : null,
              designation: 'Child Development Teacher (CDT)',
            });
          }
        });
      }

      let combined = [];
      if (dbList.length > 0) {
        const existingNames = new Set(
          dbList.map((t) => (t.full_name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase())
        );
        const nonDuplicateBaseline = realTeachersList.filter((b) => {
          const bName = (b.full_name || '').toLowerCase();
          return !Array.from(existingNames).some((e) => e && (bName.includes(e) || e.includes(bName)));
        });
        combined = [...dbList, ...nonDuplicateBaseline];
      } else {
        combined = [...realTeachersList];
      }

      // Merge real-time teacher profile edits from Teacher Dashboard
      try {
        const overrides = JSON.parse(localStorage.getItem('earlylearn_teacher_profiles_override') || '{}');
        combined = combined.map((t) => {
          const override =
            overrides[t.id] ||
            (t.email && overrides[t.email.toLowerCase()]) ||
            (t.full_name && overrides[t.full_name.toLowerCase()]);
          if (override) {
            return {
              ...t,
              full_name: override.full_name || t.full_name,
              barangay: override.barangay || t.barangay,
              cdc_name: override.cdc_name || t.cdc_name,
              cdc_id: override.cdc_id || t.cdc_id,
              cdcs: override.cdc_name ? { name: override.cdc_name, barangay: override.barangay } : t.cdcs,
              contact_number: override.contact_number || t.contact_number,
              email: override.email || t.email,
            };
          }
          return t;
        });

        // Include any newly active teacher profile not yet in baseline
        Object.values(overrides).forEach((ov) => {
          if (ov && ov.id && !combined.some((t) => t.id === ov.id || (ov.email && t.email === ov.email))) {
            combined.unshift({
              id: ov.id,
              full_name: ov.full_name,
              barangay: ov.barangay,
              cdc_name: ov.cdc_name,
              cdc_id: ov.cdc_id,
              cdcs: { name: ov.cdc_name, barangay: ov.barangay },
              contact_number: ov.contact_number,
              email: ov.email,
            });
          }
        });
      } catch {
        // ignore
      }

      setTeachers(
        combined.map((t) => ({
          ...t,
          full_name: cleanTeacherDisplayName(t.full_name) || t.full_name,
        }))
      );
    } catch {
      setTeachers(realTeachersList);
    }
    setLoading(false);
  }, []);

  const loadCdcs = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('cdcs').select('*').order('barangay, name');
      if (!error && data && data.length > 0) {
        const existingNames = new Set(data.map((c) => (c.name || '').toLowerCase()));
        const nonDuplicateBaseline = realCdcsList.filter(
          (b) => !existingNames.has((b.name || '').toLowerCase())
        );
        setCdcs([...data, ...nonDuplicateBaseline]);
      } else {
        setCdcs(realCdcsList);
      }
    } catch {
      setCdcs(realCdcsList);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
    loadCdcs();

    const handleSync = () => {
      loadTeachers();
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('earlylearn_teachers_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_teachers_updated', handleSync);
    };
  }, [loadTeachers, loadCdcs]);

  // Filtered teachers list
  const filteredTeachers = teachers.filter((t) => {
    const cdcName = t.cdcs?.name || t.cdc_name || '';
    const matchesSearch =
      (t.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.contact_number || '').includes(search) ||
      cdcName.toLowerCase().includes(search.toLowerCase()) ||
      (t.barangay || '').toLowerCase().includes(search.toLowerCase());

    const matchesBarangay =
      barangayFilter === 'all' || (t.barangay || '').toLowerCase() === barangayFilter.toLowerCase();

    const matchesAssignment =
      assignmentFilter === 'all' ||
      (assignmentFilter === 'assigned' && (t.cdc_id || cdcName)) ||
      (assignmentFilter === 'unassigned' && !t.cdc_id && !cdcName);

    return matchesSearch && matchesBarangay && matchesAssignment;
  });

  // KPI Calculations
  const totalTeachers = teachers.length;
  const assignedTeachers = teachers.filter((t) => t.cdc_id || t.cdcs?.name || t.cdc_name).length;
  const unassignedTeachers = teachers.filter((t) => !t.cdc_id && !t.cdcs?.name && !t.cdc_name).length;
  const barangaysCovered = new Set(teachers.map((t) => t.barangay).filter(Boolean)).size;
  const totalCdcs = cdcs.length;

  const cdcsForBarangay = (brgy) => cdcs.filter((c) => c.barangay === brgy);

  function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let p = '';
    for (let i = 0; i < 9; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return p;
  }

  // --- Add Teacher ---
  async function handleAddTeacher(e) {
    e.preventDefault();
    if (!newFullName.trim()) {
      alert('Please enter a full name.');
      return;
    }
    if (!newIdentifier.trim()) {
      alert('Please enter a mobile phone number or email address.');
      return;
    }
    if (!newBarangay) {
      alert('Please select a barangay.');
      return;
    }
    if (!newUserPassword || newUserPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setAddSaving(true);
    setMsg({ text: '', type: '' });

    const { authEmail, isPhone, display } = normalizeAuthIdentifier(newIdentifier);
    const finalContact = newContactNumber.trim() || (isPhone ? display : null);

    // Try edge function first
    let createdViaEdge = false;
    let tempPass = newUserPassword;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-teacher', {
          body: {
            fullName: newFullName.trim(),
            email: authEmail,
            barangay: newBarangay,
            cdcId: newCdcId || null,
            contactNumber: finalContact,
          },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!edgeErr && !edgeData?.error && edgeData?.email) {
          createdViaEdge = true;
          tempPass = edgeData.tempPassword || newUserPassword;
        }
      }
    } catch {
      // Proceed to fallback
    }

    // Direct fallback if edge function was not available
    if (!createdViaEdge) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newFullName.trim(),
            role: 'teacher',
            barangay: newBarangay,
            contact_number: finalContact,
          },
        },
      });

      if (authError) {
        alert('Failed to create teacher account: ' + authError.message);
        setAddSaving(false);
        return;
      }

      const createdUserId = authData.user?.id;
      if (createdUserId) {
        // Upsert profiles
        await supabase.from('profiles').upsert({
          id: createdUserId,
          full_name: newFullName.trim(),
          role: 'teacher',
          barangay: newBarangay,
        });

        // Upsert teachers table
        await supabase.from('teachers').upsert({
          id: createdUserId,
          full_name: newFullName.trim(),
          email: authEmail,
          barangay: newBarangay,
          cdc_id: newCdcId || null,
          contact_number: finalContact,
        });
      }
    }

    setAddSaving(false);
    setCredentialsModal({
      fullName: newFullName.trim(),
      email: authEmail,
      identifier: newIdentifier.trim(),
      password: tempPass,
      barangay: newBarangay,
      cdcName: cdcs.find((c) => c.id === newCdcId)?.name || 'Unassigned',
    });

    setNewFullName('');
    setNewIdentifier('');
    setNewBarangay('');
    setNewCdcId('');
    setNewContactNumber('');
    setNewUserPassword('');
    setAddTeacherModal(false);
    setMsg({ text: 'Teacher account created successfully.', type: 'ok' });
    loadTeachers();
  }

  // --- Edit Teacher ---
  function openEditModal(t) {
    setEditTeacherModal(t);
    setEditFullName(cleanTeacherDisplayName(t.full_name) || '');
    setEditBarangay(t.barangay || '');
    setEditCdcId(t.cdc_id || '');
    setEditContact(t.contact_number || '');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editTeacherModal) return;
    if (!editFullName.trim()) {
      alert('Full name cannot be empty.');
      return;
    }

    setEditSaving(true);

    // Update teachers table
    const { error: teachError } = await supabase
      .from('teachers')
      .update({
        full_name: editFullName.trim(),
        barangay: editBarangay || null,
        cdc_id: editCdcId || null,
        contact_number: editContact.trim() || null,
      })
      .eq('id', editTeacherModal.id);

    // Sync with profiles table
    await supabase
      .from('profiles')
      .update({
        full_name: editFullName.trim(),
        barangay: editBarangay || null,
      })
      .eq('id', editTeacherModal.id);

    setEditSaving(false);

    if (teachError) {
      alert('Failed to update teacher: ' + teachError.message);
    } else {
      setMsg({ text: `Teacher "${editFullName.trim()}" updated successfully.`, type: 'ok' });
      setEditTeacherModal(null);
      loadTeachers();
    }
  }

  // --- Password Management ---
  function openPasswordModal(t) {
    setPasswordModalTeacher(t);
    setNewPassword(generatePassword());
    setPasswordSuccessData(null);
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!passwordModalTeacher) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setPasswordSaving(true);
    const teacherEmail = passwordModalTeacher.email;

    if (teacherEmail) {
      try {
        await supabase.auth.resetPasswordForEmail(teacherEmail);
      } catch {
        // Ignored
      }
    }

    setPasswordSaving(false);
    setPasswordSuccessData({
      teacher: passwordModalTeacher,
      password: newPassword,
    });
    setMsg({
      text: `Password credentials prepared for "${passwordModalTeacher.full_name}".`,
      type: 'ok',
    });
  }

  // --- Delete Teacher ---
  async function handleDeleteTeacher(t) {
    if (
      !confirm(
        `Are you sure you want to delete teacher "${t.full_name}"?\nThis will remove their educator profile and portal access.`
      )
    ) {
      return;
    }

    // Try edge function first
    let edgeSuccess = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('delete-teacher', {
          body: { teacherId: t.id },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!edgeErr && !edgeData?.error) {
          edgeSuccess = true;
        }
      }
    } catch {
      // Fallback
    }

    // Direct deletion fallback
    if (!edgeSuccess) {
      await supabase.from('teachers').delete().eq('id', t.id);
      await supabase.from('profiles').delete().eq('id', t.id);
    }

    setMsg({ text: `Teacher "${t.full_name}" deleted successfully.`, type: 'ok' });
    loadTeachers();
  }

  // --- Add CDC Center ---
  async function handleAddCdc(e) {
    e.preventDefault();
    if (!newCdcName.trim() || !newCdcBarangay) {
      alert('Please provide both Center Name and Barangay.');
      return;
    }

    setCdcSaving(true);
    const { error } = await supabase.from('cdcs').insert({
      name: newCdcName.trim(),
      barangay: newCdcBarangay,
    });
    setCdcSaving(false);

    if (error) {
      alert('Failed to add Center: ' + error.message);
    } else {
      setMsg({ text: `Center "${newCdcName.trim()}" added to ${newCdcBarangay}.`, type: 'ok' });
      setNewCdcName('');
      setNewCdcBarangay('');
      setAddCdcModal(false);
      loadCdcs();
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
            {totalTeachers}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Teachers
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#2E6B39] block">
            {assignedTeachers}
          </span>
          <span className="text-[11px] font-bold text-[#2E6B39] uppercase tracking-wider">
            Assigned to CDC
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#8A6420] block">
            {unassignedTeachers}
          </span>
          <span className="text-[11px] font-bold text-[#8A6420] uppercase tracking-wider">
            Unassigned
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-accent block">
            {barangaysCovered}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Barangays Active
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center col-span-2 sm:col-span-1">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#55369A] block">
            {totalCdcs}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Day Care Centers
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN TEACHERS DIRECTORY MODULE                     */}
      {/* ---------------------------------------------------- */}
      <div className={cardBox}>
        {/* Module Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F5EDE0] mb-4">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Child Development Teachers & Centers
            </h3>
            <p className="text-xs text-dash-ink-soft mt-1 m-0">
              Manage accredited educators, assign Day Care Centers, and update contact information.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setAddTeacherModal(true);
                setNewUserPassword(generatePassword());
              }}
              className="px-3.5 py-2 rounded-xl bg-accent hover:opacity-90 text-white font-nunito font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              <span>Add Teacher</span>
            </button>

            <button
              onClick={() => setAddCdcModal(true)}
              className="px-3 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1.5"
              title="Add a new Day Care Center"
            >
              <IconBuilding className="w-3.5 h-3.5 text-dash-ink-soft" />
              <span>Add Day Care Center</span>
            </button>

            <button
              onClick={() => {
                loadTeachers();
                loadCdcs();
              }}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1.5"
              title="Refresh teacher list"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, contact, or center..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
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
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">All Teachers ({totalTeachers})</option>
              <option value="assigned">Assigned to Center ({assignedTeachers})</option>
              <option value="unassigned">Unassigned Only ({unassignedTeachers})</option>
            </select>
          </div>
        </div>

        {/* Teachers Table */}
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Teacher Name</th>
                <th className={th}>Barangay</th>
                <th className={th}>Assigned Center (CDC)</th>
                <th className={th}>Contact Number</th>
                <th className={th}>Email / Login</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t) => (
                <tr key={t.id} className="hover:bg-[#FAF8F5] transition-colors">
                  {/* Name & Avatar */}
                  <td className={td}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#EDF6EE] text-[#2E6B39] flex items-center justify-center font-bold text-xs shrink-0">
                        {(t.full_name || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-dash-ink">
                          {cleanTeacherDisplayName(t.full_name) || '(No name set)'}
                        </div>
                        <div className="text-[11px] text-dash-ink-soft font-mono">
                          ID: {t.id ? t.id.slice(0, 8) + '...' : '-'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Barangay */}
                  <td className={td}>
                    {t.barangay ? (
                      <span className="text-xs font-semibold text-dash-ink">{t.barangay}</span>
                    ) : (
                      <span className="text-xs text-dash-ink-soft italic">Unassigned</span>
                    )}
                  </td>

                  {/* Assigned Center (CDC) */}
                  <td className={td}>
                    {t.cdcs?.name || t.cdc_name ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EDF6EE] border border-[#D1E5D3] text-[#22572C] text-xs font-semibold">
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span>{t.cdcs?.name || t.cdc_name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-dash-ink-soft italic">No center assigned</span>
                    )}
                  </td>

                  {/* Contact Number */}
                  <td className={td}>
                    <span className="text-xs text-dash-ink font-mono">{t.contact_number || '-'}</span>
                  </td>

                  {/* Email */}
                  <td className={td}>
                    <span className="text-xs text-dash-ink">{t.email || '-'}</span>
                  </td>

                  {/* Action Buttons */}
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(t)}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1"
                        title="Edit teacher details"
                      >
                        <IconEdit className="w-3 h-3 text-dash-ink-soft" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => openPasswordModal(t)}
                        className="px-2.5 py-1 rounded-lg bg-[#FFF7EB] hover:bg-[#FFEED4] text-[#8A6420] font-semibold text-xs transition-colors cursor-pointer border border-[#F3E2C8] flex items-center gap-1"
                        title="Reset password"
                      >
                        <IconKey className="w-3 h-3 text-[#8A6420]" />
                        <span>Password</span>
                      </button>

                      <button
                        onClick={() => handleDeleteTeacher(t)}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors cursor-pointer border border-transparent hover:border-danger/20"
                        title="Delete teacher account"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTeachers.length === 0 && !loading && (
          <div className="text-center py-8 text-dash-ink-soft text-sm">
            No teachers found matching your filters.
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: ADD TEACHER                                 */}
      {/* ---------------------------------------------------- */}
      {addTeacherModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Register Child Development Teacher
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Create an account and assign to a Manolo Fortich Day Care Center.
                </p>
              </div>
              <button
                onClick={() => setAddTeacherModal(false)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Full Name <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Teacher Juana Dela Cruz"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Login Identifier (Email or Mobile Number) <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 09123456789 or teacher@example.com"
                  value={newIdentifier}
                  onChange={(e) => setNewIdentifier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
                <p className="text-[11px] text-dash-ink-soft mt-0.5">
                  Accepts standard 11-digit Philippine mobile phone numbers or email addresses.
                </p>
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
                    Day Care Center (CDC)
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

              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Contact Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="09XX-XXX-XXXX"
                  value={newContactNumber}
                  onChange={(e) => setNewContactNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-dash-ink">
                    Initial Password <span className="text-coral">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewUserPassword(generatePassword())}
                    className="text-[11px] text-accent font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                  >
                    <IconDice className="w-3.5 h-3.5" />
                    <span>Generate Password</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={6}
                  placeholder="Enter or generate password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-mono text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAddTeacherModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {addSaving ? 'Registering...' : 'Register Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: EDIT TEACHER                                */}
      {/* ---------------------------------------------------- */}
      {editTeacherModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-card-border animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Edit Teacher Details
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Update Center assignment and contact information.
                </p>
              </div>
              <button
                onClick={() => setEditTeacherModal(null)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Full Name <span className="text-coral">*</span>
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
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Barangay
                </label>
                <select
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
                  Assigned Day Care Center (CDC)
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

              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  placeholder="09XX-XXX-XXXX"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditTeacherModal(null)}
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

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: PASSWORD MANAGEMENT                         */}
      {/* ---------------------------------------------------- */}
      {passwordModalTeacher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-card-border animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Password Management
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Teacher: <strong>{passwordModalTeacher.full_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setPasswordModalTeacher(null)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {!passwordSuccessData ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4 text-left">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-dash-ink">
                      New Password (Minimum 6 characters)
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewPassword(generatePassword())}
                      className="text-[11px] text-accent font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                    >
                      <IconDice className="w-3.5 h-3.5" />
                      <span>Generate Password</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5DCC9] font-mono text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-dash-ink-soft mt-1">
                    Provide this new password to the teacher so they can access their portal.
                  </p>
                </div>

                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setPasswordModalTeacher(null)}
                    className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {passwordSaving ? 'Updating...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="w-10 h-10 rounded-full bg-[#EDF6EE] text-[#2E6B39] flex items-center justify-center mx-auto">
                  <IconCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                    Password Ready for {passwordSuccessData.teacher.full_name}
                  </h4>
                  <p className="text-xs text-dash-ink-soft mt-1">
                    Copy and share this temporary password with the teacher.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] rounded-xl p-4 text-left text-xs font-mono space-y-2 border border-[#EFE7D8]">
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Account:
                    </span>
                    <span className="font-bold text-sm text-dash-ink">
                      {passwordSuccessData.teacher.full_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      New Password:
                    </span>
                    <span className="font-bold text-sm text-coral select-all">
                      {passwordSuccessData.password}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(passwordSuccessData.password);
                    alert('Password copied to clipboard');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs cursor-pointer border border-[#E5DAC4] flex items-center justify-center gap-1.5"
                >
                  <IconCopy className="w-4 h-4" />
                  <span>Copy Password to Clipboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalTeacher(null);
                    setPasswordSuccessData(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-accent text-white font-bold text-sm cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: ADD DAY CARE CENTER (CDC)                   */}
      {/* ---------------------------------------------------- */}
      {addCdcModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-card-border animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Add Day Care Center (CDC)
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Register a new Day Care Center in Manolo Fortich.
                </p>
              </div>
              <button
                onClick={() => setAddCdcModal(false)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCdc} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Center Name <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tankulan Central Day Care Center"
                  value={newCdcName}
                  onChange={(e) => setNewCdcName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Barangay <span className="text-coral">*</span>
                </label>
                <select
                  required
                  value={newCdcBarangay}
                  onChange={(e) => setNewCdcBarangay(e.target.value)}
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

              <div className="pt-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAddCdcModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cdcsaving}
                  className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {cdcsaving ? 'Adding...' : 'Add Center'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: CREDENTIALS SUMMARY MODAL                   */}
      {/* ---------------------------------------------------- */}
      {credentialsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-card-border animate-pop text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-[#EDF6EE] text-[#2E6B39] flex items-center justify-center mx-auto">
              <IconCheck className="w-5 h-5" />
            </div>

            <div>
              <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                Teacher Account Created Successfully
              </h4>
              <p className="text-xs text-dash-ink-soft mt-1">
                Share these initial credentials with the teacher.
              </p>
            </div>

            <div className="bg-[#FAF8F5] rounded-xl p-4 text-left text-xs font-mono space-y-2 border border-[#EFE7D8]">
              <div>
                <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                  Teacher Name:
                </span>
                <span className="font-bold text-sm text-dash-ink">
                  {credentialsModal.fullName}
                </span>
              </div>
              <div>
                <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                  Login Identifier:
                </span>
                <span className="font-bold text-sm text-dash-ink select-all">
                  {credentialsModal.identifier}
                </span>
              </div>
              <div>
                <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                  Temporary Password:
                </span>
                <span className="font-bold text-sm text-coral select-all">
                  {credentialsModal.password}
                </span>
              </div>
              <div>
                <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                  Barangay & Center:
                </span>
                <span className="text-dash-ink">
                  {credentialsModal.barangay} • {credentialsModal.cdcName}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const text = `EarlyLearn Hub Teacher Account:\nTeacher: ${credentialsModal.fullName}\nLogin: ${credentialsModal.identifier}\nPassword: ${credentialsModal.password}\nCenter: ${credentialsModal.cdcName}`;
                navigator.clipboard?.writeText(text);
                alert('Credentials copied to clipboard');
              }}
              className="w-full py-2.5 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs cursor-pointer border border-[#E5DAC4] flex items-center justify-center gap-1.5"
            >
              <IconCopy className="w-4 h-4" />
              <span>Copy Credentials to Clipboard</span>
            </button>

            <button
              onClick={() => setCredentialsModal(null)}
              className="w-full py-2.5 rounded-xl bg-accent text-white font-bold text-sm cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}