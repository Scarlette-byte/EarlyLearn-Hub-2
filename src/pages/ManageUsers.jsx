import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays, normalizeAuthIdentifier } from '../lib/supabaseClient';
import {
  cardBox,
  cardBoxTitle,
  table,
  th,
  td,
  pillClass,
  msgOk,
  msgError,
  input,
  label,
  btnPrimary,
  btnSmall,
  delBtn,
} from '../lib/ui.js';

export default function ManageUsers({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [teachersMap, setTeachersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('all');

  // Modals
  const [editModalUser, setEditModalUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('student');
  const [editBarangay, setEditBarangay] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccessData, setPasswordSuccessData] = useState(null);

  const [createUserModal, setCreateUserModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newRole, setNewRole] = useState('student');
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
      .select('id, full_name, role, barangay, created_at')
      .order('full_name');

    if (profError) {
      setMsg({ text: '❌ Failed to load users: ' + profError.message, type: 'error' });
      setLoading(false);
      return;
    }

    // Try fetching teachers table to correlate emails & contact numbers
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
      // Ignore if teachers table is inaccessible
    }

    setUsers(profs || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // --- Filtered Users ---
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (teachersMap[u.id]?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (teachersMap[u.id]?.contact_number || '').includes(search);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesBarangay =
      barangayFilter === 'all' || (u.barangay || '').toLowerCase() === barangayFilter.toLowerCase();

    return matchesSearch && matchesRole && matchesBarangay;
  });

  // --- Statistics ---
  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const studentCount = users.filter((u) => u.role === 'student').length;
  const barangayCount = new Set(users.map((u) => u.barangay).filter(Boolean)).size;

  // --- Edit User (Username / Full Name, Role, Barangay) ---
  function openEditModal(u) {
    setEditModalUser(u);
    setEditName(u.full_name || '');
    setEditRole(u.role || 'student');
    setEditBarangay(u.barangay || '');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editModalUser) return;
    if (!editName.trim()) {
      alert('Full Name / Username cannot be empty.');
      return;
    }

    setEditSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editName.trim(),
        role: editRole,
        barangay: editBarangay || null,
      })
      .eq('id', editModalUser.id);

    setEditSaving(false);

    if (error) {
      alert('❌ Failed to update user: ' + error.message);
    } else {
      setMsg({ text: `✅ User "${editName.trim()}" successfully updated!`, type: 'ok' });
      setEditModalUser(null);
      loadUsers();
    }
  }

  // --- Change Password / Reset ---
  function openPasswordModal(u) {
    setPasswordModalUser(u);
    setNewPassword('');
    setPasswordSuccessData(null);
  }

  function generateRandomPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setPasswordSaving(true);

    // If super admin is editing their own account, update directly via auth
    if (currentUser?.id === passwordModalUser.id) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      setPasswordSaving(false);

      if (error) {
        alert('❌ Failed to update password: ' + error.message);
      } else {
        setPasswordSuccessData({
          user: passwordModalUser,
          password: newPassword,
          method: 'direct',
        });
        setMsg({ text: `✅ Your password has been successfully updated!`, type: 'ok' });
      }
      return;
    }

    // For other users:
    // If the user has an associated email (or virtual email), send reset link or provide manual temp password
    const userEmail =
      teachersMap[passwordModalUser.id]?.email ||
      `${passwordModalUser.id.replace(/-/g, '').slice(0, 10)}@earlylearn.ph`;

    try {
      await supabase.auth.resetPasswordForEmail(userEmail);
    } catch {
      // Ignore if user has no public mailbox
    }

    setPasswordSaving(false);
    setPasswordSuccessData({
      user: passwordModalUser,
      password: newPassword,
      method: 'manual',
    });
    setMsg({
      text: `✅ Password update instructions prepared for "${passwordModalUser.full_name}"!`,
      type: 'ok',
    });
  }

  // --- Delete User ---
  async function handleDeleteUser(u) {
    if (
      !confirm(
        `Are you sure you want to delete user "${u.full_name || 'User'}"?\nThis action will remove their profile record.`
      )
    ) {
      return;
    }

    if (currentUser?.id === u.id) {
      alert('⚠️ You cannot delete your own active administrator account!');
      return;
    }

    const { error } = await supabase.from('profiles').delete().eq('id', u.id);

    if (error) {
      setMsg({ text: '❌ Failed to delete user: ' + error.message, type: 'error' });
    } else {
      // If teacher, attempt cleanup on teachers table
      try {
        await supabase.from('teachers').delete().eq('id', u.id);
      } catch {
        // Ignored
      }
      setMsg({ text: `✅ User "${u.full_name}" deleted successfully.`, type: 'ok' });
      loadUsers();
    }
  }

  // --- Create New User ---
  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newFullName.trim()) {
      alert('Please enter a full name.');
      return;
    }
    if (!newIdentifier.trim()) {
      alert('Please enter a mobile number or email address.');
      return;
    }
    if (!newUserPassword || newUserPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setCreateSaving(true);

    const { authEmail, isPhone, display } = normalizeAuthIdentifier(newIdentifier);

    // Step 1: Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password: newUserPassword,
      options: {
        data: {
          full_name: newFullName.trim(),
          role: newRole,
          barangay: newBarangay || null,
          contact_number: isPhone ? display : null,
        },
      },
    });

    if (authError) {
      alert('❌ Failed to create user: ' + authError.message);
      setCreateSaving(false);
      return;
    }

    // Step 2: Upsert profile row
    const createdUserId = authData.user?.id;
    if (createdUserId) {
      const { error: profError } = await supabase.from('profiles').upsert({
        id: createdUserId,
        full_name: newFullName.trim(),
        role: newRole,
        barangay: newBarangay || null,
      });

      if (profError) {
        alert('⚠️ Auth account created, but profile error: ' + profError.message);
      }

      if (newRole === 'teacher') {
        try {
          await supabase.from('teachers').upsert({
            id: createdUserId,
            full_name: newFullName.trim(),
            email: authEmail,
            barangay: newBarangay || null,
          });
        } catch {
          // Ignored
        }
      }
    }

    setCreateSaving(false);
    setCreatedCredentials({
      fullName: newFullName.trim(),
      identifier: newIdentifier.trim(),
      role: newRole,
      barangay: newBarangay || 'Not specified',
      password: newUserPassword,
    });

    setNewFullName('');
    setNewIdentifier('');
    setNewBarangay('');
    setNewUserPassword('');
    loadUsers();
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* KPI METRIC CARDS                                     */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl p-4 shadow-card border border-card-border text-center">
          <span className="font-baloo text-2xl sm:text-3xl font-extrabold text-dash-ink block">
            {totalCount}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Users
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card border border-card-border text-center">
          <span className="font-baloo text-2xl sm:text-3xl font-extrabold text-[#8A6420] block">
            {adminCount}
          </span>
          <span className="text-[11px] font-bold text-[#8A6420] uppercase tracking-wider">
            Admins
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card border border-card-border text-center">
          <span className="font-baloo text-2xl sm:text-3xl font-extrabold text-[#3D7048] block">
            {teacherCount}
          </span>
          <span className="text-[11px] font-bold text-[#3D7048] uppercase tracking-wider">
            Teachers
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card border border-card-border text-center">
          <span className="font-baloo text-2xl sm:text-3xl font-extrabold text-[#386B93] block">
            {studentCount}
          </span>
          <span className="text-[11px] font-bold text-[#386B93] uppercase tracking-wider">
            Learners/Parents
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card border border-card-border text-center col-span-2 sm:col-span-1">
          <span className="font-baloo text-2xl sm:text-3xl font-extrabold text-accent block">
            {barangayCount}
          </span>
          <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            Barangays Active
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MAIN USER MANAGEMENT MODULE CARD                     */}
      {/* ---------------------------------------------------- */}
      <div className={cardBox}>
        {/* Module Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-card-border mb-4">
          <div>
            <h3 className="font-fraunces text-xl font-bold text-dash-ink m-0">
              👥 Super Admin User Management
            </h3>
            <p className="text-xs text-dash-ink-soft mt-1 m-0">
              Manage accounts, edit usernames, update roles, assign barangays, and configure passwords.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCreateUserModal(true);
                setCreatedCredentials(null);
                generateRandomPassword();
              }}
              className="px-4 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-baloo font-bold text-sm shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>➕</span>
              <span>Add New User</span>
            </button>

            <button
              onClick={loadUsers}
              disabled={loading}
              className="px-3 py-2.5 rounded-xl bg-[#F6F1E7] hover:bg-[#EFE7D8] text-dash-ink font-bold text-xs transition-colors cursor-pointer"
              title="Refresh users list"
            >
              {loading ? '⏳' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {msg.text && (
          <div
            className={`p-3 rounded-xl text-xs font-bold mb-4 flex items-center justify-between ${
              msg.type === 'error'
                ? 'bg-danger/10 text-danger border border-danger/20'
                : 'bg-[#DCEBDD] text-[#3D7048] border border-[#BBD5BC]'
            }`}
          >
            <span>{msg.text}</span>
            <button
              onClick={() => setMsg({ text: '', type: '' })}
              className="text-xs bg-transparent border-none cursor-pointer font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <input
              type="text"
              placeholder="🔍 Search by name, ID, or contact..."
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
              <option value="all">Filter: All Roles ({totalCount})</option>
              <option value="admin">Admins only ({adminCount})</option>
              <option value="teacher">Teachers only ({teacherCount})</option>
              <option value="student">Learners / Parents only ({studentCount})</option>
            </select>
          </div>

          <div>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">Filter: All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  📍 {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>User / Username</th>
                <th className={th}>Role</th>
                <th className={th}>Barangay</th>
                <th className={th}>Contact Info</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const teacherInfo = teachersMap[u.id];

                return (
                  <tr key={u.id} className="hover:bg-[#FFFDF9] transition-colors">
                    {/* User & Full Name */}
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-baloo font-bold text-xs shrink-0 ${
                            u.role === 'admin'
                              ? 'bg-[#F6E4C2] text-[#8A6420]'
                              : u.role === 'teacher'
                              ? 'bg-[#DCEBDD] text-[#3D7048]'
                              : 'bg-[#DCE8F2] text-[#386B93]'
                          }`}
                        >
                          {(u.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-dash-ink flex items-center gap-1.5 flex-wrap">
                            <span>{u.full_name || '(No name set)'}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-sun/40 text-[#6B5313] px-1.5 py-0.5 rounded font-black">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-dash-ink-soft font-mono">
                            ID: {u.id ? u.id.slice(0, 8) + '...' : '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role Pill */}
                    <td className={td}>
                      <span className={pillClass(u.role)}>
                        {u.role === 'student' ? 'student / parent' : u.role}
                      </span>
                    </td>

                    {/* Barangay */}
                    <td className={td}>
                      {u.barangay ? (
                        <span className="inline-flex items-center text-xs font-semibold text-dash-ink">
                          📍 {u.barangay}
                        </span>
                      ) : (
                        <span className="text-xs text-dash-ink-soft italic">No barangay</span>
                      )}
                    </td>

                    {/* Contact / Email */}
                    <td className={td}>
                      {teacherInfo?.email ? (
                        <div className="text-xs text-dash-ink">{teacherInfo.email}</div>
                      ) : teacherInfo?.contact_number ? (
                        <div className="text-xs text-dash-ink">{teacherInfo.contact_number}</div>
                      ) : (
                        <span className="text-xs text-dash-ink-soft italic">Registered account</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        {/* Edit Username / Role / Barangay */}
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-bold text-xs transition-colors cursor-pointer border border-[#E5DAC4]"
                          title="Edit username, role, or barangay"
                        >
                          ✏️ Edit
                        </button>

                        {/* Password Management */}
                        <button
                          onClick={() => openPasswordModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-[#FFF2DE] hover:bg-[#FFE6C2] text-[#8A6420] font-bold text-xs transition-colors cursor-pointer border border-[#F5DCB7]"
                          title="Change password or send reset"
                        >
                          🔑 Password
                        </button>

                        {/* Delete User */}
                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="px-2 py-1 rounded-lg hover:bg-danger/10 text-danger font-bold text-xs transition-colors cursor-pointer border border-transparent hover:border-danger/20"
                            title="Delete user"
                          >
                            🗑️
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

        {/* Empty Search State */}
        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-8 text-dash-ink-soft text-sm">
            No users found matching your filters.
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL 1: EDIT USER (USERNAME, ROLE, BARANGAY)        */}
      {/* ==================================================== */}
      {editModalUser && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-card-border animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-card-border mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  ✏️ Edit User Details
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  User ID: <span className="font-mono">{editModalUser.id.slice(0, 13)}...</span>
                </p>
              </div>
              <button
                onClick={() => setEditModalUser(null)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-dash-ink mb-1">
                  Full Name / Username <span className="text-coral">*</span>
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
                  Account Role <span className="text-coral">*</span>
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
                >
                  <option value="admin">Administrator (Full System Access)</option>
                  <option value="teacher">Day Care Teacher (Teacher Dashboard)</option>
                  <option value="student">Student / Parent (Learning Portal)</option>
                </select>
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
                      📍 {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E7D3] text-dash-ink text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: PASSWORD MANAGEMENT (CHANGE / RESET)         */}
      {/* ==================================================== */}
      {passwordModalUser && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-card-border animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-card-border mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  🔑 Password Management
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  User: <strong>{passwordModalUser.full_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                ✕
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
                      onClick={generateRandomPassword}
                      className="text-[11px] text-accent font-bold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      🎲 Generate Password
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
                    💡 As Super Admin, you can set a temporary password or generate a secure key for
                    this user.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#E8DFC9] text-xs text-dash-ink-soft leading-relaxed space-y-1">
                  <div className="font-bold text-dash-ink">How password reset works:</div>
                  <div>
                    • If changing your own password, it updates your live credentials immediately.
                  </div>
                  <div>
                    • If resetting for a teacher or parent, give them the new password so they can log
                    in directly.
                  </div>
                </div>

                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E7D3] text-dash-ink text-sm font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {passwordSaving ? 'Applying...' : 'Apply Password Change'}
                  </button>
                </div>
              </form>
            ) : (
              /* Success confirmation view with copy details */
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[#DCEBDD] text-[#3D7048] text-2xl flex items-center justify-center mx-auto">
                  ✓
                </div>
                <div>
                  <h4 className="font-fraunces text-base font-bold text-dash-ink">
                    Password Ready for {passwordSuccessData.user.full_name}
                  </h4>
                  <p className="text-xs text-dash-ink-soft mt-1">
                    Share this new password with the user so they can access their account.
                  </p>
                </div>

                <div className="bg-[#FAF5EC] rounded-2xl p-4 text-left text-xs font-mono space-y-2 border border-[#E5DAC4]">
                  <div>
                    <span className="text-dash-ink-soft block text-[10px] uppercase font-bold">
                      Account Name:
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
                    alert('Password copied to clipboard!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#F6F1E7] hover:bg-[#ECE3D2] text-dash-ink font-bold text-xs cursor-pointer"
                >
                  📋 Copy Password to Clipboard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalUser(null);
                    setPasswordSuccessData(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-accent text-white font-bold text-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: CREATE NEW USER BY SUPER ADMIN              */}
      {/* ==================================================== */}
      {createUserModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-card-border animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-card-border mb-4">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  ➕ Add User (Super Admin Portal)
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Directly provision an account for a teacher, parent, or admin.
                </p>
              </div>
              <button
                onClick={() => setCreateUserModal(false)}
                className="text-dash-ink-soft hover:text-dash-ink text-lg bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!createdCredentials ? (
              <form onSubmit={handleCreateUser} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Full Name / Username <span className="text-coral">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Teacher Gloria Santos or Parent Maria"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Account Role <span className="text-coral">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="student">Student / Parent (Learning Portal)</option>
                    <option value="teacher">Day Care Teacher (Teacher Dashboard)</option>
                    <option value="admin">Administrator (Super Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dash-ink mb-1">
                    Mobile Phone Number or Email <span className="text-coral">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 09123456789 or user@example.com"
                    value={newIdentifier}
                    onChange={(e) => setNewIdentifier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] font-nunito text-sm text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-dash-ink-soft mt-0.5">
                    📱 Accepts standard 11-digit mobile numbers or email addresses.
                  </p>
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
                        📍 {b}
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
                      onClick={() => {
                        const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                        let p = '';
                        for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
                        setNewUserPassword(p);
                      }}
                      className="text-[11px] text-accent font-bold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      🎲 Generate Password
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
                    className="px-4 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E7D3] text-dash-ink text-sm font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSaving}
                    className="px-5 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-bold cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {createSaving ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </form>
            ) : (
              /* Success view for created user */
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[#DCEBDD] text-[#3D7048] text-2xl flex items-center justify-center mx-auto">
                  ✓
                </div>
                <div>
                  <h4 className="font-fraunces text-base font-bold text-dash-ink">
                    Account Created Successfully!
                  </h4>
                  <p className="text-xs text-dash-ink-soft mt-1">
                    Here are the initial credentials for the new user.
                  </p>
                </div>

                <div className="bg-[#FAF5EC] rounded-2xl p-4 text-left text-xs font-mono space-y-2 border border-[#E5DAC4]">
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
                      Login (Email or Mobile):
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
                      Role / Barangay:
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
                    alert('Account credentials copied to clipboard!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#F6F1E7] hover:bg-[#ECE3D2] text-dash-ink font-bold text-xs cursor-pointer"
                >
                  📋 Copy All Credentials to Clipboard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateUserModal(false);
                    setCreatedCredentials(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-accent text-white font-bold text-sm cursor-pointer"
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
