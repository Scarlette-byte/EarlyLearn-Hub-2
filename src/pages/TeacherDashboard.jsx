import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import DashboardLayout from '../components/DashboardLayout.jsx';
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
  ageTag,
} from '../lib/ui.js';

const TABS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'assignments', label: 'My Assignments', icon: '📌' },
  { key: 'mylearners', label: 'My Learners', icon: '🧒' },
  { key: 'upload', label: 'Upload Materials', icon: '⬆️' },
  { key: 'announcements', label: 'Announcements', icon: '📢' },
  { key: 'submissions', label: 'Check Submissions', icon: '📝' },
  { key: 'progress', label: 'Student Progress', icon: '📈' },
  { key: 'profile', label: 'My Profile', icon: '🙍' },
];

export default function TeacherDashboard({ profile }) {
  const currentUserId = profile.id;
  const [activeTab, setActiveTab] = useState('overview');

  // Upload tab
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [matCategory, setMatCategory] = useState('');
  const [matType, setMatType] = useState('video');
  const [matTitle, setMatTitle] = useState('');
  const [matAge, setMatAge] = useState('K1 (3.0-3.11)');
  const [matUrl, setMatUrl] = useState('');
  const [matText, setMatText] = useState('');
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const [myMaterials, setMyMaterials] = useState([]);

  // Curriculum linking (optional)
  const [curriculumEntries, setCurriculumEntries] = useState([]);
  const [matCurriculumId, setMatCurriculumId] = useState('');

  // My Assignments tab
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [lockedAssignment, setLockedAssignment] = useState(null);

  // Announcements tab
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annStatusMsg, setAnnStatusMsg] = useState({ text: '', type: '' });
  const [announcements, setAnnouncements] = useState([]);

  // Submissions tab
  const [submissions, setSubmissions] = useState([]);

  // Progress tab
  const [progressRows, setProgressRows] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);

  // Profile tab
  const [myBarangay, setMyBarangay] = useState('');
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  // My Learners tab — auto-filtered by this teacher's assigned CDC
  const [myCdcName, setMyCdcName] = useState(null);
  const [myCdcId, setMyCdcId] = useState(null);
  const [myLearners, setMyLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(true);
  const [lFullName, setLFullName] = useState('');
  const [lBirthdate, setLBirthdate] = useState('');
  const [lParentName, setLParentName] = useState('');
  const [lParentContact, setLParentContact] = useState('');
  const [learnerMsg, setLearnerMsg] = useState({ text: '', type: '' });
  const [savingLearner, setSavingLearner] = useState(false);

  // Parent account generation
  const [parentGenLoading, setParentGenLoading] = useState(null); // holds learner id currently generating
  const [newParentCreds, setNewParentCreds] = useState(null); // { learnerName, loginEmail, tempPassword }

  // --- My Assignments: curriculum entries admin has assigned to me ---
  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    const { data } = await supabase
      .from('curriculum_assignments')
      .select(
        'id, curriculum_guide_id, material_id, curriculum_guide(level, quarter, theme, week, sub_theme), materials(status)'
      )
      .eq('teacher_id', currentUserId)
      .order('created_at', { ascending: false });
    setAssignments(data || []);
    setAssignmentsLoading(false);
  }, [currentUserId]);

  function assignmentStatus(a) {
    if (!a.material_id || !a.materials) {
      return { text: 'Not started', cls: 'bg-[#F6E4C2] text-[#8A6420]' };
    }
    const s = a.materials.status;
    if (s === 'approved') return { text: '✅ Approved', cls: 'bg-[#DCEBDD] text-[#3D7048]' };
    if (s === 'rejected')
      return { text: '❌ Rejected — needs reupload', cls: 'bg-[#F6D6D0] text-[#9A3B2B]' };
    return { text: 'Uploaded — waiting approval', cls: 'bg-[#F6E4C2] text-[#8A6420]' };
  }

  function startAssignmentUpload(a) {
    setLockedAssignment(a);
    setMatCurriculumId(a.curriculum_guide_id);
    setMatAge(a.curriculum_guide?.level === 'K2' ? 'K2 (4.0-4.11)' : 'K1 (3.0-3.11)');
    setMatType('activity');
    setMatTitle('');
    setMatUrl('');
    setMatText('');
    setUploadMsg({ text: '', type: '' });
    setActiveTab('upload');
  }

  function cancelLockedUpload() {
    setLockedAssignment(null);
    setMatCurriculumId('');
    setActiveTab('assignments');
  }

  // --- Load categories into the dropdown ---
  const loadCategoryOptions = useCallback(async () => {
    const { data } = await supabase.from('categories').select('id, name, icon').order('name');
    setCategoryOptions(data || []);
    if (data && data.length && !matCategory) setMatCategory(data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load curriculum entries that match the selected age level (K1 or K2)
  const loadCurriculumEntries = useCallback(async (ageValue) => {
    const level = ageValue.startsWith('K1') ? 'K1' : 'K2';
    const { data } = await supabase
      .from('curriculum_guide')
      .select('id, quarter, theme, week, sub_theme')
      .eq('level', level)
      .order('quarter')
      .order('week');
    setCurriculumEntries(data || []);
  }, []);

  // --- Load my uploaded materials ---
  const loadMyMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, title, type, age_range, status, categories(name)')
      .eq('created_by', currentUserId)
      .order('created_at', { ascending: false });
    if (!error && data) setMyMaterials(data);
  }, [currentUserId]);

  async function handleUpload() {
    if (!matTitle.trim()) {
      setUploadMsg({ text: '⚠️ Please enter a title', type: 'error' });
      return;
    }
    if (!lockedAssignment && !matCategory) {
      setUploadMsg({ text: '⚠️ Please select a category', type: 'error' });
      return;
    }

    const { data: inserted, error } = await supabase
      .from('materials')
      .insert({
        category_id: lockedAssignment ? null : matCategory,
        type: matType,
        title: matTitle.trim(),
        age_range: matAge,
        content_url: matUrl.trim() || null,
        content_text: matText.trim() || null,
        created_by: currentUserId,
        curriculum_guide_id: matCurriculumId || null,
        // Curriculum-assigned uploads are auto-approved (Admin already vetted the
        // topic by assigning it); free-form uploads still go through review.
        status: lockedAssignment ? 'approved' : 'pending',
      })
      .select()
      .single();

    if (error) {
      setUploadMsg({ text: '❌ ' + error.message, type: 'error' });
      return;
    }

    if (lockedAssignment) {
      await supabase
        .from('curriculum_assignments')
        .update({ material_id: inserted.id })
        .eq('id', lockedAssignment.id);
      setUploadMsg({ text: '✅ Uploaded and linked to your assignment!', type: 'ok' });
      setLockedAssignment(null);
      setMatCurriculumId('');
      loadAssignments();
      setActiveTab('assignments');
    } else {
      setUploadMsg({ text: '✅ Uploaded!', type: 'ok' });
    }

    setMatTitle('');
    setMatUrl('');
    setMatText('');
    loadMyMaterials();
  }

  async function deleteMyMaterial(id) {
    if (!confirm('Delete this?')) return;
    await supabase.from('materials').delete().eq('id', id);
    loadMyMaterials();
  }

  // --- Announcements ---
  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data);
  }, []);

  async function postAnnouncement() {
    if (!annTitle.trim() || !annMessage.trim()) {
      setAnnStatusMsg({ text: '⚠️ Please enter a title and message', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('announcements')
      .insert({ title: annTitle.trim(), message: annMessage.trim(), created_by: currentUserId });
    if (error) {
      setAnnStatusMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setAnnStatusMsg({ text: '✅ Announcement posted!', type: 'ok' });
      setAnnTitle('');
      setAnnMessage('');
      loadAnnouncements();
    }
  }

  async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  }

  // --- Submissions ---
  const loadSubmissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select('id, answer_text, status, profiles(full_name), materials(title)')
      .order('created_at', { ascending: false });
    if (!error && data) setSubmissions(data);
  }, []);

  async function markChecked(id) {
    await supabase.from('submissions').update({ status: 'checked' }).eq('id', id);
    loadSubmissions();
  }

  // --- Progress ---
  const loadProgress = useCallback(async () => {
    const { data: students } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student');
    const { data: subs } = await supabase.from('submissions').select('student_id, status');

    setTotalStudents((students || []).length);

    const rows = (students || []).map((st) => {
      const mine = (subs || []).filter((s) => s.student_id === st.id);
      const checked = mine.filter((s) => s.status === 'checked').length;
      return { id: st.id, name: st.full_name || '-', submitted: mine.length, checked };
    });
    setProgressRows(rows);
  }, []);

  // --- My Profile ---
  const loadMyProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('barangay')
      .eq('id', currentUserId)
      .single();
    if (data?.barangay) setMyBarangay(data.barangay);
  }, [currentUserId]);

  async function saveBarangay() {
    if (!myBarangay) {
      setProfileMsg({ text: '⚠️ Please select a barangay first', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ barangay: myBarangay })
      .eq('id', currentUserId);
    if (error) setProfileMsg({ text: '❌ ' + error.message, type: 'error' });
    else setProfileMsg({ text: '✅ Barangay saved!', type: 'ok' });
  }

  // --- My Learners: find this teacher's CDC, then list learners in that same CDC ---
  const loadMyLearners = useCallback(async () => {
    setLearnersLoading(true);
    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('cdc_id, cdcs(name)')
      .eq('id', currentUserId)
      .single();

    if (!teacherRow || !teacherRow.cdc_id) {
      setMyCdcName(null);
      setMyCdcId(null);
      setMyLearners([]);
      setLearnersLoading(false);
      return;
    }

    setMyCdcName(teacherRow.cdcs?.name || null);
    setMyCdcId(teacherRow.cdc_id);

    const { data: learners } = await supabase
      .from('learners')
      .select('id, full_name, birthdate, parent_name, parent_contact, parent_login_email')
      .eq('cdc_id', teacherRow.cdc_id)
      .order('full_name');

    setMyLearners(learners || []);
    setLearnersLoading(false);
  }, [currentUserId]);

  async function addMyLearner() {
    if (!lFullName.trim() || !myCdcId) {
      setLearnerMsg({ text: '⚠️ Please enter a full name', type: 'error' });
      return;
    }
    setSavingLearner(true);

    const { data: inserted, error } = await supabase
      .from('learners')
      .insert({
        full_name: lFullName.trim(),
        birthdate: lBirthdate || null,
        barangay: null,
        cdc_id: myCdcId,
        parent_name: lParentName.trim() || null,
        parent_contact: lParentContact.trim() || null,
      })
      .select()
      .single();

    if (error) {
      setSavingLearner(false);
      setLearnerMsg({ text: '❌ ' + error.message, type: 'error' });
      return;
    }

    // Right after saving the learner, auto-generate the parent's login account
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'create-parent-account',
      { body: { learnerId: inserted.id } }
    );

    setSavingLearner(false);

    if (fnError || fnData?.error) {
      setLearnerMsg({
        text:
          '✅ Learner added. ⚠️ Parent account could not be created automatically (' +
          (fnData?.error || fnError.message) +
          '). You can generate it from the table below.',
        type: 'error',
      });
    } else {
      setLearnerMsg({ text: '✅ Learner added and parent account created!', type: 'ok' });
      setNewParentCreds({
        learnerName: lFullName.trim(),
        loginEmail: fnData.loginEmail,
        tempPassword: fnData.tempPassword,
      });
    }

    setLFullName('');
    setLBirthdate('');
    setLParentName('');
    setLParentContact('');
    loadMyLearners();
  }

  async function generateParentAccount(learner) {
    setParentGenLoading(learner.id);
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'create-parent-account',
      { body: { learnerId: learner.id } }
    );
    setParentGenLoading(null);

    if (fnError || fnData?.error) {
      alert('❌ ' + (fnData?.error || fnError.message));
    } else {
      setNewParentCreds({
        learnerName: learner.full_name,
        loginEmail: fnData.loginEmail,
        tempPassword: fnData.tempPassword,
      });
      loadMyLearners();
    }
  }

  async function deleteMyLearner(id) {
    if (!confirm('Delete this learner record?')) return;
    await supabase.from('learners').delete().eq('id', id);
    loadMyLearners();
  }

  useEffect(() => {
    loadCategoryOptions();
    loadMyMaterials();
    loadAnnouncements();
    loadSubmissions();
    loadProgress();
    loadMyProfile();
    loadMyLearners();
    loadCurriculumEntries(matAge);
    loadAssignments();
  }, [
    loadCategoryOptions,
    loadMyMaterials,
    loadAnnouncements,
    loadSubmissions,
    loadProgress,
    loadMyProfile,
    loadMyLearners,
    loadCurriculumEntries,
    loadAssignments,
  ]);

  const statusPillKind = (s) => ({ approved: 'checked', pending: 'submitted', rejected: 'submitted' }[s] || 'checked');
  const statusLabel = (s) => (s === 'rejected' ? '❌ rejected' : s || 'approved');

  return (
    <DashboardLayout
      logoSubtitle="Teacher"
      tabs={TABS}
      title="Teacher Dashboard"
      subtitle="Manolo Fortich, Bukidnon · EarlyLearn Hub"
      avatar="👩‍🏫"
      stats={[
        { label: 'Materials Uploaded', value: myMaterials.length || '-' },
        {
          label: 'Pending Submissions',
          value: submissions.filter((s) => s.status === 'submitted').length,
        },
        { label: 'Total Students', value: totalStudents || '-' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Welcome, Teacher!</h3>
          <p className="text-sm text-[#5c5342]">
            Use the menu on the left to upload materials/activities, post announcements, and
            check student submissions.
          </p>
        </div>
      )}

      {/* MY ASSIGNMENTS — specific Week/Sub-theme assigned by Admin */}
      {activeTab === 'assignments' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>My Assignments</h3>
          <p className="text-[13px] text-dash-ink-soft -mt-2.5 mb-4">
            These are the curriculum weeks the Admin has assigned to you. Upload the
            material/activity for each one.
          </p>

          {assignmentsLoading && <p className="text-[13px] text-dash-ink-soft">Loading...</p>}

          {!assignmentsLoading && assignments.length === 0 && (
            <p className="text-[13px] text-dash-ink-soft">
              No assignments yet. The Admin will assign specific weeks to you from the
              Curriculum Guide.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {assignments.map((a) => {
              const s = assignmentStatus(a);
              const cg = a.curriculum_guide;
              return (
                <div
                  key={a.id}
                  className="bg-[#FFFDF8] border border-card-border rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div>
                    <div className="font-bold text-[14px] text-dash-ink">
                      {cg?.level} · {cg?.quarter} · {cg?.week}
                    </div>
                    <div className="text-[13px] text-dash-ink-soft">{cg?.sub_theme}</div>
                    <span
                      className={`inline-block mt-1.5 px-2.5 py-[3px] rounded-full text-[10.5px] font-bold ${s.cls}`}
                    >
                      {s.text}
                    </span>
                  </div>
                  <button onClick={() => startAssignmentUpload(a)} className={btnSmall}>
                    {a.material_id ? 'Re-upload' : 'Upload'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY LEARNERS — auto-matched by CDC, no manual assignment needed */}
      {activeTab === 'mylearners' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>My Learners</h3>
          {learnersLoading && <p className="text-[13px] text-dash-ink-soft">Loading...</p>}

          {!learnersLoading && !myCdcName && (
            <p className="text-[13px] text-dash-ink-soft">
              You're not yet assigned to a CDC. Please ask the Admin to assign your CDC in
              "Manage Teachers" — your learners will appear here automatically once that's set.
            </p>
          )}

          {!learnersLoading && myCdcName && (
            <>
              <p className="text-[12.5px] text-dash-ink-soft -mt-2.5 mb-4">
                Learners assigned to <strong>{myCdcName}</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mb-3">
                <div>
                  <label className={label}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Juan Dela Cruz Jr."
                    value={lFullName}
                    onChange={(e) => setLFullName(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Birthdate</label>
                  <input
                    type="date"
                    value={lBirthdate}
                    onChange={(e) => setLBirthdate(e.target.value)}
                    className={input}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <div>
                  <label className={label}>Parent/Guardian Name</label>
                  <input
                    type="text"
                    placeholder="Maria Dela Cruz"
                    value={lParentName}
                    onChange={(e) => setLParentName(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Parent Contact Number</label>
                  <input
                    type="text"
                    placeholder="09XX-XXX-XXXX"
                    value={lParentContact}
                    onChange={(e) => setLParentContact(e.target.value)}
                    className={input}
                  />
                </div>
              </div>
              <button onClick={addMyLearner} disabled={savingLearner} className={btnPrimary}>
                {savingLearner ? 'Saving...' : '+ Add Learner'}
              </button>
              {learnerMsg.text && (
                <p className={learnerMsg.type === 'error' ? msgError : msgOk}>{learnerMsg.text}</p>
              )}

              {newParentCreds && (
                <div className="bg-[#FFF8E1] border border-[#E8D48A] rounded-xl p-4 mt-3">
                  <p className="text-[13px] font-bold text-dash-ink mb-1">
                    🔑 Parent Login for {newParentCreds.learnerName}
                  </p>
                  <p className="text-[13px] text-dash-ink">
                    Login ID: <strong>{newParentCreds.loginEmail}</strong>
                  </p>
                  <p className="text-[13px] text-dash-ink">
                    Password: <strong>{newParentCreds.tempPassword}</strong>
                  </p>
                  <p className="text-[12px] text-dash-ink-soft mt-2">
                    Isulat o ipadala ni sa parent karon dayon — dili na ni makita pag-usab human
                    nimo isira ni nga box.
                  </p>
                  <button
                    onClick={() => setNewParentCreds(null)}
                    className="text-[12px] font-bold text-dash-ink-soft underline bg-transparent border-none cursor-pointer mt-2"
                  >
                    Isira
                  </button>
                </div>
              )}

              <h3 className={`${cardBoxTitle} mt-7`}>All Learners</h3>
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>Name</th>
                      <th className={th}>Birthdate</th>
                      <th className={th}>Parent</th>
                      <th className={th}>Contact</th>
                      <th className={th}>Parent Login</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLearners.map((l) => (
                      <tr key={l.id}>
                        <td className={td}>{l.full_name}</td>
                        <td className={td}>{l.birthdate || '-'}</td>
                        <td className={td}>{l.parent_name || '-'}</td>
                        <td className={td}>{l.parent_contact || '-'}</td>
                        <td className={td}>
                          {l.parent_login_email ? (
                            <span className="text-[11.5px] text-dash-ink-soft">
                              {l.parent_login_email}
                            </span>
                          ) : (
                            <button
                              onClick={() => generateParentAccount(l)}
                              disabled={parentGenLoading === l.id}
                              className={btnSmall}
                            >
                              {parentGenLoading === l.id ? 'Generating...' : 'Generate'}
                            </button>
                          )}
                        </td>
                        <td className={td}>
                          <button onClick={() => deleteMyLearner(l.id)} className={delBtn}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {myLearners.length === 0 && (
                <p className="text-[13px] mt-3 text-dash-ink-soft">
                  No learners recorded yet for {myCdcName}.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* UPLOAD MATERIALS/ACTIVITIES */}
      {activeTab === 'upload' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>
            {lockedAssignment ? 'Upload for Assignment' : 'Upload Learning Material or Activity'}
          </h3>

          {lockedAssignment && (
            <div className="bg-[#FFFDF8] border border-card-border rounded-xl p-3.5 mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[13px] text-dash-ink">
                <strong>{lockedAssignment.curriculum_guide?.level}</strong> ·{' '}
                {lockedAssignment.curriculum_guide?.quarter} ·{' '}
                {lockedAssignment.curriculum_guide?.week} ·{' '}
                {lockedAssignment.curriculum_guide?.sub_theme}
              </div>
              <button
                onClick={cancelLockedUpload}
                className="text-[12px] font-bold text-dash-ink-soft underline bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {!lockedAssignment && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <div>
                <label className={label}>Category</label>
                <select
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value)}
                  className={input}
                >
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Type</label>
                <select value={matType} onChange={(e) => setMatType(e.target.value)} className={input}>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                  <option value="text">Text / Story</option>
                  <option value="activity">Activity (may tubagon)</option>
                </select>
              </div>
            </div>
          )}

          {lockedAssignment && (
            <div>
              <label className={label}>Type</label>
              <select value={matType} onChange={(e) => setMatType(e.target.value)} className={input}>
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="text">Text / Story</option>
                <option value="activity">Activity (may tubagon)</option>
              </select>
            </div>
          )}

          <label className={label}>Title</label>
          <input
            type="text"
            placeholder="e.g. Letter A Song"
            value={matTitle}
            onChange={(e) => setMatTitle(e.target.value)}
            className={input}
          />

          {!lockedAssignment && (
            <div>
              <label className={label}>Age Range</label>
              <select
                value={matAge}
                onChange={(e) => {
                  setMatAge(e.target.value);
                  setMatCurriculumId('');
                  loadCurriculumEntries(e.target.value);
                }}
                className={input}
              >
                <option value="K1 (3.0-3.11)">K1 (3.0-3.11)</option>
                <option value="K2 (4.0-4.11)">K2 (4.0-4.11)</option>
              </select>
            </div>
          )}

          <label className={label}>Content URL (video/image link, optional)</label>
          <input
            type="text"
            placeholder="https://..."
            value={matUrl}
            onChange={(e) => setMatUrl(e.target.value)}
            className={input}
          />

          <label className={label}>Text Content / Activity Question (optional)</label>
          <textarea
            placeholder="e.g. What letter is this? or simple content"
            value={matText}
            onChange={(e) => setMatText(e.target.value)}
            className={`${input} min-h-[70px] resize-y`}
          />

          {!lockedAssignment && (
            <>
              <label className={label}>Link to Curriculum Guide (optional)</label>
              <select
                value={matCurriculumId}
                onChange={(e) => setMatCurriculumId(e.target.value)}
                className={input}
              >
                <option value="">— not linked —</option>
                {curriculumEntries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.quarter} · {c.week} · {c.sub_theme}
                  </option>
                ))}
              </select>
            </>
          )}

          <button onClick={handleUpload} className={btnPrimary}>
            Upload
          </button>
          {uploadMsg.text && (
            <p className={uploadMsg.type === 'error' ? msgError : msgOk}>{uploadMsg.text}</p>
          )}

          <h3 className={`${cardBoxTitle} mt-7`}>My Uploaded Materials</h3>
          <p className="text-[12.5px] text-dash-ink-soft -mt-2.5 mb-4">
            New uploads wait for Admin approval before students can see them.
          </p>
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
                {myMaterials.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.title}</td>
                    <td className={td}>{m.categories?.name || '-'}</td>
                    <td className={td}>{m.type}</td>
                    <td className={td}>
                      <span className={ageTag}>{m.age_range || '-'}</span>
                    </td>
                    <td className={td}>
                      <span className={pillClass(statusPillKind(m.status))}>{statusLabel(m.status)}</span>
                    </td>
                    <td className={td}>
                      <button onClick={() => deleteMyMaterial(m.id)} className={delBtn}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Post Announcement</h3>
          <label className={label}>Title</label>
          <input
            type="text"
            placeholder="e.g. No classes tomorrow"
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            className={input}
          />
          <label className={label}>Message</label>
          <textarea
            placeholder="Write the announcement details here..."
            value={annMessage}
            onChange={(e) => setAnnMessage(e.target.value)}
            className={`${input} min-h-[70px] resize-y`}
          />
          <button onClick={postAnnouncement} className={btnPrimary}>
            Post Announcement
          </button>
          {annStatusMsg.text && (
            <p className={annStatusMsg.type === 'error' ? msgError : msgOk}>{annStatusMsg.text}</p>
          )}

          <h3 className={`${cardBoxTitle} mt-7`}>Recent Announcements</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Message</th>
                  <th className={th}>Posted</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id}>
                    <td className={td}>{a.title}</td>
                    <td className={`${td} max-w-[260px]`}>{a.message}</td>
                    <td className={td}>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className={td}>
                      <button onClick={() => deleteAnnouncement(a.id)} className={delBtn}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Student Submissions</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Activity</th>
                  <th className={th}>Answer</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>{s.profiles?.full_name || '-'}</td>
                    <td className={td}>{s.materials?.title || '-'}</td>
                    <td className={td}>{s.answer_text || '-'}</td>
                    <td className={td}>
                      <span className={pillClass(s.status)}>{s.status}</span>
                    </td>
                    <td className={td}>
                      {s.status === 'submitted' && (
                        <button onClick={() => markChecked(s.id)} className={btnSmall}>
                          Mark Checked
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {submissions.length === 0 && (
            <p className="text-[13px] mt-3 text-dash-ink-soft">
              No submissions from students yet.
            </p>
          )}
        </div>
      )}

      {/* PROGRESS */}
      {activeTab === 'progress' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>Student Progress</h3>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>Checked</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>{r.name}</td>
                    <td className={td}>{r.submitted}</td>
                    <td className={td}>{r.checked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MY PROFILE */}
      {activeTab === 'profile' && (
        <div className={cardBox}>
          <h3 className={cardBoxTitle}>My Profile</h3>
          <label className={label}>Barangay</label>
          <select
            value={myBarangay}
            onChange={(e) => setMyBarangay(e.target.value)}
            className={input}
          >
            <option value="">— select your barangay —</option>
            {barangays.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button onClick={saveBarangay} className={btnPrimary}>
            Save
          </button>
          {profileMsg.text && (
            <p className={profileMsg.type === 'error' ? msgError : msgOk}>{profileMsg.text}</p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}