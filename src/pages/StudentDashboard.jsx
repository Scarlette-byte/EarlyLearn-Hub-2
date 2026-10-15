import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { initialTeacherModules } from '../lib/curriculumData.js';

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
  { id: 'cat-alphabet', name: 'Alphabet', icon: '🔤', tag: 'Alphabet' },
  { id: 'cat-numbers', name: 'Numbers', icon: '🔢', tag: 'Numbers' },
  { id: 'cat-colors', name: 'Colors', icon: '🎨', tag: 'Colors' },
  { id: 'cat-shapes', name: 'Shapes', icon: '🔺', tag: 'Shapes' },
  { id: 'cat-animals', name: 'Animals', icon: '🐶', tag: 'Animals' },
  { id: 'cat-stories', name: 'Stories', icon: '📖', tag: 'Stories' },
];

// Baseline initial activities (matching Image 2: "What Letter Is This?" & "Find the Color")
const BASELINE_ACTIVITIES = [
  {
    id: 'act-baseline-01',
    title: 'What Letter Is This?',
    category_id: 'cat-alphabet',
    category_name: 'Alphabet',
    type: 'activity',
    icon: '🔤',
    content_text: 'Sing the alphabet song with your parent and identify the first letter of your name! What letter is it?',
    teacher_name: 'Teacher Lovey Tion',
    created_at: '2026-10-01',
  },
  {
    id: 'act-baseline-02',
    title: 'Find the Color',
    category_id: 'cat-colors',
    category_name: 'Colors',
    type: 'activity',
    icon: '🎨',
    content_text: 'Find something in your room that has the same color as the bright Bukidnon sun (Yellow)! What item did you find?',
    teacher_name: 'Teacher Lovey Tion',
    created_at: '2026-10-02',
  },
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

  // Completed Activity IDs
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

  // Content view state
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [answer, setAnswer] = useState('');
  const [doneMsg, setDoneMsg] = useState({ text: '', error: false });
  const [submitted, setSubmitted] = useState(false);

  // Teacher-uploaded modules from localStorage & Supabase
  const [teacherUploadedModules, setTeacherUploadedModules] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      return saved ? JSON.parse(saved) : initialTeacherModules;
    } catch {
      return initialTeacherModules;
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

  // --- Load Categories from Supabase (or fallback to DEFAULT_CATEGORIES) ---
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

  // Listen to teacher uploads
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
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadAnnouncements, loadCategories, loadDbMaterials]);

  // -------------------------------------------------------------------------
  // "MY ACTIVITIES": Sourced directly from teacher-uploaded materials + baseline
  // -------------------------------------------------------------------------
  const allActivities = useMemo(() => {
    const list = [];
    const seenTitles = new Set();

    // 1. Teacher modules uploaded by teacher as 'activity'
    (teacherUploadedModules || []).forEach((m) => {
      const isActivity =
        m.module_type === 'activity' ||
        m.type === 'activity' ||
        (m.module_type && m.module_type.toLowerCase().includes('activity')) ||
        (m.file_type && m.file_type.toLowerCase().includes('activity'));

      if (isActivity && !seenTitles.has(m.title.toLowerCase())) {
        seenTitles.add(m.title.toLowerCase());
        list.push({
          id: m.id,
          title: m.title,
          category_id: m.category_id || (m.theme?.toLowerCase().includes('alphabet') ? 'cat-alphabet' : 'cat-stories'),
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

    // 2. Supabase materials where type === 'activity'
    (dbMaterials || []).forEach((m) => {
      if (m.type === 'activity' && !seenTitles.has(m.title.toLowerCase())) {
        seenTitles.add(m.title.toLowerCase());
        list.push({
          id: m.id,
          title: m.title,
          category_id: m.category_id,
          category_name: m.categories?.name || 'Class Activity',
          type: 'activity',
          icon: m.categories?.icon || '✏️',
          content_text: m.content_text || 'Complete this lesson activity.',
          content_url: m.content_url || null,
          teacher_name: m.created_by ? 'Teacher' : 'CDC Teacher',
          created_at: m.created_at,
        });
      }
    });

    // 3. Baseline activities (so the student always starts with the familiar activities in Image 2)
    BASELINE_ACTIVITIES.forEach((b) => {
      if (!seenTitles.has(b.title.toLowerCase())) {
        seenTitles.add(b.title.toLowerCase());
        list.push(b);
      }
    });

    return list;
  }, [teacherUploadedModules, dbMaterials]);

  // Pending (to-do) activities for the student
  const pendingActivities = useMemo(() => {
    return allActivities.filter((a) => !completedIds.has(a.id));
  }, [allActivities, completedIds]);

  // Count pending activities per category for the badges (e.g. "1 new")
  const pendingByCategory = useMemo(() => {
    const map = {};
    pendingActivities.forEach((a) => {
      // match by category_id or by tag/name
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
  }, [pendingActivities, categories]);

  // Progress metrics
  const totalActivitiesCount = allActivities.length || 2;
  const completedCount = allActivities.filter((a) => completedIds.has(a.id)).length;
  const progressPct = Math.min(100, Math.round((completedCount / totalActivitiesCount) * 100));

  // --- Handlers ---
  function openCategory(cat) {
    setCurrentCategory(cat);
    setView('materials');
    setMaterialsLoading(true);

    // Filter materials matching this category
    const catNameLower = cat.name.toLowerCase();
    const matching = allActivities.filter(
      (m) =>
        m.category_id === cat.id ||
        (m.category_name && m.category_name.toLowerCase().includes(catNameLower))
    );

    // Also include any other uploaded non-activity materials under this theme
    (teacherUploadedModules || []).forEach((m) => {
      const matchTheme =
        (m.theme && m.theme.toLowerCase().includes(catNameLower)) ||
        (m.sub_theme && m.sub_theme.toLowerCase().includes(catNameLower)) ||
        (m.title && m.title.toLowerCase().includes(catNameLower));
      if (matchTheme && !matching.some((item) => item.id === m.id)) {
        matching.push({
          id: m.id,
          title: m.title,
          type: m.module_type?.toLowerCase().includes('video') ? 'video' : m.module_type?.toLowerCase().includes('image') ? 'image' : 'text',
          content_text: m.description || m.content_text,
          content_url: m.content_url,
          teacher_name: m.teacher_name,
        });
      }
    });

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
      alert('Please write your answer or comment first.');
      return;
    }

    // Save to local completed set
    const updated = new Set(completedIds);
    updated.add(currentMaterial.id);
    setCompletedIds(updated);
    try {
      localStorage.setItem(`earlylearn_done_${currentUserId}`, JSON.stringify(Array.from(updated)));
    } catch {
      // ignore
    }

    // Try saving to Supabase if authenticated
    try {
      await supabase.from('submissions').insert({
        material_id: currentMaterial.id,
        student_id: currentUserId,
        answer_text: trimmed,
      });
    } catch {
      // ignore
    }

    setDoneMsg({ text: '🎉 Nice! Your answer has been submitted to your teacher!', error: false });
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen font-nunito text-[#3a3226] bg-[#FFF8EB] sm:bg-gradient-to-b sm:from-[#FFF6DA] sm:to-[#FFEFC2]">
      <div className="max-w-[620px] mx-auto px-4.5 sm:px-5 pt-6 pb-16 text-center">
        {/* HEADER BAR (Exact match to Image 2) */}
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
            {/* 📝 MY ACTIVITIES SECTION (Directly from Teacher Uploads) */}
            {/* -------------------------------------------------------- */}
            <div className="mb-5.5">
              <div className="text-xs font-extrabold text-[#6b5c42] text-left mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📝</span> My Activities
                </span>
                {pendingActivities.length > 0 && (
                  <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2 py-0.5 rounded-full">
                    {pendingActivities.length} to do
                  </span>
                )}
              </div>

              {pendingActivities.length === 0 ? (
                <div className="bg-white rounded-2xl p-5 text-center shadow-soft border border-[#F0E4CE]">
                  <div className="text-2xl mb-1">🎉</div>
                  <div className="font-baloo font-bold text-base text-[#3a3226]">
                    All Activities Complete!
                  </div>
                  <div className="text-xs text-[#7a7a7a] mt-0.5">
                    Great job! Check back later when your teacher uploads new activities.
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingActivities.map((a) => (
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

            {/* -------------------------------------------------------- */}
            {/* 6 COLORFUL CATEGORY BUTTONS (Exact Match to Image 2)      */}
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
            {/* ⭐ MY PROGRESS SECTION (Exact Match to Image 2)           */}
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
                🌟 {completedCount} of {totalActivitiesCount} activities done!
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
      </div>
    </div>
  );
}
