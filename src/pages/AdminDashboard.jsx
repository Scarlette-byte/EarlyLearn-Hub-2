import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import DashboardLayout from '../components/DashboardLayout.jsx';
import AdminOverview from '../components/AdminOverview.jsx';
import ManageUsers from './ManageUsers.jsx';
import ManageTeachers from './ManageTeachers.jsx';
import ManageLearners from './ManageLearners.jsx';
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
  btnAdd,
  delBtn,
  ageTag,
} from '../lib/ui.js';
import {
  IconOverview,
  IconUsers,
  IconTeachers,
  IconLearners,
  IconCategories,
  IconMaterials,
  IconApprovals,
} from '../components/Icons.jsx';

const TABS = [
  { key: 'overview', label: 'Overview', icon: <IconOverview className="w-4 h-4" /> },
  { key: 'users', label: 'Manage Users', icon: <IconUsers className="w-4 h-4" /> },
  { key: 'teachers', label: 'Manage Teachers', icon: <IconTeachers className="w-4 h-4" /> },
  { key: 'learners', label: 'Manage Learners', icon: <IconLearners className="w-4 h-4" /> },
  { key: 'categories', label: 'Categories', icon: <IconCategories className="w-4 h-4" /> },
  { key: 'materials', label: 'Materials', icon: <IconMaterials className="w-4 h-4" /> },
  { key: 'approvals', label: 'Pending Approval', icon: <IconApprovals className="w-4 h-4" /> },
];

export default function AdminDashboard({ profile }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Users tab
  const [profiles, setProfiles] = useState([]);
  const [usersMsg, setUsersMsg] = useState({ text: '', type: '' });

  // Categories tab
  const [categories, setCategories] = useState([]);
  const [newCatIcon, setNewCatIcon] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [catMsg, setCatMsg] = useState({ text: '', type: '' });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catContents, setCatContents] = useState([]);
  const [catContentsMsg, setCatContentsMsg] = useState('');

  // Materials tab
  const [materials, setMaterials] = useState([]);

  // Approvals tab
  const [approvals, setApprovals] = useState([]);

  // Additional overview metrics
  const [teachers, setTeachers] = useState([]);
  const [learners, setLearners] = useState([]);
  const [cdcs, setCdcs] = useState([]);

  // --- Load Users ---
  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, barangay')
      .order('full_name');

    if (error || !data) {
      setUsersMsg({ text: '❌ ' + (error?.message || 'Failed to load users'), type: 'error' });
      return;
    }
    setProfiles(data);
  }, []);

  async function updateRole(id, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) setUsersMsg({ text: '❌ ' + error.message, type: 'error' });
    else {
      setUsersMsg({ text: '✅ Role updated', type: 'ok' });
      loadUsers();
    }
  }

  async function updateBarangay(id, barangay) {
    const { error } = await supabase
      .from('profiles')
      .update({ barangay: barangay || null })
      .eq('id', id);
    if (error) setUsersMsg({ text: '❌ ' + error.message, type: 'error' });
    else setUsersMsg({ text: '✅ Barangay updated', type: 'ok' });
  }

  // --- Load Categories ---
  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('created_at');
    if (!error && data) setCategories(data);
  }, []);

  async function addCategory() {
    if (!newCatIcon.trim() || !newCatName.trim()) {
      setCatMsg({ text: '⚠️ Please enter both an icon and a name', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('categories')
      .insert({ icon: newCatIcon.trim(), name: newCatName.trim() });
    if (error) {
      setCatMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setCatMsg({ text: '✅ Added!', type: 'ok' });
      setNewCatIcon('');
      setNewCatName('');
      loadCategories();
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) loadCategories();
  }

  async function showCategoryContents(category) {
    setSelectedCategory(category);
    setCatContentsMsg('');
    const { data, error } = await supabase
      .from('materials')
      .select('title, type, age_range')
      .eq('category_id', category.id)
      .order('created_at', { ascending: false });

    if (error) {
      setCatContentsMsg('❌ ' + error.message);
      setCatContents([]);
      return;
    }
    if (!data || data.length === 0) {
      setCatContentsMsg(`No materials yet in "${category.name}". Teachers will upload these.`);
      setCatContents([]);
      return;
    }
    setCatContents(data);
  }

  // --- Load Materials (monitor content) ---
  const loadMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, title, type, age_range, status, categories(name)')
      .order('created_at', { ascending: false });
    if (!error && data) setMaterials(data);
  }, []);

  async function deleteMaterial(id) {
    if (!confirm('Delete this material?')) return;
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (!error) {
      loadMaterials();
      loadApprovals();
    }
  }

  // --- Load Pending Approval list ---
  const loadApprovals = useCallback(async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, title, type, categories(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error && data) setApprovals(data);
    else setApprovals([]);
  }, []);

  async function decideApproval(id, action) {
    const { error } = await supabase.from('materials').update({ status: action }).eq('id', id);
    if (!error) {
      loadApprovals();
      loadMaterials();
    }
  }

  const loadExtraStats = useCallback(async () => {
    try {
      const [{ data: tData }, { data: lData }, { data: cData }] = await Promise.all([
        supabase.from('teachers').select('id, full_name, barangay'),
        supabase.from('learners').select('id, full_name, barangay'),
        supabase.from('cdcs').select('id, name, barangay'),
      ]);
      if (tData) setTeachers(tData);
      if (lData) setLearners(lData);
      if (cData) setCdcs(cData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadCategories();
    loadMaterials();
    loadApprovals();
    loadExtraStats();
  }, [loadUsers, loadCategories, loadMaterials, loadApprovals, loadExtraStats]);

  const statusPillKind = (s) => ({ approved: 'teacher', pending: 'admin', rejected: 'student' }[s] || 'teacher');

  return (
    <DashboardLayout
      logoSubtitle="Admin"
      tabs={TABS}
      title="Admin Dashboard"
      subtitle="Manolo Fortich, Bukidnon · EarlyLearn Hub"
      avatar={profile?.full_name ? profile.full_name.slice(0, 2).toUpperCase() : 'AD'}
      stats={
        activeTab === 'overview'
          ? null
          : [
              { label: 'Total Users', value: profiles.length || '-' },
              { label: 'Categories', value: categories.length || '-' },
              { label: 'Materials Uploaded', value: materials.length || '-' },
              { label: 'Pending Review', value: approvals.length || '0' },
            ]
      }
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <AdminOverview
          profile={profile}
          profiles={profiles}
          teachers={teachers}
          learners={learners}
          cdcs={cdcs}
          categories={categories}
          materials={materials}
          approvals={approvals}
          onTabChange={setActiveTab}
          decideApproval={decideApproval}
        />
      )}

      {/* USERS */}
      {activeTab === 'users' && <ManageUsers currentUser={profile} />}

      {/* MANAGE TEACHERS */}
      {activeTab === 'teachers' && <ManageTeachers />}

      {/* MANAGE LEARNERS */}
      {activeTab === 'learners' && <ManageLearners />}

      {/* CATEGORIES */}
      {activeTab === 'categories' && (
        <>
          <div className={cardBox}>
            <h3 className={cardBoxTitle}>Learning Categories</h3>
            <p className="text-[13px] text-[#8a7f66] -mt-2.5 mb-4">
              Select a category to inspect its learning materials.
            </p>
            <div className="flex gap-3 flex-wrap">
              {categories.map((c) => (
                <div
                  key={c.id}
                  onClick={() => showCategoryContents(c)}
                  className="bg-[#FFFDF8] border border-card-border rounded-2xl px-3.5 pt-4.5 pb-3.5 text-center w-[108px] relative cursor-pointer"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCategory(c.id);
                    }}
                    className="absolute top-1.5 right-2 cursor-pointer text-[#ccc] text-xs border-none bg-transparent hover:text-danger"
                  >
                    ✕
                  </button>
                  <div className="text-[34px]">{c.icon}</div>
                  <div className="text-[13px] font-bold mt-2 text-[#4A4030]">{c.name}</div>
                  <div className="h-[3px] w-5 bg-gold rounded mx-auto mt-1.5" />
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 mt-4 flex-wrap">
              <input
                type="text"
                placeholder="Icon (e.g. 🚗)"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className={`${input} w-[110px]`}
              />
              <input
                type="text"
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={`${input} flex-1 min-w-[160px]`}
              />
              <button onClick={addCategory} className={btnAdd}>
                + Add Category
              </button>
            </div>
            {catMsg.text && (
              <p className={catMsg.type === 'error' ? msgError : msgOk}>{catMsg.text}</p>
            )}
          </div>

          {selectedCategory && (
            <div className={cardBox}>
              <h3 className={cardBoxTitle}>
                {selectedCategory.icon} Materials in "{selectedCategory.name}"
              </h3>
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>Title</th>
                      <th className={th}>Type</th>
                      <th className={th}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catContents.map((m, i) => (
                      <tr key={i}>
                        <td className={td}>{m.title}</td>
                        <td className={td}>{m.type}</td>
                        <td className={td}>
                          <span className={ageTag}>{m.age_range || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {catContentsMsg && <p className="text-[13px] mt-3 text-dash-ink-soft">{catContentsMsg}</p>}
            </div>
          )}
        </>
      )}

      {/* MATERIALS */}
      {activeTab === 'materials' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Learning Materials (Monitor Content)</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Category</th>
                  <th className={th}>Type</th>
                  <th className={th}>Age</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.title}</td>
                    <td className={td}>{m.categories?.name || '-'}</td>
                    <td className={td}>{m.type}</td>
                    <td className={td}>
                      <span className={ageTag}>{m.age_range || '-'}</span>
                    </td>
                    <td className={td}>
                      <span className={pillClass(statusPillKind(m.status))}>{m.status || 'approved'}</span>
                    </td>
                    <td className={td}>
                      <button onClick={() => deleteMaterial(m.id)} className={delBtn}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {materials.length === 0 && (
            <p className="text-[13px] mt-3 text-dash-ink-soft">
              No materials yet. Teachers will upload these from their dashboard.
            </p>
          )}
        </div>
      )}

      {/* PENDING APPROVAL */}
      {activeTab === 'approvals' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Pending Approval</h3>
          <p className="text-[13px] text-dash-ink-soft -mt-2.5 mb-4">
            Newly uploaded materials from teachers wait here until approved. Students only see
            approved content.
          </p>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Category</th>
                  <th className={th}>Type</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.title}</td>
                    <td className={td}>{m.categories?.name || '-'}</td>
                    <td className={td}>{m.type}</td>
                    <td className={td}>
                      <button
                        onClick={() => decideApproval(m.id, 'approved')}
                        className={`${btnAdd} px-3 py-[5px] text-[11.5px] mr-1.5`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decideApproval(m.id, 'rejected')}
                        className={`${btnAdd} px-3 py-[5px] text-[11.5px] bg-danger`}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {approvals.length === 0 && (
            <p className="text-[13px] mt-3 text-dash-ink-soft">
              Nothing pending approval right now.
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}