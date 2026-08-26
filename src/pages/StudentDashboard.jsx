import { useEffect, useState, useCallback } from 'react';
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

const TYPE_ICONS = { video: '🎬', image: '🖼️', text: '📖', activity: '✏️' };

export default function StudentDashboard({ profile }) {
  const navigate = useNavigate();
  const currentUserId = profile.id;

  const [view, setView] = useState('home'); // home | materials | content
  const [backTarget, setBackTarget] = useState('home');

  const [greetingName] = useState(profile.full_name || 'Friend');

  const [announcements, setAnnouncements] = useState([]);
  const [pendingActivities, setPendingActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingByCategory, setPendingByCategory] = useState({});

  const [currentCategory, setCurrentCategory] = useState(null);
  const [categoryMaterials, setCategoryMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [answer, setAnswer] = useState('');
  const [doneMsg, setDoneMsg] = useState({ text: '', error: false });
  const [submitted, setSubmitted] = useState(false);

  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState('🌟 Loading...');

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

  // --- Load "My Activities" to-do list ---
  const loadPendingActivities = useCallback(async () => {
    const { data: activities, error } = await supabase
      .from('materials')
      .select('*, categories(name, icon)')
      .eq('type', 'activity')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const { data: mySubs } = await supabase
      .from('submissions')
      .select('material_id')
      .eq('student_id', currentUserId);

    const submittedIds = new Set((mySubs || []).map((s) => s.material_id));

    if (error || !activities) {
      setPendingActivities([]);
      return;
    }
    setPendingActivities(activities.filter((a) => !submittedIds.has(a.id)));
  }, [currentUserId]);

  // --- Load categories + pending count per category ---
  const loadCategories = useCallback(async () => {
    const { data: cats, error } = await supabase.from('categories').select('*').order('created_at');
    if (error || !cats) {
      setCategories([]);
      return;
    }

    const { data: activities } = await supabase
      .from('materials')
      .select('id, category_id')
      .eq('type', 'activity')
      .eq('status', 'approved');
    const { data: mySubs } = await supabase
      .from('submissions')
      .select('material_id')
      .eq('student_id', currentUserId);
    const submittedIds = new Set((mySubs || []).map((s) => s.material_id));

    const pendingMap = {};
    cats.forEach((c) => {
      pendingMap[c.id] = (activities || []).filter(
        (a) => a.category_id === c.id && !submittedIds.has(a.id)
      ).length;
    });

    setCategories(cats);
    setPendingByCategory(pendingMap);
  }, [currentUserId]);

  async function openCategory(category) {
    setCurrentCategory(category);
    setView('materials');
    setMaterialsLoading(true);
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('category_id', category.id)
      .eq('status', 'approved')
      .order('created_at');
    setMaterialsLoading(false);
    setCategoryMaterials(!error && data ? data : []);
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
      alert('Please write your answer first.');
      return;
    }
    const { error } = await supabase.from('submissions').insert({
      material_id: currentMaterial.id,
      student_id: currentUserId,
      answer_text: trimmed,
    });
    if (error) {
      setDoneMsg({ text: '❌ ' + error.message, error: true });
    } else {
      setDoneMsg({ text: '🎉 Nice! Your answer has been submitted!', error: false });
      setSubmitted(true);
      loadProgress();
      loadCategories();
      loadPendingActivities();
    }
  }

  const loadProgress = useCallback(async () => {
    const { data: activities } = await supabase
      .from('materials')
      .select('id')
      .eq('type', 'activity')
      .eq('status', 'approved');
    const { data: mySubs } = await supabase
      .from('submissions')
      .select('id')
      .eq('student_id', currentUserId);

    const total = (activities || []).length;
    const done = (mySubs || []).length;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    setProgressPct(pct);
    setProgressText(total > 0 ? `🌟 ${done} of ${total} activities done!` : '🌟 No activities yet');
  }, [currentUserId]);

  useEffect(() => {
    loadCategories();
    loadProgress();
    loadAnnouncements();
    loadPendingActivities();
  }, [loadCategories, loadProgress, loadAnnouncements, loadPendingActivities]);

  return (
    <div className="min-h-screen font-nunito text-[#3a3226] bg-gradient-to-b from-[#FFF6DA] to-[#FFEFC2]">
      <div className="max-w-[600px] mx-auto px-5 pt-6 pb-16 text-center">
        <div className="flex justify-between items-center mb-4.5">
          <div>
            <p className="font-baloo text-2xl font-bold m-0 text-left">👋 Hi, {greetingName}!</p>
            <p className="text-[15px] text-[#6b5c42] mt-0.5 text-left">Choose what you'd like to learn</p>
          </div>
          <button
            onClick={handleLogout}
            className="border-none bg-white rounded-2xl px-4 py-2.5 font-extrabold text-[13px] text-[#C9553F] cursor-pointer shadow-flat"
          >
            Log Out
          </button>
        </div>

        {/* HOME VIEW */}
        {view === 'home' && (
          <div>
            {announcements.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-extrabold text-[#6b5c42] text-left mb-2">
                  📢 Announcements
                </div>
                {announcements.map((a, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl px-4.5 py-3.5 text-left mb-2.5 shadow-soft border-l-[5px] border-[#FFB84D]"
                  >
                    <div className="font-baloo font-bold text-[14.5px] mb-0.5">{a.title}</div>
                    <div className="text-[13px] text-[#6b6355]">{a.message}</div>
                  </div>
                ))}
              </div>
            )}

            {pendingActivities.length > 0 && (
              <div className="mb-5.5">
                <div className="text-xs font-extrabold text-[#6b5c42] text-left mb-2">
                  📝 My Activities
                </div>
                {pendingActivities.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => openMaterial(a, 'home')}
                    className="bg-white rounded-2xl px-4 py-3.5 text-left mb-2.5 shadow-soft flex items-center gap-3 cursor-pointer border-l-[5px] border-leaf"
                  >
                    <div className="text-3xl flex-shrink-0">{a.categories?.icon || '✏️'}</div>
                    <div>
                      <div className="font-baloo font-bold text-[15px] text-[#3a3226]">{a.title}</div>
                      <div className="text-[11.5px] text-[#7a7a7a] font-bold">
                        {a.categories?.name || ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3.5 my-5.5">
              {categories.map((c, i) => {
                const count = pendingByCategory[c.id] || 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => openCategory(c)}
                    className={`relative border-none rounded-[24px] py-6.5 px-2 flex flex-col items-center gap-2.5 font-baloo font-bold text-base text-white cursor-pointer shadow-bump transition-transform active:translate-y-1 active:shadow-bump-active ${PALETTES[i % PALETTES.length]}`}
                  >
                    {count > 0 && (
                      <span className="absolute top-1.5 right-2.5 bg-[#E8483D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border-2 border-white">
                        {count} new
                      </span>
                    )}
                    <div className="text-[56px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)]">{c.icon}</div>
                    {c.name}
                  </button>
                );
              })}
            </div>

            <div className="bg-white rounded-[20px] px-5.5 py-4 shadow-soft mt-2.5">
              <div className="text-xs text-[#6b5c42] font-extrabold mb-2 text-left">⭐ My Progress</div>
              <div className="bg-[#F0E9D6] rounded-[20px] h-4 overflow-hidden">
                <div
                  className="h-full rounded-[20px] transition-[width] duration-300"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #FFB84D, #FF8C69)',
                  }}
                />
              </div>
              <div className="mt-2 text-[15px] font-bold">{progressText}</div>
            </div>
          </div>
        )}

        {/* MATERIALS LIST VIEW */}
        {view === 'materials' && (
          <div>
            <button
              onClick={() => setView('home')}
              className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4"
            >
              ⬅ Back
            </button>
            <div className="flex flex-col gap-3">
              {materialsLoading && (
                <div className="text-[15px] text-[#6b6355] p-7">Loading...</div>
              )}
              {!materialsLoading && categoryMaterials.length === 0 && (
                <div className="text-[15px] text-[#6b6355] p-7">
                  Nothing here yet. Check back later! 😊
                </div>
              )}
              {!materialsLoading &&
                categoryMaterials.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => openMaterial(m, 'materials')}
                    className="bg-white rounded-[20px] p-4.5 text-left shadow-soft cursor-pointer flex items-center gap-3.5"
                  >
                    <div className="text-4xl flex-shrink-0">{TYPE_ICONS[m.type] || '📄'}</div>
                    <div>
                      <div className="font-baloo font-bold text-[19px]">{m.title}</div>
                      <div className="text-[12.5px] text-[#7a7a7a] font-bold uppercase">{m.type}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* CONTENT VIEW */}
        {view === 'content' && currentMaterial && (
          <div>
            <button
              onClick={() => setView(backTarget)}
              className="border-none bg-white rounded-2xl px-4.5 py-2.5 font-extrabold text-sm text-[#3a3226] cursor-pointer shadow-flat mb-4"
            >
              ⬅ Back
            </button>
            <div className="bg-white rounded-[20px] p-6 text-left shadow-soft">
              <h2 className="font-baloo text-2xl m-0 mb-3.5">{currentMaterial.title}</h2>

              {currentMaterial.type === 'video' && currentMaterial.content_url && (
                <video
                  controls
                  src={currentMaterial.content_url}
                  className="w-full rounded-2xl aspect-video border-none"
                />
              )}

              {currentMaterial.type === 'image' && currentMaterial.content_url && (
                <img
                  src={currentMaterial.content_url}
                  alt={currentMaterial.title}
                  className="w-full rounded-2xl"
                />
              )}

              {currentMaterial.type === 'text' && (
                <p className="text-[19px] leading-[1.7]">{currentMaterial.content_text || ''}</p>
              )}

              {currentMaterial.type === 'activity' && (
                <>
                  <p className="text-[19px] leading-[1.7]">
                    {currentMaterial.content_text || 'Answer this:'}
                  </p>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full min-h-[80px] rounded-2xl border-2 border-[#F0E9D6] p-3 font-nunito text-[15px] mt-2.5"
                  />
                  <br />
                  <button
                    onClick={submitAnswer}
                    disabled={submitted}
                    className="mt-3 border-none bg-[#4CAF7D] text-white px-6 py-3 rounded-2xl font-extrabold text-[15px] cursor-pointer shadow-[0_4px_0_rgba(0,0,0,0.1)] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Submit ✅
                  </button>
                  {doneMsg.text && (
                    <div
                      className={`mt-2.5 font-extrabold ${
                        doneMsg.error ? 'text-[#C9553F]' : 'text-[#3D7048]'
                      }`}
                    >
                      {doneMsg.text}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
