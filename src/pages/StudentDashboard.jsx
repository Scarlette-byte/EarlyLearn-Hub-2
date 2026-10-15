import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const PALETTES = [
  'bg-coral', // coral red
  'bg-turquoise', // turquoise
  'bg-sun text-[#4A3F1A]', // sunshine yellow - dark text for contrast
  'bg-leaf', // grass green
  'bg-purple', // soft purple
  'bg-orange', // warm orange
];

const TYPE_ICONS = {
  video: '🎬',
  image: '🖼️',
  text: '📖',
  activity: '✏️',
};

// Default ECCD categories matching the original student dashboard
const DEFAULT_CATEGORIES = [
  { id: 'cat-alphabet', name: 'Alphabet', icon: '🔤' },
  { id: 'cat-numbers', name: 'Numbers', icon: '🔢' },
  { id: 'cat-colors', name: 'Colors', icon: '🎨' },
  { id: 'cat-shapes', name: 'Shapes', icon: '🔺' },
  { id: 'cat-animals', name: 'Animals', icon: '🐶' },
  { id: 'cat-stories', name: 'Stories', icon: '📖' },
];

export default function StudentDashboard({ profile }) {
  const navigate = useNavigate();
  const currentUserId = profile?.id || 'demo-student';

  const [view, setView] = useState('home'); // home | materials | content
  const [backTarget, setBackTarget] = useState('home');

  const greetingName = useMemo(() => {
    if (!profile?.full_name) return 'Student Test';
    if (profile.full_name.includes('(Parent:')) {
      return profile.full_name.split(' (Parent:')[0];
    }
    return profile.full_name;
  }, [profile?.full_name]);

  const [announcements, setAnnouncements] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Completed teacher activity IDs
  const [completedIds, setCompletedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`earlylearn_done_${currentUserId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Category view state
  const [currentCategory, setCurrentCategory] = useState(null);
  const [categoryMaterials, setCategoryMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Content view state (doing a teacher activity)
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [answer, setAnswer] = useState('');
  const [doneMsg, setDoneMsg] = useState({ text: '', error: false });
  const [submitted, setSubmitted] = useState(false);

  // Activities sub-tab view: 'teacher' | 'student_uploads'
  const [activityTab, setActivityTab] = useState('teacher');

  // Student's own uploaded activities & artworks
  const [studentUploads, setStudentUploads] = useState(() => {
    try {
      const saved = localStorage.getItem(`earlylearn_student_uploads_${currentUserId}`);
      if (saved) return JSON.parse(saved);
      const general = localStorage.getItem('earlylearn_student_uploads');
      return general ? JSON.parse(general) : [];
    } catch {
      return [];
    }
  });

  // Student upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Colors');
  const [uploadNote, setUploadNote] = useState('');
  const [uploadFilePreview, setUploadFilePreview] = useState(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);

  // Teacher-uploaded modules from localStorage & Supabase
  const [teacherUploadedModules, setTeacherUploadedModules] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dbMaterials, setDbMaterials] = useState([]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  // --- Load Announcements from Supabase ---
  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      if (!error && data && data.length > 0) {
        setAnnouncements(data);
      }
    } catch {
      // fallback
    }
  }, []);

  // --- Load Categories from Supabase ---
  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at');
      if (!error && data && data.length > 0) {
        setCategories(data);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    }
  }, []);

  // --- Load Supabase Materials ---
  const loadDbMaterials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*, categories(id, name, icon)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setDbMaterials(data);
      }
    } catch {
      // fallback
    }
  }, []);

  // Listen to teacher uploads in localStorage
  useEffect(() => {
    loadAnnouncements();
    loadCategories();
    loadDbMaterials();

    function handleStorageChange(e) {
      if (e.key === 'earlylearn_teacher_modules') {
        try {
          const updated = JSON.parse(e.newValue || '[]');
          setTeacherUploadedModules(updated);
        } catch {
          // ignore
        }
      }
      if (e.key === 'earlylearn_student_uploads' || e.key === `earlylearn_student_uploads_${currentUserId}`) {
        try {
          const updated = JSON.parse(e.newValue || '[]');
          setStudentUploads(updated);
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadAnnouncements, loadCategories, loadDbMaterials, currentUserId]);

  // -------------------------------------------------------------------------
  // "MY ACTIVITIES": STRICTLY BASED ON WHAT THE TEACHER UPLOADS (NO CURRICULUM SEED)
  // -------------------------------------------------------------------------
  const teacherActivities = useMemo(() => {
    const list = [];
    const seenTitles = new Set();

    // 1. Materials explicitly uploaded by a teacher in TeacherDashboard
    (teacherUploadedModules || []).forEach((m) => {
      // Filter ONLY actual teacher uploads marked as activities, excluding static curriculum guide baseline
      const isActualTeacherUpload =
        m.is_custom_teacher_upload === true ||
        (m.id && m.id.startsWith('mod-') && !m.id.match(/^mod-0[1-9]/)) ||
        (m.teacher_id && m.teacher_id !== 'system');

      const isActivity =
        m.module_type === 'activity' ||
        m.type === 'activity' ||
        (m.module_type && m.module_type.toLowerCase().includes('activity'));

      if (isActualTeacherUpload && isActivity && !seenTitles.has(m.title.toLowerCase())) {
        seenTitles.add(m.title.toLowerCase());
        list.push({
          id: m.id,
          title: m.title,
          category_id: m.category_id,
          category_name: m.sub_theme || m.theme || m.category_name || 'Class Activity',
          type: 'activity',
          icon: '✏️',
          content_text: m.description || m.content_text || 'Teacher-guided early childhood activity.',
          content_url: m.content_url || null,
          teacher_name: m.teacher_name || 'CDC Teacher',
          cdc_name: m.cdc_name || '',
          created_at: m.upload_date || 'Recent',
        });
      }
    });

    // 2. Supabase materials uploaded by teachers (where created_by is present)
    (dbMaterials || []).forEach((m) => {
      if (m.type === 'activity' && m.created_by && !seenTitles.has(m.title.toLowerCase())) {
        seenTitles.add(m.title.toLowerCase());
        list.push({
          id: m.id,
          title: m.title,
          category_id: m.category_id,
          category_name: m.categories?.name || 'Class Activity',
          type: 'activity',
          icon: m.categories?.icon || '✏️',
          content_text: m.content_text || 'Teacher-assigned learning activity.',
          content_url: m.content_url || null,
          teacher_name: 'CDC Teacher',
          created_at: m.created_at,
        });
      }
    });

    return list;
  }, [teacherUploadedModules, dbMaterials]);

  // Pending teacher activities
  const pendingTeacherActivities = useMemo(() => {
    return teacherActivities.filter((a) => !completedIds.has(a.id));
  }, [teacherActivities, completedIds]);

  // Completed teacher activities
  const completedTeacherActivities = useMemo(() => {
    return teacherActivities.filter((a) => completedIds.has(a.id));
  }, [teacherActivities, completedIds]);

  // Progress metrics: combination of completed teacher activities + student uploaded works
  const totalCompletedCount = completedTeacherActivities.length + studentUploads.length;
  const totalTasksCount = Math.max(1, teacherActivities.length + studentUploads.length);
  const progressPct = Math.min(100, Math.round((totalCompletedCount / totalTasksCount) * 100));

  // Count pending activities per category for category badges
  const pendingByCategory = useMemo(() => {
    const map = {};
    pendingTeacherActivities.forEach((a) => {
      categories.forEach((cat) => {
        const matchesCat =
          a.category_id === cat.id ||
          (a.category_name && a.category_name.toLowerCase().includes(cat.name.toLowerCase()));
        if (matchesCat) {
          map[cat.id] = (map[cat.id] || 0) + 1;
        }
      });
    });
    return map;
  }, [pendingTeacherActivities, categories]);

  // --- Handlers ---
  function openCategory(cat) {
    setCurrentCategory(cat);
    setView('materials');
    setMaterialsLoading(true);

    const catNameLower = cat.name.toLowerCase();
    // Only materials uploaded by teacher or student matching this category
    const matching = [
      ...teacherActivities.filter(
        (m) =>
          m.category_id === cat.id ||
          (m.category_name && m.category_name.toLowerCase().includes(catNameLower))
      ),
      ...studentUploads
        .filter((u) => u.category && u.category.toLowerCase().includes(catNameLower))
        .map((u) => ({
          id: u.id,
          title: u.title,
          type: 'image',
          content_text: u.note,
          content_url: u.mediaUrl,
          teacher_name: `Uploaded by ${greetingName}`,
        })),
    ];

    setCategoryMaterials(matching);
    setMaterialsLoading(false);
  }

  function openMaterial(m, from) {
    setBackTarget(from);
    setCurrentMaterial(m);
    setAnswer('');
    setDoneMsg({ text: '', error: false });
    setSubmitted(false);
    setView('content');
  }

  async function submitAnswer() {
    const trimmed = answer.trim();
    if (!trimmed) {
      alert('Please write your answer or reflection first.');
      return;
    }

    const updated = new Set(completedIds);
    updated.add(currentMaterial.id);
    setCompletedIds(updated);
    try {
      localStorage.setItem(`earlylearn_done_${currentUserId}`, JSON.stringify(Array.from(updated)));
    } catch {
      // ignore
    }

    try {
      await supabase.from('submissions').insert({
        material_id: currentMaterial.id,
        student_id: currentUserId,
        answer_text: trimmed,
        status: 'submitted',
      });
    } catch {
      // ignore
    }

    setDoneMsg({ text: '🎉 Nice! Your answer has been submitted to your teacher!', error: false });
    setSubmitted(true);
  }

  // --- Handle Student Uploading Their Own Activity / Artwork ---
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFileName(file.name);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setUploadFilePreview(uploadEvent.target?.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleStudentUploadSubmit(e) {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadMsg({ text: '⚠️ Please provide a title for your activity.', type: 'error' });
      return;
    }

    setUploading(true);
    setUploadMsg({ text: '', type: '' });

    const newUpload = {
      id: 'stu-up-' + Date.now(),
      studentId: currentUserId,
      studentName: greetingName,
      title: uploadTitle.trim(),
      category: uploadCategory,
      note: uploadNote.trim(),
      mediaUrl: uploadFilePreview || null,
      fileName: uploadFileName || 'Activity_Photo.png',
      uploadedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'Submitted to Teacher',
    };

    const updatedUploads = [newUpload, ...studentUploads];
    setStudentUploads(updatedUploads);

    try {
      localStorage.setItem(
        `earlylearn_student_uploads_${currentUserId}`,
        JSON.stringify(updatedUploads)
      );
      localStorage.setItem('earlylearn_student_uploads', JSON.stringify(updatedUploads));
    } catch {
      // ignore
    }

    // Attempt saving to Supabase submissions
    try {
      await supabase.from('submissions').insert({
        student_id: currentUserId,
        answer_text: `[${uploadCategory}] ${uploadTitle.trim()}: ${uploadNote.trim()}`,
        status: 'submitted',
      });
    } catch (err) {
      console.warn('Note on Supabase submission insert:', err);
    }

    setUploading(false);
    setUploadMsg({ text: '🎉 Activity uploaded successfully! Your teacher will review it.', type: 'ok' });

    setTimeout(() => {
      setIsUploadModalOpen(false);
      setUploadTitle('');
      setUploadNote('');
      setUploadFilePreview(null);
      setUploadFileName('');
      setUploadMsg({ text: '', type: '' });
      setActivityTab('student_uploads');
    }, 1200);
  }

  return (
    <div className="min-h-screen font-nunito text-[#3a3226] bg-[#FFF8EB] sm:bg-gradient-to-b sm:from-[#FFF6DA] sm:to-[#FFEFC2]">
      <div className="max-w-[620px] mx-auto px-4.5 sm:px-5 pt-6 pb-16 text-center">
        {/* HEADER BAR */}
        <div className="flex justify-between items-center mb-4.5">
          <div className="text-left">
            <h1 className="font-baloo text-2xl sm:text-[26px] font-bold m-0 text-left text-[#3a3226] flex items-center gap-1.5">
              <span>👋</span> Hi, {greetingName}!
            </h1>
            <p className="text-[13.5px] sm:text-[14px] text-[#6b5c42] mt-0.5 font-medium m-0">
              Choose what you'd like to learn
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="border-none bg-white rounded-2xl px-4 py-2 font-extrabold text-[13px] text-[#C9553F] cursor-pointer shadow-flat hover:bg-rose-50 transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* HOME VIEW */}
        {view === 'home' && (
          <div>
            {/* Announcements (if any) */}
            {announcements.length > 0 && (
              <div className="mb-3.5">
                <div className="text-xs font-extrabold text-[#6b5c42] text-left mb-2">
                  📢 Announcements
                </div>
                {announcements.map((a, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl px-4 py-3 text-left mb-2 shadow-soft border-l-[5px] border-[#FFB84D]"
                  >
                    <div className="font-baloo font-bold text-[14.5px] mb-0.5">{a.title}</div>
                    <div className="text-[12.5px] text-[#6b6355]">{a.message}</div>
                  </div>
                ))}
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 📝 MY ACTIVITIES SECTION                                 */}
            {/* (Only Teacher-Uploaded + Student Uploads)                */}
            {/* -------------------------------------------------------- */}
            <div className="mb-5.5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-extrabold text-[#6b5c42] flex items-center gap-1.5">
                  <span>📝</span> My Activities
                  {pendingTeacherActivities.length > 0 && (
                    <span className="text-[10.5px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2 py-0.5 rounded-full ml-1">
                      {pendingTeacherActivities.length} to do
                    </span>
                  )}
                </div>

                {/* Upload My Activity Button */}
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-coral hover:bg-coral-deep text-white text-xs font-extrabold flex items-center gap-1 shadow-bump active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <span>📤</span>
                  <span>+ Upload My Activity</span>
                </button>
              </div>

              {/* Sub-Tabs: Teacher's Uploads vs Student's Uploaded Works */}
              <div className="flex items-center gap-1.5 p-1 bg-white/70 rounded-xl mb-3 border border-[#F0E4CE]">
                <button
                  onClick={() => setActivityTab('teacher')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activityTab === 'teacher'
                      ? 'bg-white text-dash-ink shadow-xs'
                      : 'text-dash-ink-soft hover:text-dash-ink'
                  }`}
                >
                  Teacher's Uploads ({pendingTeacherActivities.length})
                </button>
                <button
                  onClick={() => setActivityTab('student_uploads')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activityTab === 'student_uploads'
                      ? 'bg-white text-dash-ink shadow-xs'
                      : 'text-dash-ink-soft hover:text-dash-ink'
                  }`}
                >
                  My Uploaded Works ({studentUploads.length})
                </button>
              </div>

              {/* TAB 1: TEACHER ASSIGNED ACTIVITIES */}
              {activityTab === 'teacher' && (
                <div>
                  {pendingTeacherActivities.length === 0 ? (
                    <div className="bg-white rounded-2xl p-5 text-center shadow-soft border border-[#F0E4CE]">
                      <div className="text-2xl mb-1">🎈</div>
                      <div className="font-baloo font-bold text-base text-[#3a3226]">
                        No Teacher Activities at the Moment
                      </div>
                      <div className="text-xs text-[#7a7a7a] mt-1 max-w-sm mx-auto">
                        Your teacher hasn't uploaded any new activities yet. You can upload your own drawing or artwork using the button above!
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingTeacherActivities.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => openMaterial(a, 'home')}
                          className="bg-white rounded-2xl px-4 py-3.5 text-left shadow-soft flex items-center gap-3.5 cursor-pointer border-l-[5px] border-leaf hover:translate-x-0.5 transition-transform"
                        >
                          <div className="text-3xl flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-[#E8F5E9] text-leaf">
                            {a.icon || '✏️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-baloo font-bold text-[15.5px] text-[#3a3226] truncate">
                              {a.title}
                            </div>
                            <div className="text-[11.5px] text-[#7a7a7a] font-bold flex items-center gap-1.5 mt-0.5">
                              <span>{a.category_name}</span>
                              {a.teacher_name && (
                                <>
                                  <span>•</span>
                                  <span className="text-accent font-semibold">{a.teacher_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-leaf bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
                            Start →
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: STUDENT'S OWN UPLOADED WORKS */}
              {activityTab === 'student_uploads' && (
                <div>
                  {studentUploads.length === 0 ? (
                    <div className="bg-white rounded-2xl p-5 text-center shadow-soft border border-[#F0E4CE]">
                      <div className="text-2xl mb-1">🎨</div>
                      <div className="font-baloo font-bold text-base text-[#3a3226]">
                        No Uploaded Activities Yet
                      </div>
                      <div className="text-xs text-[#7a7a7a] mt-1 mb-3">
                        Take a photo of your drawing, coloring sheet, or homework and upload it directly to your teacher!
                      </div>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-coral hover:bg-coral-deep text-white font-bold text-xs shadow-bump cursor-pointer"
                      >
                        📸 Upload Your First Artwork
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {studentUploads.map((u) => (
                        <div
                          key={u.id}
                          className="bg-white rounded-2xl p-3.5 text-left shadow-soft flex items-start gap-3 border-l-[5px] border-[#FFB84D]"
                        >
                          {u.mediaUrl ? (
                            <img
                              src={u.mediaUrl}
                              alt={u.title}
                              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-200"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shrink-0 font-bold">
                              🖼️
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-baloo font-bold text-[15px] text-[#3a3226] m-0 truncate">
                                {u.title}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 shrink-0">
                                {u.status || 'Submitted'}
                              </span>
                            </div>
                            <div className="text-[11px] text-dash-ink-soft mt-0.5">
                              Subject: <b className="text-[#3a3226]">{u.category}</b> • {u.uploadedAt}
                            </div>
                            {u.note && (
                              <p className="text-xs text-[#5a4d38] mt-1 leading-snug line-clamp-2 m-0 bg-[#FFFDF8] p-1.5 rounded-lg border border-[#F0E4CE]">
                                "{u.note}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* -------------------------------------------------------- */}
            {/* 6 COLORFUL CATEGORY BUTTONS                              */}
            {/* -------------------------------------------------------- */}
            <div className="grid grid-cols-3 gap-3.5 my-5.5">
              {categories.map((c, i) => {
                const count = pendingByCategory[c.id] || 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => openCategory(c)}
                    className={`relative border-none rounded-[24px] py-6 sm:py-6.5 px-2 flex flex-col items-center gap-2 font-baloo font-bold text-base text-white cursor-pointer shadow-bump transition-transform active:translate-y-1 active:shadow-bump-active ${
                      PALETTES[i % PALETTES.length]
                    }`}
                  >
                    {count > 0 && (
                      <span className="absolute top-1.5 right-2 sm:right-2.5 bg-[#E8483D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border-2 border-white shadow-xs">
                        {count} new
                      </span>
                    )}
                    <div className="text-[46px] sm:text-[54px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] flex items-center justify-center">
                      {c.icon}
                    </div>
                    <span className="text-[14.5px] sm:text-base leading-tight drop-shadow-xs">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* -------------------------------------------------------- */}
            {/* ⭐ MY PROGRESS SECTION                                    */}
            {/* -------------------------------------------------------- */}
            <div className="bg-white rounded-[20px] px-5.5 py-4 shadow-soft mt-3">
              <div className="text-xs text-[#6b5c42] font-extrabold mb-2 text-left">
                ⭐ My Progress
              </div>
              <div className="bg-[#F0E9D6] rounded-[20px] h-4 overflow-hidden">
                <div
                  className="h-full rounded-[20px] transition-[width] duration-300"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #FFB84D, #FF8C69)',
                  }}
                />
              </div>
              <div className="mt-2 text-[15px] font-bold text-[#3a3226]">
                🌟 {totalCompletedCount} of {totalTasksCount} activit{totalTasksCount === 1 ? 'y' : 'ies'} completed!
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* MATERIALS LIST VIEW (When a category button is clicked)  */}
        {/* -------------------------------------------------------- */}
        {view === 'materials' && (
          <div>
            <button
              onClick={() => setView('home')}
              className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4 flex items-center gap-1.5"
            >
              ⬅ Back to Activities
            </button>
            <div className="text-left font-baloo text-xl font-bold mb-3 flex items-center gap-2">
              <span>{currentCategory?.icon}</span>
              <span>{currentCategory?.name} Lessons &amp; Activities</span>
            </div>

            <div className="flex flex-col gap-3">
              {materialsLoading && (
                <div className="text-[15px] text-[#6b6355] p-7">Loading materials...</div>
              )}
              {!materialsLoading && categoryMaterials.length === 0 && (
                <div className="bg-white rounded-2xl p-7 text-center shadow-soft text-[#6b6355]">
                  <div className="text-3xl mb-1.5">🎈</div>
                  <div className="font-baloo font-bold text-base text-[#3a3226]">
                    Nothing here yet in {currentCategory?.name}
                  </div>
                  <p className="text-xs text-dash-ink-soft mt-1">
                    Your CDC teacher will upload lessons and fun activities soon!
                  </p>
                </div>
              )}
              {!materialsLoading &&
                categoryMaterials.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => openMaterial(m, 'materials')}
                    className="bg-white rounded-[20px] p-4.5 text-left shadow-soft cursor-pointer flex items-center gap-3.5 hover:bg-[#FFFDF8] transition-colors"
                  >
                    <div className="text-4xl flex-shrink-0">
                      {TYPE_ICONS[m.type] || '📄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-baloo font-bold text-[18px] text-[#3a3226]">
                        {m.title}
                      </div>
                      <div className="text-[12px] text-[#7a7a7a] font-bold uppercase mt-0.5">
                        {m.type === 'activity' ? 'Activity' : m.type}
                        {m.teacher_name ? ` • by ${m.teacher_name}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-accent">Open →</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* CONTENT VIEW (Interactive activity & lesson viewer)      */}
        {/* -------------------------------------------------------- */}
        {view === 'content' && currentMaterial && (
          <div>
            <button
              onClick={() => setView(backTarget)}
              className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4 flex items-center gap-1.5"
            >
              ⬅ Back
            </button>
            <div className="bg-white rounded-[24px] p-6 text-left shadow-soft border border-[#F0E4CE]">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-accent">
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#8C6200]">
                  {currentMaterial.category_name || 'Class Activity'}
                </span>
                {currentMaterial.teacher_name && (
                  <span>by {currentMaterial.teacher_name}</span>
                )}
              </div>

              <h2 className="font-baloo text-2xl m-0 mb-3 text-[#3a3226]">
                {currentMaterial.title}
              </h2>

              {currentMaterial.type === 'video' && currentMaterial.content_url && (
                <video
                  controls
                  src={currentMaterial.content_url}
                  className="w-full rounded-2xl aspect-video border-none mb-4"
                />
              )}

              {currentMaterial.type === 'image' && currentMaterial.content_url && (
                <img
                  src={currentMaterial.content_url}
                  alt={currentMaterial.title}
                  className="w-full rounded-2xl mb-4"
                />
              )}

              {currentMaterial.content_text && (
                <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#F0E4CE] text-[16px] sm:text-[17px] leading-[1.6] text-[#3a3226] mb-4">
                  {currentMaterial.content_text}
                </div>
              )}

              {currentMaterial.type === 'activity' && (
                <div className="mt-3">
                  <label className="block text-xs font-extrabold text-[#6b5c42] mb-1.5">
                    Your Answer or Comment:
                  </label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full min-h-[90px] rounded-2xl border-2 border-[#F0E9D6] p-3 font-nunito text-[15px] outline-none focus:border-accent"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={submitAnswer}
                      disabled={submitted}
                      className="border-none bg-[#4CAF7D] hover:bg-[#3d9a69] text-white px-6 py-3 rounded-2xl font-extrabold text-[15px] cursor-pointer shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                      {submitted ? 'Submitted ✅' : 'Submit ✅'}
                    </button>
                    {submitted && (
                      <button
                        onClick={() => setView('home')}
                        className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-dash-ink"
                      >
                        Return Home
                      </button>
                    )}
                  </div>
                  {doneMsg.text && (
                    <div
                      className={`mt-3 font-extrabold text-sm ${
                        doneMsg.error ? 'text-[#C9553F]' : 'text-[#3D7048]'
                      }`}
                    >
                      {doneMsg.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* MODAL: STUDENT UPLOAD ACTIVITY / ARTWORK                 */}
        {/* -------------------------------------------------------- */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 text-left shadow-2xl border border-[#F0E4CE] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📸</span>
                  <div>
                    <h3 className="font-baloo text-lg font-bold text-[#3a3226] m-0">
                      Upload My Activity or Artwork
                    </h3>
                    <p className="text-xs text-[#7a7a7a] m-0">
                      Share your drawing, coloring, or homework with Teacher!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-dash-ink font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStudentUploadSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Activity Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Family Drawing, Pineapple Coloring..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 font-bold text-[#3a3226] outline-none focus:border-coral text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Subject / Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold text-[#3a3226] outline-none focus:border-coral"
                  >
                    <option value="Colors">🎨 Colors</option>
                    <option value="Alphabet">🔤 Alphabet</option>
                    <option value="Numbers">🔢 Numbers</option>
                    <option value="Shapes">🔺 Shapes</option>
                    <option value="Animals">🐶 Animals</option>
                    <option value="Stories">📖 Stories</option>
                    <option value="General Artwork">🖍️ General Artwork / Craft</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Take Photo / Attach Artwork (Image or Video)
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-coral/10 file:text-coral-deep hover:file:bg-coral/20 cursor-pointer"
                  />
                  {uploadFilePreview && (
                    <div className="mt-2.5 relative">
                      <img
                        src={uploadFilePreview}
                        alt="Preview"
                        className="w-full max-h-48 object-cover rounded-2xl border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFilePreview(null);
                          setUploadFileName('');
                        }}
                        className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white rounded-lg text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#3a3226] mb-1">
                    Learner's Note or Story (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tell Teacher what you learned or made..."
                    value={uploadNote}
                    onChange={(e) => setUploadNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs outline-none focus:border-coral"
                  />
                </div>

                {uploadMsg.text && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold ${
                      uploadMsg.type === 'error'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {uploadMsg.text}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2.5 rounded-xl bg-coral hover:bg-coral-deep text-white font-baloo font-bold text-sm shadow-bump cursor-pointer disabled:opacity-60 transition-all"
                  >
                    {uploading ? 'Uploading...' : 'Submit to Teacher 🚀'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
