import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays, normalizeAuthIdentifier } from '../lib/supabaseClient';
import { adminSetTeacherPassword } from '../lib/teacherAuthService.js';
import { createParentAccountByTeacher } from '../lib/learnersService.js';
import {
  cardBox,
  table,
  th,
  td,
  pillClass,
} from '../lib/ui.js';
import {
  isSuperAdminUser,
  getDbRole,
} from '../lib/roles.js';
import {
  IconPlus,
  IconRefresh,
  IconEdit,
  IconKey,
  IconTrash,
  IconDice,
  IconCopy,
  IconCheck,
  IconClose,
} from '../components/Icons.jsx';

function buildRandomPassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export default function ManageUsers({ currentUser }) {
  const isCallerSuperAdmin = isSuperAdminUser(currentUser);

  const [users, setUsers] = useState([]);
  const [teachersMap, setTeachersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('all');

  // Edit User Modal
  const [editModalUser, setEditModalUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('student');
  const [editBarangay, setEditBarangay] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Password Reset Modal
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccessData, setPasswordSuccessData] = useState(null);

  // Dedicated Superadmin "Create Admin" Modal
  const [createAdminModal, setCreateAdminModal] = useState(false);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminBarangay, setAdminBarangay] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [createdAdminCredentials, setCreatedAdminCredentials] = useState(null);

  // Add Teacher / Parent User Modal (non-admin accounts)
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newRole, setNewRole] = useState('teacher');
  const [newBarangay, setNewBarangay] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // --- Load all users & teacher data ---
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setMsg({ text: '', type: '' });

    const { data: profs, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (profError) {
      setMsg({ text: 'Failed to load users: ' + profError.message, type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const { data: teachs } = await supabase
        .from('teachers')
        .select('id, email, contact_number, cdcs(name)');
      const tMap = {};
      (teachs || []).forEach((t) => {
        tMap[t.id] = t;
      });
      setTeachersMap(tMap);
    } catch {
      // Ignored
    }

    const mappedUsers = (profs || []).map((u) => {
      const isCurrentSuperAdmin = u.id === currentUser?.id && isCallerSuperAdmin;
      const displayRole = isCurrentSuperAdmin ? 'superadmin' : (u.role || 'student');
      return {
        ...u,
        role: displayRole,
        isSuperAdmin: isCurrentSuperAdmin,
      };
    });

    setUsers(mappedUsers);
    setLoading(false);
  }, [currentUser?.id, isCallerSuperAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // --- Filtered Users ---
  const filteredUsers = users.filter((u) => {
    const rawTeachContact = String(teachersMap[u.id]?.contact_number || '').split('||')[0].trim();
    const rawProfContact = String(u.contact_number || '').split('||')[0].trim();
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (teachersMap[u.id]?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      rawTeachContact.includes(search) ||
      rawProfContact.includes(search);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesBarangay =
      barangayFilter === 'all' || (u.barangay || '').toLowerCase() === barangayFilter.toLowerCase();

    return matchesSearch && matchesRole && matchesBarangay;
  });

  // --- Statistics ---
  const totalCount = users.length;
  const superadminCount = users.filter((u) => u.role === 'superadmin').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const studentCount = users.filter((u) => u.role === 'student').length;
  const barangayCount = new Set(users.map((u) => u.barangay).filter(Boolean)).size;

  // --- Shared helper to invoke `create-admin` Edge Function ---
  async function invokeCreateAdminEdgeFunction({ fullName, identifierInput, barangay, password }) {
    if (!isCallerSuperAdmin) {
      throw new Error('Only a Municipal Superadmin can create Administrator accounts.');
    }

    const { authEmail, isPhone, display } = normalizeAuthIdentifier(identifierInput);
    if (!authEmail) {
      throw new Error('Please enter a valid email address or mobile number.');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    const { data, error } = await supabase.functions.invoke('create-admin', {
      body: {
        email: authEmail,
        password,
        full_name: fullName,
        barangay: barangay || null,
        contact_number: isPhone ? display : null,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      let detail = error.message || 'Edge Function invocation failed.';
      try {
        if (error.context && typeof error.context.json === 'function') {
          const errJson = await error.context.json();
          if (errJson?.error) detail = errJson.error;
        }
      } catch {
        // Ignore context parse failure
      }
      throw new Error(detail);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return {
      user: data?.user,
      authEmail,
      identifier: identifierInput.trim(),
    };
  }

  // --- Superadmin: Create Administrator ---
  async function handleCreateAdmin(e) {
    e.preventDefault();
    if (!isCallerSuperAdmin) {
      alert('Access Restricted: Only a Superadmin can create Administrator accounts.');
      return;
    }
    if (!adminFullName.trim()) {
      alert('Please enter the Administrator full name.');
      return;
    }
    if (!adminIdentifier.trim()) {
      alert('Please enter an email address or mobile number.');
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      alert('Initial password must be at least 6 characters long.');
      return;
    }

    setAdminSaving(true);
    try {
      const res = await invokeCreateAdminEdgeFunction({
        fullName: adminFullName.trim(),
        identifierInput: adminIdentifier.trim(),
        barangay: adminBarangay || null,
        password: adminPassword,
      });

      setCreatedAdminCredentials({
        fullName: adminFullName.trim(),
        identifier: res.identifier,
        email: res.authEmail,
        role: 'admin',
        barangay: adminBarangay || 'Municipal-wide (MSWDO)',
        password: adminPassword,
      });

      setAdminFullName('');
      setAdminIdentifier('');
      setAdminBarangay('');
      setAdminPassword('');
      setMsg({
        text: `Administrator account "${res.user?.full_name || adminFullName.trim()}" created via create-admin.`,
        type: 'ok',
      });
      loadUsers();
    } catch (err) {
      alert('Failed to create Administrator: ' + (err.message || 'Unknown error'));
    } finally {
      setAdminSaving(false);
    }
  }

  // --- Edit User ---
  function openEditModal(u) {
    setEditModalUser(u);
    setEditName(u.full_name || '');
    setEditRole(u.role === 'superadmin' ? 'admin' : (u.role || 'student'));
    setEditBarangay(u.barangay || '');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editModalUser) return;
    if (!editName.trim()) {
      alert('Full Name cannot be empty.');
      return;
    }

    if (editModalUser.isSuperAdmin && !isCallerSuperAdmin) {
      alert('Access Restricted: Only a Superadmin can edit a Superadmin profile.');
      return;
    }

    setEditSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editName.trim(),
        barangay: editBarangay || null,
      })
      .eq('id', editModalUser.id);

    setEditSaving(false);

    if (error) {
      alert('Failed to update user: ' + error.message);
    } else {
      setMsg({ text: `User "${editName.trim()}" updated successfully.`, type: 'ok' });
      setEditModalUser(null);
      loadUsers();
    }
  }

  // --- Change Password ---
  function openPasswordModal(u) {
    setPasswordModalUser(u);
    setNewPassword('');
    setPasswordSuccessData(null);
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setPasswordSaving(true);

    if (currentUser?.id === passwordModalUser.id) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      setPasswordSaving(false);

      if (error) {
        alert('Failed to update password: ' + error.message);
      } else {
        setPasswordSuccessData({
          user: passwordModalUser,
          password: newPassword,
          method: 'direct',
        });
        setMsg({ text: 'Your password has been updated successfully.', type: 'ok' });
      }
      return;
    }

    try {
      const teacherObj = {
        ...passwordModalUser,
        email: teachersMap[passwordModalUser.id]?.email || passwordModalUser.email,
        contact_number: teachersMap[passwordModalUser.id]?.contact_number || passwordModalUser.contact_number,
      };

      const result = await adminSetTeacherPassword(teacherObj, newPassword);

      setPasswordSuccessData({
        user: passwordModalUser,
        password: newPassword,
        email: result.email,
        teacherId: result.teacherId,
        method: 'manual',
      });
      setMsg({
        text: `Password credentials activated for "${passwordModalUser.full_name}".`,
        type: 'ok',
      });
      loadUsers();
    } catch (err) {
      alert('Failed to update password: ' + (err.message || 'Unknown error'));
    } finally {
      setPasswordSaving(false);
    }
  }

  // --- Delete User ---
  async function handleDeleteUser(u) {
    if (currentUser?.id === u.id) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (u.isSuperAdmin) {
      alert('Protected Account: Superadmin accounts cannot be deleted from the client UI.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete user "${u.full_name || 'User'}"?\nThis action will remove their account access.`
      )
    ) {
      return;
    }

    if (u.role === 'teacher') {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('delete-teacher', {
            body: { teacherId: u.id },
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!edgeErr && !edgeData?.error) {
            setMsg({ text: `Teacher "${u.full_name}" deleted successfully.`, type: 'ok' });
            loadUsers();
            return;
          }
        }
      } catch {
        // Fall through to profile/teacher cleanup
      }
    }

    const { error } = await supabase.from('profiles').delete().eq('id', u.id);

    if (error) {
      setMsg({ text: 'Failed to delete user: ' + error.message, type: 'error' });
    } else {
      try {
        await supabase.from('teachers').delete().eq('id', u.id);
      } catch {
        // Ignored
      }
      setMsg({ text: `User "${u.full_name}" deleted successfully.`, type: 'ok' });
      loadUsers();
    }
  }

  // --- Create Teacher or Student/Parent User (or Admin via Edge Function) ---
  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newFullName.trim()) {
      alert('Please enter a full name.');
      return;
    }
    if (!newIdentifier.trim()) {
      alert('Please enter a mobile phone number or email address.');
      return;
    }
    if (!newUserPassword || newUserPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setCreateSaving(true);
    const { authEmail, isPhone, display } = normalizeAuthIdentifier(newIdentifier);

    try {
      if (newRole === 'admin') {
        const res = await invokeCreateAdminEdgeFunction({
          fullName: newFullName.trim(),
          identifierInput: newIdentifier.trim(),
          barangay: newBarangay || null,
          password: newUserPassword,
        });

        setCreatedCredentials({
          fullName: newFullName.trim(),
          identifier: res.identifier,
          email: res.authEmail,
          role: 'admin',
          barangay: newBarangay || 'Municipal-wide (MSWDO)',
          password: newUserPassword,
        });
        setMsg({ text: `Administrator "${newFullName.trim()}" created successfully.`, type: 'ok' });
      } else if (newRole === 'teacher') {
        const teacherDraft = {
          full_name: newFullName.trim(),
          email: authEmail,
          identifier: display,
          teacher_id: display,
          barangay: newBarangay || 'Manolo Fortich',
          contact_number: isPhone ? display : null,
        };
        const res = await adminSetTeacherPassword(teacherDraft, newUserPassword);
        setCreatedCredentials({
          fullName: newFullName.trim(),
          identifier: res.teacherId || display,
          email: res.email || authEmail,
          role: 'teacher',
          barangay: newBarangay || 'Not specified',
          password: newUserPassword,
        });
        setMsg({ text: `Teacher account "${newFullName.trim()}" created successfully.`, type: 'ok' });
      } else {
        const res = await createParentAccountByTeacher({
          parentName: newParentName.trim() || 'Parent / Guardian',
          childName: newFullName.trim(),
          childAge: '3-3.11',
          identifier: newIdentifier.trim(),
          password: newUserPassword,
          barangay: newBarangay || 'Tankulan (Poblacion)',
          cdcName: newBarangay ? `${newBarangay} Child Development Center` : 'Child Development Center',
          teacherId: currentUser?.id || null,
          teacherName: currentUser?.full_name || 'MSWDO Admin',
        });
        setCreatedCredentials({
          fullName: res.credentials.childName,
          identifier: res.credentials.identifier,
          email: res.credentials.authEmail,
          role: 'student',
          barangay: newBarangay || 'Tankulan (Poblacion)',
          password: newUserPassword,
        });
        setMsg({ text: `Parent & Learner account "${newFullName.trim()}" created successfully.`, type: 'ok' });
      }

      setNewFullName('');
      setNewParentName('');
      setNewIdentifier('');
      setNewBarangay('');
      setNewUserPassword('');
      loadUsers();
    } catch (err) {
      alert('Failed to create account: ' + (err.message || err));
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* 1. KPI SUMMARY STRIP                                 */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink block">
            {totalCount}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Users
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#5A2E9E] block">
            {superadminCount}
          </span>
          <span className="text-[11px] font-bold text-[#5A2E9E] uppercase tracking-wider">
            Superadmins
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#8A6420] block">
            {adminCount}
          </span>
          <span className="text-[11px] font-bold text-[#8A6420] uppercase tracking-wider">
            Administrators
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#2E6B39] block">
            {teacherCount}
          </span>
          <span className="text-[11px] font-bold text-[#2E6B39] uppercase tracking-wider">
            Teachers
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-[#2A5E85] block">
            {studentCount}
          </span>
          <span className="text-[11px] font-bold text-[#2A5E85] uppercase tracking-wider">
            Learners / Parents
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-card-border text-center">
          <span className="font-fraunces text-2xl sm:text-3xl font-bold text-accent block">
            {barangayCount}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Active Barangays
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN USER MANAGEMENT CARD                          */}
      {/* ---------------------------------------------------- */}
      <div className={cardBox}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F5EDE0] mb-4">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              User Accounts Management
            </h3>
            <p className="text-xs text-dash-ink-soft mt-1 m-0">
              Provision MSWD Administrators, manage educator and parent accounts, and oversee municipal access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isCallerSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCreateAdminModal(true);
                  setCreatedAdminCredentials(null);
                  setAdminPassword(buildRandomPassword());
                }}
                className="px-3.5 py-2 rounded-xl bg-[#5A2E9E] hover:bg-[#472280] text-white font-nunito font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <IconPlus className="w-4 h-4" />
                <span>Create Admin</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCreateUserModal(true);
                setCreatedCredentials(null);
                setNewRole('teacher');
                setNewUserPassword(buildRandomPassword());
              }}
              className="px-3.5 py-2 rounded-xl bg-accent hover:opacity-90 text-white font-nunito font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              <span>Add Teacher / Parent</span>
            </button>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1.5"
              title="Refresh users list"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Notification */}
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

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, ID, or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">All Roles ({totalCount})</option>
              <option value="superadmin">Superadmins ({superadminCount})</option>
              <option value="admin">Administrators ({adminCount})</option>
              <option value="teacher">Teachers ({teacherCount})</option>
              <option value="student">Learners / Parents ({studentCount})</option>
            </select>
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
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className={`${table} min-w-[850px]`}>
            <thead>
              <tr>
                <th className={th}>User / Account Name</th>
                <th className={th}>Role</th>
                <th className={th}>Barangay</th>
                <th className={th}>Contact Information</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const teacherInfo = teachersMap[u.id];
                const cleanTeacherPhone = String(teacherInfo?.contact_number || '').split('||')[0].trim();
                const cleanProfilePhone = String(u.contact_number || '').split('||')[0].trim();

                return (
                  <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            u.role === 'superadmin'
                              ? 'bg-[#EDE4FF] text-[#5A2E9E]'
                              : u.role === 'admin'
                                ? 'bg-[#FAF3E6] text-[#8A6420]'
                                : u.role === 'teacher'
                                  ? 'bg-[#EDF6EE] text-[#2E6B39]'
                                  : 'bg-[#EBF4FA] text-[#2A5E85]'
                          }`}
                        >
                          {(u.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-dash-ink flex items-center gap-1.5 flex-wrap">
                            <span>{u.full_name || '(No name set)'}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-[#FAF3E6] border border-[#E5DAC4] text-[#8A6420] px-1.5 py-0.5 rounded font-bold">
                                Current User
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-dash-ink-soft font-mono">
                            ID: {u.id ? u.id.slice(0, 8) + '...' : '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={td}>
                      <span className={pillClass(u.role)}>
                        {u.role === 'student'
                          ? 'student / parent'
                          : u.role === 'superadmin'
                            ? 'Superadmin'
                            : u.role}
                      </span>
                    </td>

                    <td className={td}>
                      {u.barangay ? (
                        <span className="text-xs font-semibold text-dash-ink">{u.barangay}</span>
                      ) : (
                        <span className="text-xs text-dash-ink-soft italic">Unassigned</span>
                      )}
                    </td>

                    <td className={td}>
                      {teacherInfo?.email ? (
                        <div className="text-xs text-dash-ink">{teacherInfo.email}</div>
                      ) : cleanTeacherPhone ? (
                        <div className="text-xs text-dash-ink">{cleanTeacherPhone}</div>
                      ) : cleanProfilePhone ? (
                        <div className="text-xs text-dash-ink">{cleanProfilePhone}</div>
                      ) : (
                        <span className="text-xs text-dash-ink-soft">Registered account</span>
                      )}
                    </td>

                    <td className={`${td} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs transition-colors cursor-pointer border border-[#E5DAC4] flex items-center gap-1"
                          title="Edit user details"
                        >
                          <IconEdit className="w-3 h-3 text-dash-ink-soft" />
                          <span>Edit</span>
                        </button>

                        {(isCurrent || u.role === 'teacher') && (
                          <button
                            type="button"
                            onClick={() => openPasswordModal(u)}
                            className="px-2.5 py-1 rounded-lg bg-[#FFF7EB] hover:bg-[#FFEED4] text-[#8A6420] font-semibold text-xs transition-colors cursor-pointer border border-[#F3E2C8] flex items-center gap-1"
                            title="Change password"
                          >
                            <IconKey className="w-3 h-3 text-[#8A6420]" />
                            <span>Password</span>
                          </button>
                        )}

                        {!isCurrent && !u.isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors cursor-pointer border border-transparent hover:border-danger/20"
                            title="Delete user"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-8 text-dash-ink-soft text-sm">
            No accounts found matching your search criteria.
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: SUPERADMIN "CREATE ADMIN"                   */}
      {/* ---------------------------------------------------- */}
      {createAdminModal && isCallerSuperAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EDE4FF] text-[#5A2E9E] mb-1">
                  Superadmin Governance
                </span>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Create MSWD Administrator
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Provisions a verified Administrator via server-side <code className="font-mono">create-admin</code> with JWT <code className="font-mono">app_metadata.role = &apos;admin&apos;</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateAdminModal(false);
                  setCreatedAdminCredentials(null);
                }}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {!createdAdminCredentials ? (
              <form onSubmit={handleCreateAdmin} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Administrator Full Name <span className="text-coral">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Cristina Flores"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-[#5A2E9E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Official Email or Mobile Number <span className="text-coral">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin.mswdo@earlylearn.ph or 09171234567"
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-[#5A2E9E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Barangay / Office Assignment (Optional)
                  </label>
                  <select
                    value={adminBarangay}
                    onChange={(e) => setAdminBarangay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-[#5A2E9E] cursor-pointer"
                  >
                    <option value="">Municipal-wide (MSWDO Main Office)</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-dash-ink">
                      Initial Password <span className="text-coral">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAdminPassword(buildRandomPassword())}
                      className="text-[11px] text-[#5A2E9E] font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                    >
                      <IconDice className="w-3.5 h-3.5" />
                      <span>Generate Password</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-mono text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-[#5A2E9E]"
                  />
                </div>

                <div className="pt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setCreateAdminModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adminSaving}
                    className="px-5 py-2 rounded-xl bg-[#5A2E9E] hover:bg-[#472280] text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {adminSaving ? 'Provisioning Admin...' : 'Create Administrator'}
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
                    Administrator Provisioned
                  </h4>
                  <p className="text-xs text-dash-ink-soft mt-1">
                    Share these credentials securely with the MSWD Administrator.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] rounded-xl p-4 text-left text-xs font-mono space-y-2 border border-[#EFE7D8]">
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Full Name:
                    </span>
                    <span className="font-bold text-sm text-dash-ink">
                      {createdAdminCredentials.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Login Email / Identifier:
                    </span>
                    <span className="font-bold text-sm text-dash-ink select-all">
                      {createdAdminCredentials.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Initial Password:
                    </span>
                    <span className="font-bold text-sm text-coral select-all">
                      {createdAdminCredentials.password}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Server Role Claim:
                    </span>
                    <span className="text-[#5A2E9E] font-bold">
                      admin ({createdAdminCredentials.barangay})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const text = `EarlyLearn Hub MSWD Admin Account:\nName: ${createdAdminCredentials.fullName}\nLogin: ${createdAdminCredentials.email}\nPassword: ${createdAdminCredentials.password}`;
                    navigator.clipboard?.writeText(text);
                    alert('Administrator credentials copied to clipboard');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs cursor-pointer border border-[#E5DAC4] flex items-center justify-center gap-1.5"
                >
                  <IconCopy className="w-4 h-4" />
                  <span>Copy Credentials to Clipboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateAdminModal(false);
                    setCreatedAdminCredentials(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#5A2E9E] text-white font-bold text-sm cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: EDIT USER DETAILS                           */}
      {/* ---------------------------------------------------- */}
      {editModalUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Edit User Details
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  User ID: <span className="font-mono">{editModalUser.id.slice(0, 13)}...</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalUser(null)}
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Barangay Assignment
                </label>
                <select
                  value={editBarangay}
                  onChange={(e) => setEditBarangay(e.target.value)}
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
                  onClick={() => setEditModalUser(null)}
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
      {passwordModalUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Password Management
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Account: <strong>{passwordModalUser.full_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {!passwordSuccessData ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4 text-left">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                    <label className="text-xs font-bold text-dash-ink">
                      New Password <span className="text-dash-ink-soft font-normal">(Min. 6 chars)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewPassword(buildRandomPassword())}
                      className="text-xs text-accent font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      <IconDice className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="whitespace-nowrap">Generate Password</span>
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
                </div>

                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {passwordSaving ? 'Saving Password...' : 'Save Password'}
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
                    Password Ready for {passwordSuccessData.user.full_name}
                  </h4>
                </div>

                <div className="bg-[#FAF8F5] rounded-xl p-4 text-left text-xs font-mono space-y-2 border border-[#EFE7D8]">
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Account:
                    </span>
                    <span className="font-bold text-sm text-dash-ink">
                      {passwordSuccessData.user.full_name}
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
                    setPasswordModalUser(null);
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
      {/* MODAL 4: CREATE TEACHER / PARENT USER ACCOUNT        */}
      {/* ---------------------------------------------------- */}
      {createUserModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Add User Account
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Directly provision an educator, parent/learner, or administrator account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateUserModal(false);
                  setCreatedCredentials(null);
                }}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {!createdCredentials ? (
              <form onSubmit={handleCreateUser} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Account Role <span className="text-coral">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="teacher">Day Care Teacher (Teacher Portal)</option>
                    <option value="student">Student / Parent (Learning Portal)</option>
                    {isCallerSuperAdmin && (
                      <option value="admin">Administrator (via server create-admin)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    {newRole === 'student' ? 'Child / Learner Full Name' : 'Full Name'}{' '}
                    <span className="text-coral">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      newRole === 'student'
                        ? 'e.g. Lucas Dela Cruz'
                        : 'e.g. Teacher Gloria Santos'
                    }
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>

                {newRole === 'student' && (
                  <div>
                    <label className="block text-xs font-bold text-dash-ink mb-1">
                      Parent / Guardian Full Name <span className="text-coral">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Dela Cruz"
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Mobile Phone Number or Email <span className="text-coral">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 09123456789 or user@earlylearn.ph"
                    value={newIdentifier}
                    onChange={(e) => setNewIdentifier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Barangay Assignment
                  </label>
                  <select
                    value={newBarangay}
                    onChange={(e) => setNewBarangay(e.target.value)}
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-dash-ink">
                      Initial Password <span className="text-coral">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewUserPassword(buildRandomPassword())}
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
                    onClick={() => setCreateUserModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSaving}
                    className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {createSaving ? 'Creating Account...' : 'Create Account'}
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
                    Account Created Successfully
                  </h4>
                  <p className="text-xs text-dash-ink-soft mt-1">
                    Initial account credentials generated for this user.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] rounded-xl p-4 text-left text-xs font-mono space-y-2 border border-[#EFE7D8]">
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Full Name:
                    </span>
                    <span className="font-bold text-sm text-dash-ink">
                      {createdCredentials.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Login Identifier:
                    </span>
                    <span className="font-bold text-sm text-dash-ink select-all">
                      {createdCredentials.identifier}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Initial Password:
                    </span>
                    <span className="font-bold text-sm text-coral select-all">
                      {createdCredentials.password}
                    </span>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Role &amp; Barangay:
                    </span>
                    <span className="text-dash-ink">
                      {createdCredentials.role} • {createdCredentials.barangay}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const text = `EarlyLearn Hub Account:\nName: ${createdCredentials.fullName}\nLogin: ${createdCredentials.identifier}\nPassword: ${createdCredentials.password}`;
                    navigator.clipboard?.writeText(text);
                    alert('Credentials copied to clipboard');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-semibold text-xs cursor-pointer border border-[#E5DAC4] flex items-center justify-center gap-1.5"
                >
                  <IconCopy className="w-4 h-4" />
                  <span>Copy Credentials to Clipboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateUserModal(false);
                    setCreatedCredentials(null);
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
    </div>
  );
}
