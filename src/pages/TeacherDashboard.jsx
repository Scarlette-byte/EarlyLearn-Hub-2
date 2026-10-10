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
  const [matAge, setMatAge] = useState('3-4');
  const [matUrl, setMatUrl] = useState('');
  const [matText, setMatText] = useState('');
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const [myMaterials, setMyMaterials] = useState([]);

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
  const [myLearners, setMyLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(true);

  // --- Load categories into the dropdown ---
  const loadCategoryOptions = useCallback(async () => {
    const { data } = await supabase.from('categories').select('id, name, icon').order('name');
    setCategoryOptions(data || []);
    if (data && data.length && !matCategory) setMatCategory(data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!matTitle.trim() || !matCategory) {
      setUploadMsg({ text: '⚠️ Please enter a title and select a category', type: 'error' });
      return;
    }
    const { error } = await supabase.from('materials').insert({
      category_id: matCategory,
      type: matType,
      title: matTitle.trim(),
      age_range: matAge,
      content_url: matUrl.trim() || null,
      content_text: matText.trim() || null,
      created_by: currentUserId,
    });
    if (error) {
      setUploadMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setUploadMsg({ text: '✅ Uploaded!', type: 'ok' });
      setMatTitle('');
      setMatUrl('');
      setMatText('');
      loadMyMaterials();
    }
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
      setMyLearners([]);
      setLearnersLoading(false);
      return;
    }

    setMyCdcName(teacherRow.cdcs?.name || null);

    const { data: learners } = await supabase
      .from('learners')
      .select('id, full_name, birthdate, parent_name, parent_contact')
      .eq('cdc_id', teacherRow.cdc_id)
      .order('full_name');

    setMyLearners(learners || []);
    setLearnersLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadCategoryOptions();
    loadMyMaterials();
    loadAnnouncements();
    loadSubmissions();
    loadProgress();
    loadMyProfile();
    loadMyLearners();
  }, [
    loadCategoryOptions,
    loadMyMaterials,
    loadAnnouncements,
    loadSubmissions,
    loadProgress,
    loadMyProfile,
    loadMyLearners,
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
                Showing learners assigned to <strong>{myCdcName}</strong>.
              </p>
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>Name</th>
                      <th className={th}>Birthdate</th>
                      <th className={th}>Parent</th>
                      <th className={th}>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLearners.map((l) => (
                      <tr key={l.id}>
                        <td className={td}>{l.full_name}</td>
                        <td className={td}>{l.birthdate || '-'}</td>
                        <td className={td}>{l.parent_name || '-'}</td>
                        <td className={td}>{l.parent_contact || '-'}</td>
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
          <h3 className={cardBoxTitle}>Upload Learning Material or Activity</h3>
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

          <label className={label}>Title</label>
          <input
            type="text"
            placeholder="e.g. Letter A Song"
            value={matTitle}
            onChange={(e) => setMatTitle(e.target.value)}
            className={input}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <div>
              <label className={label}>Age Range</label>
              <select value={matAge} onChange={(e) => setMatAge(e.target.value)} className={input}>
                <option value="3-4">3-4 years old (Day Care & Nursery)</option>
                <option value="5-6">5-6 years old (Kindergarten)</option>
              </select>
            </div>
            <div>
              <label className={label}>Content URL (video/image link, optional)</label>
              <input
                type="text"
                placeholder="https://..."
                value={matUrl}
                onChange={(e) => setMatUrl(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <label className={label}>Text Content / Activity Question (optional)</label>
          <textarea
            placeholder="e.g. What letter is this? or simple content"
            value={matText}
            onChange={(e) => setMatText(e.target.value)}
            className={`${input} min-h-[70px] resize-y`}
          />

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