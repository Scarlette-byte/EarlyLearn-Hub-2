import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  preK1Curriculum,
  preK2Curriculum,
  initialTeacherModules,
} from '../lib/curriculumData.js';

const TYPE_ICONS = {
  video: '🎬',
  image: '🖼️',
  text: '📖',
  activity: '✏️',
};

export default function StudentDashboard({ profile }) {
  const navigate = useNavigate();
  const currentUserId = profile?.id;

  const [view, setView] = useState('home'); // home | content
  const [backTarget, setBackTarget] = useState('home');
  const [greetingName] = useState(profile?.full_name || 'Friend');

  // Curriculum Level & Quarter state
  const [selectedLevel, setSelectedLevel] = useState('PRE-K1'); // 'PRE-K1' (3.11) | 'PRE-K2' (4.11)
  const [selectedQuarter, setSelectedQuarter] = useState(1);

  // Curriculum data & Teacher-uploaded materials
  const [announcements, setAnnouncements] = useState([]);
  const [completedIds, setCompletedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`earlylearn_done_${currentUserId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [teacherModules, setTeacherModules] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      return saved ? JSON.parse(saved) : initialTeacherModules;
    } catch {
      return initialTeacherModules;
    }
  });

  const [dbMaterials, setDbMaterials] = useState([]);

  // Active Material view state
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [answer, setAnswer] = useState('');
  const [doneMsg, setDoneMsg] = useState({ text: '', error: false });
  const [submitted, setSubmitted] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  // --- Load Announcements ---
  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('title, message, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    setAnnouncements(!error && data ? data : []);
  }, []);

  // --- Load Supabase Materials ---
  const loadDbMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*, categories(name, icon)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (!error && data) setDbMaterials(data);
  }, []);

  // --- Load Submissions ---
  const loadSubmissions = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from('submissions')
      .select('material_id')
      .eq('student_id', currentUserId);

    let localDone = [];
    try {
      const saved = localStorage.getItem(`earlylearn_done_${currentUserId}`);
      if (saved) localDone = JSON.parse(saved);
    } catch {
      // Ignored
    }

    const set = new Set([...(data || []).map((s) => s.material_id), ...localDone]);
    setCompletedIds(set);
  }, [currentUserId]);

  useEffect(() => {
    loadAnnouncements();
    loadDbMaterials();
    loadSubmissions();
  }, [loadAnnouncements, loadDbMaterials, loadSubmissions]);

  // Combined Teacher Uploaded Activities mapped to Curriculum Guide
  const allCurriculumMaterials = useMemo(() => {
    // 1. Process modules from teacherModules
    const teacherMods = (teacherModules || []).map((m) => ({
      id: m.id,
      title: m.title,
      level: m.level?.toUpperCase().includes('PRE-K2') ? 'PRE-K2' : 'PRE-K1',
      quarter: m.quarter || 1,
      week: m.week || 'Week 1',
      sub_theme: m.sub_theme || '',
      theme: m.theme || '',
      type: m.module_type?.toLowerCase().includes('video') ? 'video' : m.module_type?.toLowerCase().includes('worksheet') ? 'activity' : 'activity',
      formatLabel: m.module_type || 'Activity Worksheet',
      teacher_name: m.teacher_name || 'Child Development Teacher',
      cdc_name: m.cdc_name || 'Child Development Center',
      barangay: m.barangay || profile?.barangay || 'Manolo Fortich',
      content_url: m.content_url || null,
      content_text: m.description || m.content_text || '',
    }));

    // 2. Process Supabase materials
    const sbMats = (dbMaterials || []).map((m) => {
      const tagMatch = m.title?.match(/\[(Pre-K1|Pre-K2)?\s*Q?(\d+)?\s*(W[^\s\]]+|Week\s*[\d&]+)?\]/i);
      const parsedLevel = tagMatch?.[1]?.toUpperCase() || (m.age_range?.includes('3') ? 'PRE-K1' : 'PRE-K2');
      const parsedQuarter = tagMatch?.[2] ? parseInt(tagMatch[2], 10) : 1;
      const parsedWeek = tagMatch?.[3]
        ? (tagMatch[3].startsWith('W') && !tagMatch[3].startsWith('Week') ? `Week ${tagMatch[3].slice(1)}` : tagMatch[3])
        : 'Week 1';

      return {
        id: m.id,
        title: m.title,
        level: parsedLevel,
        quarter: parsedQuarter,
        week: parsedWeek,
        sub_theme: '',
        theme: m.categories?.name || 'Curriculum Lesson',
        type: m.type || 'activity',
        formatLabel: m.type === 'activity' ? 'Activity Worksheet' : m.type === 'video' ? 'Video Lesson' : m.type === 'image' ? 'Worksheet' : 'Story',
        teacher_name: 'Child Development Teacher',
        cdc_name: profile?.barangay ? `${profile.barangay} Child Development Center` : 'Child Development Center',
        barangay: profile?.barangay || 'Manolo Fortich',
        content_url: m.content_url,
        content_text: m.content_text,
      };
    });

    // Merge ensuring uniqueness
    const seen = new Set();
    const list = [];
    [...teacherMods, ...sbMats].forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    });

    return list;
  }, [teacherModules, dbMaterials, profile?.barangay]);

  // Current Quarter Curriculum Data
  const currentCurriculum = selectedLevel === 'PRE-K1' ? preK1Curriculum : preK2Curriculum;
  const currentQuarterObj = useMemo(() => {
    return currentCurriculum.find((q) => q.quarterNumber === selectedQuarter) || currentCurriculum[0];
  }, [currentCurriculum, selectedQuarter]);

  // Filter activities for "My Activities" to-do list (Level, Quarter, Not Yet Completed)
  const pendingActivities = useMemo(() => {
    return allCurriculumMaterials.filter((m) => {
      const matchLevel = m.level === selectedLevel;
      const matchQuarter = m.quarter === selectedQuarter;
      const isPending = !completedIds.has(m.id);
      return matchLevel && matchQuarter && isPending;
    });
  }, [allCurriculumMaterials, selectedLevel, selectedQuarter, completedIds]);

  // Total activities in this quarter vs completed
  const totalInQuarter = useMemo(() => {
    return allCurriculumMaterials.filter(
      (m) => m.level === selectedLevel && m.quarter === selectedQuarter
    ).length;
  }, [allCurriculumMaterials, selectedLevel, selectedQuarter]);

  const completedInQuarter = useMemo(() => {
    return allCurriculumMaterials.filter(
      (m) => m.level === selectedLevel && m.quarter === selectedQuarter && completedIds.has(m.id)
    ).length;
  }, [allCurriculumMaterials, selectedLevel, selectedQuarter, completedIds]);

  const progressPct = totalInQuarter > 0 ? Math.round((completedInQuarter / totalInQuarter) * 100) : 0;

  function openMaterial(m, from = 'home') {
    setBackTarget(from);
    setCurrentMaterial(m);
    setAnswer('');
    setDoneMsg({ text: '', error: false });
    setSubmitted(completedIds.has(m.id));
    setView('content');
  }

  async function submitAnswer() {
    const trimmed = answer.trim();
    if (!trimmed && currentMaterial?.type === 'activity') {
      alert('Please share your answer or response to Teacher first.');
      return;
    }

    try {
      await supabase.from('submissions').insert({
        material_id: currentMaterial.id,
        student_id: currentUserId,
        answer_text: trimmed || 'Completed with parent guidance.',
      });
    } catch (err) {
      console.warn('Note on Supabase submission insert:', err);
    }

    // Save locally
    const newSet = new Set(completedIds);
    newSet.add(currentMaterial.id);
    setCompletedIds(newSet);
    try {
      localStorage.setItem(`earlylearn_done_${currentUserId}`, JSON.stringify(Array.from(newSet)));
    } catch {
      // Ignored
    }

    setDoneMsg({ text: '🎉 Wonderful job! Your activity has been submitted to your Teacher!', error: false });
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen font-nunito text-[#3a3226] bg-gradient-to-b from-[#FFF6DA] to-[#FFEFC2]">
      <div className="max-w-[680px] mx-auto px-4.5 pt-6 pb-16 text-center">
        {/* Header Bar */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="font-baloo text-2xl font-bold m-0 text-left">
              👋 Hi, {profile?.full_name?.includes('(Parent:') ? profile.full_name.split(' (Parent:')[0] : greetingName}!
            </p>
            <p className="text-[13px] text-[#6b5c42] mt-0.5 text-left flex items-center gap-1.5 flex-wrap">
              {profile?.full_name?.includes('(Parent:') && (
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-coral/20 text-coral-deep text-[11px] font-black">
                  👨‍👩‍👧 Guided by {profile.full_name.split(' (Parent:')[1]?.replace(')', '')}
                </span>
              )}
              {profile?.barangay && (
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-sun/40 text-[#6B5313] text-[11px] font-black">
                  📍 Brgy. {profile.barangay}
                </span>
              )}
              <span>ECCD Curriculum Learning</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="border-none bg-white rounded-2xl px-4 py-2 font-extrabold text-[12.5px] text-[#C9553F] cursor-pointer shadow-flat hover:bg-slate-50 transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* Parent-Assisted Mode Tip for 3-4 year olds */}
        {view === 'home' && (
          <div className="bg-white/85 rounded-2xl p-3.5 text-left mb-4 border border-[#F0E4CE] shadow-xs flex items-center gap-3 text-xs text-[#6B5C42]">
            <span className="text-2xl">🌟</span>
            <div>
              <span className="font-extrabold text-[#943535]">
                Parent Guided Mode ({selectedLevel === 'PRE-K1' ? 'Pre-K 1: 3.11 years old' : 'Pre-K 2: 4.11 years old'}):{' '}
              </span>
              <span>
                Activities are uploaded directly by your Child Development Teacher aligned with the official DepEd ECCD weekly curriculum guide.
              </span>
            </div>
          </div>
        )}

        {/* HOME VIEW */}
        {view === 'home' && (
          <div className="space-y-4">
            {/* Level & Quarter Selector */}
            <div className="bg-white rounded-2xl p-3.5 shadow-soft border border-[#F0E4CE] text-left space-y-3">
              {/* Level Selector */}
              <div>
                <label className="text-xs font-bold text-[#8C7F63] block mb-1.5 uppercase tracking-wider">
                  Select Learning Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLevel('PRE-K1')}
                    className={`py-2 px-3 rounded-xl font-baloo font-bold text-xs transition-all cursor-pointer text-center ${
                      selectedLevel === 'PRE-K1'
                        ? 'bg-[#2E6B38] text-white shadow-xs'
                        : 'bg-[#F4EFE6] text-[#6B5C42] hover:bg-[#EAE2D5]'
                    }`}
                  >
                    PRE-K 1 (3.11 years old)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLevel('PRE-K2')}
                    className={`py-2 px-3 rounded-xl font-baloo font-bold text-xs transition-all cursor-pointer text-center ${
                      selectedLevel === 'PRE-K2'
                        ? 'bg-[#1E5B94] text-white shadow-xs'
                        : 'bg-[#F4EFE6] text-[#6B5C42] hover:bg-[#EAE2D5]'
                    }`}
                  >
                    PRE-K 2 (4.11 years old)
                  </button>
                </div>
              </div>

              {/* Quarter Selector */}
              <div>
                <label className="text-xs font-bold text-[#8C7F63] block mb-1.5 uppercase tracking-wider">
                  Academic Quarter
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { q: 1, label: 'Quarter 1', theme: 'Self-Identity' },
                    { q: 2, label: 'Quarter 2', theme: 'Family & Me' },
                    { q: 3, label: 'Quarter 3', theme: 'Community' },
                    { q: 4, label: 'Quarter 4', theme: 'World & Weather' },
                  ].map((qObj) => (
                    <button
                      key={qObj.q}
                      type="button"
                      onClick={() => setSelectedQuarter(qObj.q)}
                      className={`p-2 rounded-xl text-center transition-all cursor-pointer border ${
                        selectedQuarter === qObj.q
                          ? 'border-accent bg-[#FFF5EE] text-accent font-bold shadow-xs'
                          : 'border-transparent bg-[#FAF5EB] text-slate-700 hover:bg-[#F2EAE0]'
                      }`}
                    >
                      <div className="text-xs font-bold">{qObj.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{qObj.theme}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div className="text-left">
                <div className="text-xs font-extrabold text-[#6b5c42] mb-1.5">📢 Announcements</div>
                {announcements.map((a, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl px-4 py-3 text-left mb-2 shadow-soft border-l-[5px] border-[#FFB84D]"
                  >
                    <div className="font-baloo font-bold text-[14px] text-slate-900">{a.title}</div>
                    <div className="text-[12.5px] text-[#6b6355] mt-0.5">{a.message}</div>
                  </div>
                ))}
              </div>
            )}

            {/* MY ACTIVITIES: Based on Curriculum Guide Uploaded by the Teacher */}
            <div className="text-left space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold text-[#6b5c42] flex items-center gap-1.5">
                  <span>📝 My Activities</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    (Curriculum Guide assigned by Teacher)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-accent">
                  Quarter {selectedQuarter} • {pendingActivities.length} to do
                </span>
              </div>

              {pendingActivities.length > 0 ? (
                <div className="space-y-2">
                  {pendingActivities.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => openMaterial(a, 'home')}
                      className="bg-white rounded-2xl p-4 text-left shadow-soft hover:shadow-md transition-all flex items-start gap-3.5 cursor-pointer border-l-[6px] border-leaf group"
                    >
                      <div className="text-3xl shrink-0 mt-0.5">
                        {TYPE_ICONS[a.type] || '✏️'}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Curriculum Tag */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="inline-block bg-[#FAF3E8] border border-[#E8DFC9] px-2 py-0.5 rounded-md text-[10.5px] font-bold text-[#5C5036]">
                            Quarter {a.quarter} • {a.week}
                          </span>
                          {a.sub_theme && (
                            <span className="text-[11px] font-semibold text-amber-900 truncate">
                              • {a.sub_theme}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div className="font-baloo font-bold text-[15px] text-slate-900 group-hover:text-accent transition-colors">
                          {a.title}
                        </div>

                        {/* Teacher attribution */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                          <span>👩‍🏫 Uploaded by {a.teacher_name}</span>
                          <span className="text-slate-400">({a.cdc_name})</span>
                        </div>
                      </div>

                      <div className="shrink-0 self-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F0F8F1] text-[#2E6B38] text-xs font-bold border border-[#D5EAD8] group-hover:bg-[#2E6B38] group-hover:text-white transition-colors">
                          Start ➔
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-5 text-center shadow-soft border border-[#F0E4CE]">
                  <div className="text-3xl mb-1">🎉</div>
                  <div className="font-baloo font-bold text-base text-slate-900">
                    All Activities for Quarter {selectedQuarter} Complete!
                  </div>
                  <p className="text-xs text-slate-500 mt-1 mb-0">
                    Explore the weekly curriculum lessons below to review today's theme with your teacher.
                  </p>
                </div>
              )}
            </div>

            {/* CURRICULUM GUIDE WEEKLY LESSONS EXPLORER (Replaces old category grid) */}
            <div className="text-left space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-[#6b5c42]">
                    📖 Weekly Curriculum Lessons &amp; Activities
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Focus: <strong className="text-amber-950 uppercase">{currentQuarterObj.theme}</strong> ({currentQuarterObj.month})
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {currentQuarterObj.weeks.length} Weeks in Q{selectedQuarter}
                </span>
              </div>

              <div className="space-y-2.5">
                {currentQuarterObj.weeks.map((w, wIdx) => {
                  // Find all teacher materials matching this week and quarter
                  const weekMaterials = allCurriculumMaterials.filter(
                    (m) =>
                      m.level === selectedLevel &&
                      m.quarter === selectedQuarter &&
                      m.week.toLowerCase().includes(w.week.toLowerCase().replace('&', '').trim())
                  );

                  return (
                    <div
                      key={w.week + wIdx}
                      className="bg-white rounded-2xl p-4 shadow-soft border border-card-border space-y-2.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                              {w.week}
                            </span>
                            <span className="font-baloo font-bold text-[14.5px] text-slate-900">
                              {w.subTheme}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            <strong className="text-[#8C7F63]">DepEd ECCD Activity:</strong> {w.suggestedActivities}
                          </div>
                        </div>

                        <span className="text-[11px] font-bold text-accent shrink-0">
                          {weekMaterials.length} {weekMaterials.length === 1 ? 'Activity' : 'Activities'}
                        </span>
                      </div>

                      {/* Teacher Uploaded Activities for this specific week */}
                      {weekMaterials.length > 0 ? (
                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          {weekMaterials.map((mat) => {
                            const isDone = completedIds.has(mat.id);
                            return (
                              <div
                                key={mat.id}
                                onClick={() => openMaterial(mat, 'home')}
                                className="p-2.5 rounded-xl bg-[#FFFDF8] hover:bg-[#FAF4EB] border border-[#EFE5D2] flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-xl shrink-0">
                                    {TYPE_ICONS[mat.type] || '✏️'}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs text-slate-900 truncate">
                                      {mat.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {mat.teacher_name} • {mat.cdc_name}
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 ${
                                    isDone
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {isDone ? 'Completed ✅' : 'Open ➔'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="pt-1 text-[11px] text-slate-400 italic">
                          Lesson prepared by CDC Teacher for this week.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress Card */}
            <div className="bg-white rounded-[20px] px-5 py-4 shadow-soft text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#6b5c42] font-extrabold">
                  ⭐ Quarter {selectedQuarter} Curriculum Progress
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {completedInQuarter} of {totalInQuarter} Activities Completed
                </span>
              </div>
              <div className="bg-[#F0E9D6] rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #FFB84D, #4CAF7D)',
                  }}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-600 text-center">
                {progressPct === 100
                  ? '🌟 Amazing! All Quarter ' + selectedQuarter + ' activities finished!'
                  : `🎯 Keep going! ${totalInQuarter - completedInQuarter} activities remaining in Quarter ${selectedQuarter}.`}
              </div>
            </div>
          </div>
        )}

        {/* CONTENT / ACTIVITY VIEW */}
        {view === 'content' && currentMaterial && (
          <div>
            <button
              onClick={() => setView(backTarget)}
              className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4 hover:bg-slate-50 transition-colors"
            >
              ⬅ Back to Lessons
            </button>

            <div className="bg-white rounded-[20px] p-6 text-left shadow-soft space-y-4">
              {/* Curriculum Badge */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs">
                  {currentMaterial.level} • Quarter {currentMaterial.quarter}, {currentMaterial.week}
                </span>
                {currentMaterial.sub_theme && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs">
                    {currentMaterial.sub_theme}
                  </span>
                )}
              </div>

              {/* Activity Title */}
              <h2 className="font-baloo text-2xl font-bold text-slate-900 m-0 leading-snug">
                {currentMaterial.title}
              </h2>

              {/* Teacher attribution */}
              <div className="text-xs text-slate-500 border-b border-slate-100 pb-3 flex items-center gap-1.5 flex-wrap">
                <span>👩‍🏫 Assigned by {currentMaterial.teacher_name}</span>
                <span>•</span>
                <span>{currentMaterial.cdc_name}</span>
              </div>

              {/* Video Player */}
              {currentMaterial.type === 'video' && currentMaterial.content_url && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-black">
                  <iframe
                    title={currentMaterial.title}
                    src={currentMaterial.content_url.replace('watch?v=', 'embed/')}
                    className="w-full h-full border-none"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Image / Worksheet */}
              {currentMaterial.type === 'image' && currentMaterial.content_url && (
                <img
                  src={currentMaterial.content_url}
                  alt={currentMaterial.title}
                  className="w-full rounded-2xl border border-slate-200"
                />
              )}

              {/* Instructions or Story Content */}
              <div className="bg-[#FFFDF8] rounded-2xl p-4 border border-[#F0E4CE] text-sm text-slate-800 leading-relaxed space-y-2">
                <div className="font-bold text-xs text-accent uppercase tracking-wider">
                  Activity Guide &amp; Instructions:
                </div>
                <p className="m-0 text-slate-700 whitespace-pre-line">
                  {currentMaterial.content_text ||
                    'Listen to your teacher and follow the instructions to complete this weekly lesson.'}
                </p>
              </div>

              {/* Submission Area */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Learner / Parent Response:
                </label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer, words learned, or child's reaction..."
                  className="w-full min-h-[90px] rounded-2xl border-2 border-[#F0E9D6] p-3 font-nunito text-[14px] text-slate-800 outline-none focus:border-accent"
                />

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={submitAnswer}
                    disabled={submitted}
                    className="border-none bg-[#2E6B38] hover:bg-[#25572D] text-white px-6 py-2.5 rounded-2xl font-extrabold text-[14px] cursor-pointer shadow-flat disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitted ? 'Submitted Already ✅' : 'Submit Response ✅'}
                  </button>

                  {submitted && (
                    <span className="text-xs font-bold text-emerald-800">
                      Activity Completed!
                    </span>
                  )}
                </div>

                {doneMsg.text && (
                  <div
                    className={`mt-3 p-3 rounded-xl font-bold text-xs ${
                      doneMsg.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {doneMsg.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
