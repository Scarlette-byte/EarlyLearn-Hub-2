import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { barangays } from '../lib/supabaseClient';

// Sound helper using Web Audio API for playful micro-interactions without external audio files
function playChime(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'success') {
      // Cheerful ascending major triad (C5 - E5 - G5 - C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.3);
      });
    } else if (type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch {
    // Gracefully ignore audio restrictions if browser blocks autoplay audio
  }
}

// Optional text-to-speech helper for the interactive phonics cards
function speakWord(text) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // Ignore if not supported
  }
}

export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Demo State
  const [demoTab, setDemoTab] = useState('alphabet'); // 'alphabet' | 'colors' | 'nature'
  const [activeLetter, setActiveLetter] = useState('A');
  const [selectedColor, setSelectedColor] = useState(null);
  const [starCount, setStarCount] = useState(12);
  const [celebrationMsg, setCelebrationMsg] = useState('Click any card to play & learn!');

  // Role showcase state
  const [activeRole, setActiveRole] = useState('student');

  // Barangay filter search
  const [barangaySearch, setBarangaySearch] = useState('');
  const [activeBarangay, setActiveBarangay] = useState('Tankulan (Poblacion)');

  // FAQ open accordion state
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 25) {
        setNavScrolled(true);
      } else {
        setNavScrolled(false);
      }
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Demo letters data
  const alphabetData = {
    A: { word: 'Apple', icon: '🍎', desc: 'A is for sweet, crisp red Apple!', color: 'bg-coral text-white' },
    B: { word: 'Butterfly', icon: '🦋', desc: 'B is for gentle, colorful Butterfly fluttering in the garden!', color: 'bg-sky-deep text-white' },
    C: { word: 'Carabao', icon: '🐃', desc: 'C is for Carabao, the hardworking friend of Bukidnon farmers!', color: 'bg-[#5B8E7D] text-white' },
    P: { word: 'Pineapple', icon: '🍍', desc: 'P is for delicious Pineapple harvested from Manolo Fortich hills!', color: 'bg-sun text-[#4A3F1A]' },
    S: { word: 'Sunflower', icon: '🌻', desc: 'S is for bright Sunflower shining with the morning sun!', color: 'bg-orange text-white' },
  };

  // Demo colors data
  const colorsData = [
    { name: 'Sunshine Yellow', color: '#FFD93D', textColor: '#4A3F1A', hint: 'Like the bright morning sun over Bukidnon!' },
    { name: 'Leafy Green', color: '#6BCB77', textColor: '#FFFFFF', hint: 'Like the rolling pine and corn fields!' },
    { name: 'Sky Blue', color: '#3FA9F5', textColor: '#FFFFFF', hint: 'Like the clear blue skies above Mt. Kitanglad!' },
    { name: 'Coral Red', color: '#FF6B6B', textColor: '#FFFFFF', hint: 'Like sweet strawberries and wild blossoms!' },
  ];

  // Bukidnon landmarks data
  const natureData = [
    { name: 'Dahilayan Adventure Hills', icon: '🌲', tag: 'Pine Forests & Cool Air', desc: 'Where pine trees whisper and young adventurers explore mountain trails.' },
    { name: 'Manolo Pineapple Plateaus', icon: '🍍', tag: 'Vast Green Valleys', desc: 'The golden sweet pineapples grown across our rich volcanic soil.' },
    { name: 'Mt. Kitanglad Wildlife', icon: '🦅', tag: 'Philippine Eagle Sanctuary', desc: 'Home to majestic eagles and colorful endemic birds of Bukidnon.' },
    { name: 'Barangay Day Care Centers', icon: '🏫', tag: 'Safe Community Spaces', desc: '22 barangay learning centers where little friends share and grow together.' },
  ];

  function handleLetterClick(key) {
    setActiveLetter(key);
    playChime('pop');
    const item = alphabetData[key];
    speakWord(`${key} is for ${item.word}`);
    setCelebrationMsg(`Awesome! You explored letter ${key}! 🌟`);
  }

  function handleColorClick(colorItem) {
    setSelectedColor(colorItem.name);
    playChime('success');
    setStarCount((prev) => prev + 1);
    setCelebrationMsg(`Hooray! You chose ${colorItem.name}! +1 Star ⭐`);
    speakWord(colorItem.name);
  }

  const filteredBarangays = barangays.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-ink font-nunito selection:bg-sun selection:text-ink">
      {/* ---------------------------------------------------- */}
      {/* TOP NAVIGATION BAR                                  */}
      {/* ---------------------------------------------------- */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navScrolled
            ? 'bg-cream/95 backdrop-blur-md shadow-sm border-b border-[#F0E6D2] py-2.5'
            : 'bg-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sun to-coral flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-105">
              🌻
            </div>
            <div>
              <span className="font-baloo text-2xl font-extrabold text-ink tracking-tight block leading-tight">
                EarlyLearn Hub
              </span>
              <span className="text-[11px] font-bold text-ink-soft uppercase tracking-wider block">
                Manolo Fortich, Bukidnon
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 font-bold text-sm text-ink-soft">
            <a href="#features" className="hover:text-coral transition-colors no-underline">
              Features
            </a>
            <a href="#curriculum" className="hover:text-coral transition-colors no-underline">
              Curriculum
            </a>
            <a href="#demo" className="hover:text-coral transition-colors no-underline">
              Interactive Demo
            </a>
            <a href="#roles" className="hover:text-coral transition-colors no-underline">
              For Schools
            </a>
            <a href="#barangays" className="hover:text-coral transition-colors no-underline">
              Barangays
            </a>
            <a href="#faq" className="hover:text-coral transition-colors no-underline">
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-sm font-bold text-ink hover:text-coral transition-colors no-underline border border-transparent hover:border-[#E8DFCE]"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 rounded-2xl bg-coral hover:bg-coral-deep text-white font-baloo text-base font-bold shadow-sm hover:shadow-md transition-all active:scale-95 no-underline flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <span className="text-sm">→</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-[#E8DFCE] text-ink bg-white/70"
            aria-label="Toggle navigation"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-cream border-b border-[#E8DFCE] px-4 pt-3 pb-5 space-y-3 font-bold text-sm shadow-lg animate-pop">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-ink hover:text-coral no-underline"
            >
              Features
            </a>
            <a
              href="#curriculum"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-ink hover:text-coral no-underline"
            >
              Curriculum
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-ink hover:text-coral no-underline"
            >
              Interactive Demo
            </a>
            <a
              href="#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-ink hover:text-coral no-underline"
            >
              For Schools & Day Cares
            </a>
            <a
              href="#barangays"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-ink hover:text-coral no-underline"
            >
              22 Barangays
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-ink hover:text-coral no-underline"
            >
              FAQ
            </a>
            <div className="pt-3 border-t border-[#E8DFCE] flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full text-center py-2.5 rounded-xl border border-coral text-coral font-bold no-underline"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="w-full text-center py-2.5 rounded-xl bg-coral text-white font-baloo font-bold no-underline"
              >
                Sign Up as Learner / Teacher
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------- */}
      {/* HERO SECTION                                         */}
      {/* ---------------------------------------------------- */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-sky-deep/20 via-sky/15 to-[#FFFDF7]">
        {/* Floating scenic elements (Clouds & Sun) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="cloud cloud-1 opacity-70" />
          <div className="cloud cloud-2 opacity-75" />
          <div
            className="absolute -top-12 right-[10%] w-60 h-60 rounded-full blur-2xl opacity-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #FFD93D 0%, #FFA94D 70%, transparent 100%)',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headline & Call To Action */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              {/* Location Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sun/30 border border-sun/60 text-[#735A12] text-xs sm:text-sm font-extrabold shadow-sm">
                <span>🌱</span>
                <span>DepEd-Aligned Early Education • 22 Barangays of Manolo Fortich</span>
              </div>

              {/* Main Heading */}
              <h1 className="font-baloo text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink leading-[1.1] tracking-tight">
                Where Little Minds Blossom &{' '}
                <span className="text-coral underline decoration-sun decoration-wavy decoration-2">
                  Big Dreams Begin
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-ink-soft max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                EarlyLearn Hub is the official digital learning sanctuary for young learners (ages 3–6),
                day care workers, preschool teachers, and barangay communities across Manolo Fortich, Bukidnon.
                Inspiring curiosity through play, stories, and joyful discovery.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  to="/signup"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-coral hover:bg-coral-deep text-white font-baloo text-lg font-bold shadow-lg shadow-coral/25 hover:shadow-xl hover:-translate-y-0.5 transition-all no-underline flex items-center justify-center gap-2"
                >
                  <span>🚀 Register Your Learner</span>
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-[#FFF8E7] text-dash-ink font-baloo text-lg font-bold border-2 border-[#EADFCB] hover:border-sun transition-all no-underline flex items-center justify-center gap-2"
                >
                  <span>🔑 Portal Login</span>
                </Link>
                <a
                  href="#demo"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl text-sky-deep font-bold text-sm hover:underline flex items-center justify-center gap-1.5 no-underline"
                >
                  <span>Try Demo Below</span>
                  <span>↓</span>
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-ink-soft font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-leaf text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <span>100% Free for Barangays</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sun text-ink flex items-center justify-center text-[10px]">
                    ★
                  </span>
                  <span>Kid-Safe & Ad-Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-turquoise text-white flex items-center justify-center text-[10px]">
                    📱
                  </span>
                  <span>Phone & Tablet Ready</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Hero Mockup Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md bg-white rounded-3xl p-6 shadow-[0_20px_50px_rgba(61,51,39,0.12)] border-4 border-white ring-1 ring-[#EDE3D0]">
                {/* Top Mockup Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#F6EFE2]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sun to-coral flex items-center justify-center text-xl">
                      🌟
                    </div>
                    <div>
                      <h3 className="font-baloo text-base font-bold text-ink leading-none">
                        Student Explorer
                      </h3>
                      <p className="text-[11px] text-ink-soft mt-1">
                        Tankulan Day Care Center
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-sun/30 text-[#7A6014] text-xs font-black flex items-center gap-1">
                    <span>⭐</span>
                    <span>{starCount} Stars</span>
                  </div>
                </div>

                {/* Simulated Lesson Card */}
                <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-[#EBF7FF] to-[#D5EFFF] border border-sky/30">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-deep mb-2">
                    <span className="uppercase tracking-wide">Daily Discovery</span>
                    <span className="bg-white/80 px-2 py-0.5 rounded-md">Ages 3–5</span>
                  </div>
                  <h4 className="font-baloo text-lg font-bold text-ink mb-1">
                    🎨 Colors of Manolo Fortich
                  </h4>
                  <p className="text-xs text-ink-soft mb-3">
                    Can you spot the golden pineapples and emerald hills? Tap to earn your star!
                  </p>

                  {/* Interactive Mini-Task inside Hero */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleColorClick({ name: 'Pineapple Gold' })}
                      className="p-2.5 rounded-xl bg-sun text-[#4A3F1A] font-baloo font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:scale-105 transition-transform"
                    >
                      <span>🍍 Pineapple Gold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleColorClick({ name: 'Bukidnon Forest' })}
                      className="p-2.5 rounded-xl bg-leaf text-white font-baloo font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:scale-105 transition-transform"
                    >
                      <span>🌲 Mountain Green</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Feedback pill */}
                <div className="mt-3.5 p-2.5 rounded-xl bg-[#FFF8E7] text-xs text-center font-bold text-[#8A6420] border border-[#F5E5C9]">
                  {celebrationMsg}
                </div>

                {/* Floating Kid Badge */}
                <div className="absolute -bottom-5 -left-4 bg-white px-3.5 py-2 rounded-2xl shadow-lg border border-[#EDE3D0] flex items-center gap-2">
                  <span className="text-xl">🎒</span>
                  <div className="text-[11px] leading-tight font-extrabold text-dash-ink">
                    <span>22 Barangays</span>
                    <span className="block text-[10px] text-leaf font-bold">● Active Today</span>
                  </div>
                </div>

                {/* Floating Award Badge */}
                <div className="absolute -top-4 -right-4 bg-coral text-white px-3.5 py-1.5 rounded-2xl shadow-lg font-baloo font-bold text-xs flex items-center gap-1 animate-bounce">
                  <span>🏆 DepEd ECCD Aligned</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rolling Bukidnon Hills Silhouette Graphic */}
        <div className="w-full mt-14 overflow-hidden leading-none pointer-events-none">
          <svg
            className="w-full h-16 sm:h-24 text-[#5BB86A]/20"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 C150,90 350,-40 500,60 C650,140 900,10 1200,50 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* STATS AT A GLANCE                                    */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white border-y border-[#F0E6D2] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-coral block">
                22
              </span>
              <span className="text-xs sm:text-sm font-bold text-ink-soft uppercase tracking-wide">
                Barangays Covered
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-leaf block">
                Ages 3–6
              </span>
              <span className="text-xs sm:text-sm font-bold text-ink-soft uppercase tracking-wide">
                Preschool & Day Care
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-sky-deep block">
                4 Formats
              </span>
              <span className="text-xs sm:text-sm font-bold text-ink-soft uppercase tracking-wide">
                Video, Story, Activity, Audio
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-sun block">
                100% Free
              </span>
              <span className="text-xs sm:text-sm font-bold text-ink-soft uppercase tracking-wide">
                Community Access
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* INTERACTIVE DEMO PLAYGROUND                         */}
      {/* ---------------------------------------------------- */}
      <section id="demo" className="py-20 bg-dashbg/60 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-sun/40 text-[#7A6014] text-xs font-black uppercase tracking-wider">
              🎮 Hands-On Interactive Playground
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              Experience the Magic of Early Learning
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              Click any card below to hear letter sounds, identify colors, or explore Bukidnon nature.
              Every activity rewards children with cheerful encouragement!
            </p>
          </div>

          {/* Interactive Mode Switcher Tabs */}
          <div className="flex justify-center gap-2 sm:gap-4 mb-8">
            <button
              type="button"
              onClick={() => {
                setDemoTab('alphabet');
                playChime('pop');
              }}
              className={`px-5 py-2.5 rounded-2xl font-baloo text-sm sm:text-base font-bold transition-all ${
                demoTab === 'alphabet'
                  ? 'bg-coral text-white shadow-md scale-105'
                  : 'bg-white text-ink-soft hover:bg-white/80'
              }`}
            >
              🔤 Alphabet Phonics
            </button>
            <button
              type="button"
              onClick={() => {
                setDemoTab('colors');
                playChime('pop');
              }}
              className={`px-5 py-2.5 rounded-2xl font-baloo text-sm sm:text-base font-bold transition-all ${
                demoTab === 'colors'
                  ? 'bg-sun text-[#4A3F1A] shadow-md scale-105'
                  : 'bg-white text-ink-soft hover:bg-white/80'
              }`}
            >
              🎨 Colors & Shapes
            </button>
            <button
              type="button"
              onClick={() => {
                setDemoTab('nature');
                playChime('pop');
              }}
              className={`px-5 py-2.5 rounded-2xl font-baloo text-sm sm:text-base font-bold transition-all ${
                demoTab === 'nature'
                  ? 'bg-leaf text-white shadow-md scale-105'
                  : 'bg-white text-ink-soft hover:bg-white/80'
              }`}
            >
              🌲 Bukidnon Wonders
            </button>
          </div>

          {/* Interactive Board */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-[#EBE1CF]">
            {/* Mode 1: Alphabet Phonics */}
            {demoTab === 'alphabet' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {Object.keys(alphabetData).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleLetterClick(letter)}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-baloo text-2xl sm:text-3xl font-extrabold flex items-center justify-center transition-all ${
                        activeLetter === letter
                          ? `${alphabetData[letter].color} shadow-lg scale-110 ring-4 ring-coral/20`
                          : 'bg-[#F9F5EC] text-ink hover:bg-[#F2ECE0]'
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>

                {/* Display Current Letter Card */}
                {alphabetData[activeLetter] && (
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-cream to-[#FDF8EE] border-2 border-[#EFE5D2] flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                    <div className="w-24 h-24 rounded-3xl bg-white shadow-sm flex items-center justify-center text-5xl">
                      {alphabetData[activeLetter].icon}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className="font-baloo text-3xl font-extrabold text-coral">
                          {activeLetter} is for {alphabetData[activeLetter].word}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            speakWord(
                              `${activeLetter} is for ${alphabetData[activeLetter].word}`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-sky text-white text-xs font-bold hover:bg-sky-deep"
                          title="Listen with pronunciation"
                        >
                          🔊 Hear Sound
                        </button>
                      </div>
                      <p className="text-ink-soft text-sm sm:text-base font-medium">
                        {alphabetData[activeLetter].desc}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Colors */}
            {demoTab === 'colors' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {colorsData.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleColorClick(item)}
                      style={{ backgroundColor: item.color, color: item.textColor }}
                      className="p-5 rounded-2xl font-baloo font-bold text-center shadow-sm hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 min-h-[110px]"
                    >
                      <span className="text-2xl">✨</span>
                      <span className="text-sm sm:text-base leading-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
                {selectedColor && (
                  <div className="p-4 rounded-xl bg-sun/20 border border-sun/50 text-center text-sm font-bold text-[#6B5313]">
                    🎉 Excellent observation! You discovered <strong>{selectedColor}</strong>! Keep exploring!
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Nature Wonders */}
            {demoTab === 'nature' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {natureData.map((spot) => (
                  <div
                    key={spot.name}
                    className="p-5 rounded-2xl bg-[#FBF8F1] border border-[#EFE5D2] flex gap-4 hover:border-leaf transition-colors"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl shrink-0">
                      {spot.icon}
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-leaf/20 text-[#2D6C37]">
                        {spot.tag}
                      </span>
                      <h4 className="font-baloo text-base font-bold text-ink mt-1">
                        {spot.name}
                      </h4>
                      <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                        {spot.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer Prompt */}
            <div className="mt-6 pt-4 border-t border-[#F2E8D7] flex flex-col sm:flex-row items-center justify-between text-xs text-ink-soft gap-2">
              <span>💡 Designed for tablets and phones in day care classrooms and home study.</span>
              <Link
                to="/signup"
                className="text-coral font-bold hover:underline no-underline"
              >
                Unlock full library of 50+ learning activities →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* CURRICULUM DOMAINS                                   */}
      {/* ---------------------------------------------------- */}
      <section id="curriculum" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-leaf/20 text-[#2E6B38] text-xs font-black uppercase tracking-wider">
              📚 ECCD Aligned Curriculum
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              Holistic Early Childhood Domains
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              Every lesson is structured around the Department of Education Early Childhood Care &
              Development (ECCD) standards to nurture physical, cognitive, and social development.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: '🔤',
                title: 'Alphabet & Phonics',
                color: 'border-t-coral',
                badge: 'Language & Literacy',
                desc: 'Letter tracing, phonemic awareness, vocabulary building through rhyme and repetition.',
              },
              {
                icon: '🔢',
                title: 'Numbers & Counting',
                color: 'border-t-sun',
                badge: 'Math Readiness',
                desc: 'Counting games, simple addition concepts, pattern recognition, and number puzzles.',
              },
              {
                icon: '🎨',
                title: 'Colors & Shapes',
                color: 'border-t-turquoise',
                badge: 'Visual Arts',
                desc: 'Shape sorting, primary & secondary color mixing, and spatial orientation.',
              },
              {
                icon: '🌿',
                title: 'Nature & Bukidnon',
                color: 'border-t-leaf',
                badge: 'Community Science',
                desc: 'Exploring plants, animals, weather, and the rich local heritage of Manolo Fortich.',
              },
              {
                icon: '📖',
                title: 'Values & Storytime',
                color: 'border-t-purple',
                badge: 'Socio-Emotional',
                desc: 'Moral stories, kindness, empathy, sharing with friends, and respecting community elders.',
              },
              {
                icon: '✏️',
                title: 'Worksheets & Crafts',
                color: 'border-t-orange',
                badge: 'Fine Motor Skills',
                desc: 'Tracing lines, coloring sheets, scissor-free craft prompts, and hands-on mini projects.',
              },
              {
                icon: '🎵',
                title: 'Songs & Action Rhymes',
                color: 'border-t-coral-deep',
                badge: 'Music & Movement',
                desc: 'Filipino nursery rhymes, finger plays, action songs that encourage physical movement.',
              },
              {
                icon: '🧼',
                title: 'Health & Daily Habits',
                color: 'border-t-sky-deep',
                badge: 'Self-Help Skills',
                desc: 'Handwashing songs, healthy eating, dental hygiene, and taking care of personal belongings.',
              },
            ].map((cat) => (
              <div
                key={cat.title}
                className={`bg-cream rounded-2xl p-6 shadow-sm border border-[#EFE4D2] border-t-4 ${cat.color} hover:shadow-card hover:-translate-y-1 transition-all group`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                  {cat.icon}
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#EADFCB] text-[#5C4C34]">
                  {cat.badge}
                </span>
                <h3 className="font-baloo text-xl font-bold text-ink mt-2 mb-1.5">
                  {cat.title}
                </h3>
                <p className="text-xs sm:text-[13px] text-ink-soft leading-relaxed font-medium">
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* ROLES / WHO IT'S FOR                                 */}
      {/* ---------------------------------------------------- */}
      <section id="roles" className="py-20 bg-dashbg/70 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-coral/20 text-coral-deep text-xs font-black uppercase tracking-wider">
              👥 Built For Our Entire Community
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              One Unified System, Four Dedicated Roles
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              EarlyLearn Hub connects everyone responsible for a child's early education into a seamless,
              supportive ecosystem.
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10">
            {[
              { id: 'student', label: '🎒 For Young Learners', icon: '🌟' },
              { id: 'teacher', label: '👩‍🏫 For Day Care Teachers', icon: '📚' },
              { id: 'admin', label: '🏛️ For Barangay Admins', icon: '📊' },
              { id: 'parent', label: '👨‍👩‍👧 For Caring Parents', icon: '🏡' },
            ].map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setActiveRole(role.id);
                  playChime('pop');
                }}
                className={`px-5 py-3 rounded-2xl font-baloo text-sm sm:text-base font-bold transition-all flex items-center gap-2 ${
                  activeRole === role.id
                    ? 'bg-ink text-white shadow-md scale-105'
                    : 'bg-white text-ink-soft hover:bg-white/80'
                }`}
              >
                <span>{role.icon}</span>
                <span>{role.label}</span>
              </button>
            ))}
          </div>

          {/* Role Detail Cards */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 shadow-card border border-[#EFE4D2]">
            {activeRole === 'student' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full bg-coral/20 text-coral-deep text-xs font-bold uppercase">
                    Student Dashboard Experience
                  </span>
                  <h3 className="font-baloo text-2xl sm:text-3xl font-extrabold text-ink">
                    Big Buttons, Bright Colors & Star Badges
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    Designed specifically for little fingers. Students can browse modules by picture,
                    watch videos, listen to audios, practice drawing activities, and submit answers with
                    zero frustration.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm font-bold text-ink">
                    <li className="flex items-center gap-2">
                      <span className="text-coral">⭐</span> Earn star badges on every submission
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-sky-deep">🎬</span> Watch age-tailored educational clips
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-leaf">📢</span> Receive friendly announcements from their teacher
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/signup"
                      className="inline-block px-5 py-2.5 rounded-xl bg-coral text-white font-baloo font-bold text-sm no-underline hover:bg-coral-deep"
                    >
                      Sign Up as Learner
                    </Link>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#FFF9EE] to-[#FFEEDB] border border-sun/40 text-center space-y-3">
                  <div className="text-6xl animate-bounce">🌻</div>
                  <h4 className="font-baloo text-lg font-bold text-[#6B5313]">
                    "Hooray! 3 Activities Done Today!"
                  </h4>
                  <div className="w-full bg-white rounded-full h-4 overflow-hidden border border-sun/50">
                    <div className="bg-sun h-full w-3/4 rounded-full" />
                  </div>
                  <p className="text-xs text-ink-soft">
                    Gold Star Milestone: 75% Completed This Week
                  </p>
                </div>
              </div>
            )}

            {activeRole === 'teacher' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full bg-leaf/20 text-[#2D6C37] text-xs font-bold uppercase">
                    Teacher Dashboard Tools
                  </span>
                  <h3 className="font-baloo text-2xl sm:text-3xl font-extrabold text-ink">
                    Effortless Material Management & Instant Grading
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    Day Care workers can easily upload lessons (videos, worksheets, stories), assign them
                    to specific age groups (Ages 3–4 or 5–6), review student submissions, and send immediate
                    feedback.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm font-bold text-ink">
                    <li className="flex items-center gap-2">
                      <span className="text-leaf">✏️</span> 1-click material creation for any category
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-sun">📋</span> Review queue with approval & 'Checked' status
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-turquoise">📣</span> Broadcast messages to all learners in their barangay
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/login"
                      className="inline-block px-5 py-2.5 rounded-xl bg-[#3D3327] text-white font-baloo font-bold text-sm no-underline hover:opacity-90"
                    >
                      Teacher Portal Login
                    </Link>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-[#F6F2E9] border border-[#E7DDCC] space-y-3 text-left">
                  <div className="flex items-center justify-between text-xs font-bold text-dash-ink-soft">
                    <span>Active Day Care Submissions</span>
                    <span className="text-leaf">95% Reviewed</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-card-border flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-dash-ink">Alphabet Tracing Letter B</div>
                      <div className="text-xs text-dash-ink-soft">Student: Juan Dela Cruz • Tankulan</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#DCEBDD] text-[#3D7048] text-xs font-bold">
                      Checked ✓
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-card-border flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-dash-ink">Color Sorting Sunflower</div>
                      <div className="text-xs text-dash-ink-soft">Student: Maria Santos • Damilag</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#F6E4C2] text-[#8A6420] text-xs font-bold">
                      Submitted
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeRole === 'admin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full bg-sun/30 text-[#6B5313] text-xs font-bold uppercase">
                    Municipal & Barangay Oversight
                  </span>
                  <h3 className="font-baloo text-2xl sm:text-3xl font-extrabold text-ink">
                    Comprehensive Analytics Across 22 Barangays
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    Administrators have full visibility into teacher rosters, registered learners,
                    announcements, and category coverage across the municipality of Manolo Fortich.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm font-bold text-ink">
                    <li className="flex items-center gap-2">
                      <span className="text-sun">🏛️</span> Barangay-by-barangay participation metrics
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-coral">👥</span> Role assignment (Admin, Teacher, Student)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-sky-deep">📊</span> Global announcement broadcaster
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/login"
                      className="inline-block px-5 py-2.5 rounded-xl bg-accent text-white font-baloo font-bold text-sm no-underline hover:opacity-90"
                    >
                      Admin Dashboard Access
                    </Link>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-[#FFFDF8] border border-[#E8DFC9] space-y-4">
                  <h4 className="font-fraunces text-base font-bold text-dash-ink">
                    Manolo Fortich System Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-[#FAF5EC] rounded-xl">
                      <span className="font-baloo text-2xl font-bold text-dash-ink">22</span>
                      <span className="block text-[11px] text-dash-ink-soft">Barangays Active</span>
                    </div>
                    <div className="p-3 bg-[#FAF5EC] rounded-xl">
                      <span className="font-baloo text-2xl font-bold text-accent">500+</span>
                      <span className="block text-[11px] text-dash-ink-soft">Total Learners</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#DCEBDD]/60 text-xs font-bold text-[#3D7048] flex items-center justify-between">
                    <span>System Status: Healthy</span>
                    <span>Supabase Cloud Connected</span>
                  </div>
                </div>
              </div>
            )}

            {activeRole === 'parent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full bg-turquoise/20 text-[#257580] text-xs font-bold uppercase">
                    Peace of Mind For Families
                  </span>
                  <h3 className="font-baloo text-2xl sm:text-3xl font-extrabold text-ink">
                    Partnering in Your Child's Wonder Years
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    Parents can log in together with their child from any smartphone, see what their
                    local Day Care teacher assigned today, and celebrate every milestone together at home.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm font-bold text-ink">
                    <li className="flex items-center gap-2">
                      <span className="text-turquoise">📱</span> Works smoothly on mobile browsers with zero installs
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-leaf">🛡️</span> 100% ad-free and strictly moderated by teachers
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-sun">💌</span> Direct announcements from their barangay center
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/signup"
                      className="inline-block px-5 py-2.5 rounded-xl bg-turquoise text-white font-baloo font-bold text-sm no-underline hover:opacity-90"
                    >
                      Join EarlyLearn Today
                    </Link>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-gradient-to-tr from-[#EBF9FB] to-white border border-turquoise/30 space-y-3 text-center">
                  <div className="text-5xl">👨‍👩‍👧</div>
                  <h4 className="font-baloo text-lg font-bold text-[#1E6872]">
                    "Together We Grow"
                  </h4>
                  <p className="text-xs text-ink-soft">
                    15 minutes of guided parent-child daily learning yields profound cognitive and emotional
                    confidence for preschoolers.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 22 BARANGAYS DIRECTORY                                */}
      {/* ---------------------------------------------------- */}
      <section id="barangays" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-sun/40 text-[#6B5313] text-xs font-black uppercase tracking-wider">
              📍 Localized Community Education
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              Serving All 22 Barangays of Manolo Fortich
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              From the highland plateaus of Dahilayan to the bustling town center of Tankulan,
              EarlyLearn Hub is customized for every child development center in our municipality.
            </p>

            {/* Quick Search Input */}
            <div className="pt-2 max-w-md mx-auto">
              <input
                type="text"
                placeholder="Find your barangay (e.g. Tankulan, Damilag, Alae)..."
                value={barangaySearch}
                onChange={(e) => setBarangaySearch(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5DAC6] bg-[#FFFDF8] text-sm font-bold text-ink outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Interactive Barangay Badges Grid */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-5xl mx-auto">
            {filteredBarangays.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setActiveBarangay(b);
                  playChime('pop');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeBarangay === b
                    ? 'bg-coral text-white shadow-md scale-105'
                    : 'bg-[#F7F3EA] text-ink hover:bg-[#EFE8D8]'
                }`}
              >
                <span>📍 {b}</span>
              </button>
            ))}
          </div>

          {/* Barangay Spotlight Card */}
          {activeBarangay && (
            <div className="mt-8 max-w-xl mx-auto p-6 rounded-2xl bg-cream border-2 border-[#EAE0CD] text-center space-y-2 animate-pop">
              <span className="text-xs font-extrabold uppercase text-leaf">
                ● Connected Community Center
              </span>
              <h3 className="font-baloo text-2xl font-bold text-ink">
                Barangay {activeBarangay}
              </h3>
              <p className="text-xs sm:text-sm text-ink-soft">
                Early childhood education programs and day care modules are actively shared with families
                in {activeBarangay}, Manolo Fortich, Bukidnon.
              </p>
              <div className="pt-2">
                <Link
                  to="/signup"
                  className="inline-block px-4 py-2 rounded-xl bg-sun text-[#4A3F1A] font-baloo font-bold text-xs hover:bg-[#F2CA2C] no-underline"
                >
                  Register a Learner in {activeBarangay} →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* HOW IT WORKS (3 SIMPLE STEPS)                        */}
      {/* ---------------------------------------------------- */}
      <section className="py-20 bg-dashbg/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-sky/30 text-sky-deep text-xs font-black uppercase tracking-wider">
              ✨ 3 Simple Steps
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              How EarlyLearn Hub Works
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              Getting started takes less than a minute. No complicated downloads or paperwork required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#EDE2CF] text-center space-y-4 relative">
              <div className="w-16 h-16 rounded-2xl bg-coral/20 text-coral-deep text-3xl font-extrabold flex items-center justify-center mx-auto font-baloo">
                1
              </div>
              <h3 className="font-baloo text-xl font-bold text-ink">
                Create a Free Account
              </h3>
              <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
                Parents or teachers sign up with an email and select their barangay in Manolo Fortich.
                Accounts are instantly ready.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#EDE2CF] text-center space-y-4 relative">
              <div className="w-16 h-16 rounded-2xl bg-sun/30 text-[#7A6014] text-3xl font-extrabold flex items-center justify-center mx-auto font-baloo">
                2
              </div>
              <h3 className="font-baloo text-xl font-bold text-ink">
                Explore Daily Quests
              </h3>
              <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
                Kids dive into colorful categories, watch educational videos, listen to stories, and solve
                hands-on learning activities.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#EDE2CF] text-center space-y-4 relative">
              <div className="w-16 h-16 rounded-2xl bg-leaf/20 text-[#2D6C37] text-3xl font-extrabold flex items-center justify-center mx-auto font-baloo">
                3
              </div>
              <h3 className="font-baloo text-xl font-bold text-ink">
                Collect Shiny Stars
              </h3>
              <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
                Submit completed tasks to day care teachers. Earn star badges, positive feedback, and watch
                your child grow with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* COMMUNITY TESTIMONIALS                               */}
      {/* ---------------------------------------------------- */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-sun/40 text-[#6B5313] text-xs font-black uppercase tracking-wider">
              💬 Voices from Manolo Fortich
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              Loved by Teachers, Parents & Little Learners
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-cream rounded-3xl p-7 border border-[#EFE4D2] space-y-4 shadow-sm">
              <div className="text-sun text-xl">★★★★★</div>
              <p className="text-xs sm:text-sm text-ink leading-relaxed font-medium italic">
                "Our day care kids in Tankulan love the colorful alphabet cards and star badges! It has made
                sharing worksheets and videos so much easier for our child development workers."
              </p>
              <div className="pt-2 border-t border-[#E8DFC9] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-coral/20 flex items-center justify-center font-bold text-coral">
                  MT
                </div>
                <div>
                  <div className="font-baloo text-sm font-bold text-ink">Teacher Maricel T.</div>
                  <div className="text-[11px] text-ink-soft">Day Care Teacher • Tankulan (Poblacion)</div>
                </div>
              </div>
            </div>

            <div className="bg-cream rounded-3xl p-7 border border-[#EFE4D2] space-y-4 shadow-sm">
              <div className="text-sun text-xl">★★★★★</div>
              <p className="text-xs sm:text-sm text-ink leading-relaxed font-medium italic">
                "My 4-year-old son asks to do his 'sunflower homework' every afternoon after lunch. It works
                wonderfully on my phone without consuming lots of data."
              </p>
              <div className="pt-2 border-t border-[#E8DFC9] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky/30 flex items-center justify-center font-bold text-sky-deep">
                  RS
                </div>
                <div>
                  <div className="font-baloo text-sm font-bold text-ink">Rowena S.</div>
                  <div className="text-[11px] text-ink-soft">Proud Parent • Barangay Damilag</div>
                </div>
              </div>
            </div>

            <div className="bg-cream rounded-3xl p-7 border border-[#EFE4D2] space-y-4 shadow-sm">
              <div className="text-sun text-xl">★★★★★</div>
              <p className="text-xs sm:text-sm text-ink leading-relaxed font-medium italic">
                "Having all 22 barangays connected means our municipal education coordinators can monitor
                early childhood milestones easily and broadcast announcements in seconds."
              </p>
              <div className="pt-2 border-t border-[#E8DFC9] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-leaf/25 flex items-center justify-center font-bold text-[#2D6C37]">
                  GA
                </div>
                <div>
                  <div className="font-baloo text-sm font-bold text-ink">Grace A.</div>
                  <div className="text-[11px] text-ink-soft">Barangay Child Development Coordinator • Alae</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* FREQUENTLY ASKED QUESTIONS (FAQ)                    */}
      {/* ---------------------------------------------------- */}
      <section id="faq" className="py-20 bg-dashbg/60 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <div className="inline-block px-4 py-1 rounded-full bg-sun/40 text-[#6B5313] text-xs font-black uppercase tracking-wider">
              ❓ Questions & Answers
            </div>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-ink">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Is EarlyLearn Hub completely free to use?',
                a: 'Yes! EarlyLearn Hub is a community education initiative provided for children, parents, and day care teachers across all 22 barangays of Manolo Fortich, Bukidnon.',
              },
              {
                q: 'What age groups are supported on the platform?',
                a: 'The curriculum is specially tailored for children ages 3 to 6 years old (Nursery, Day Care, and Kindergarten), aligned with the DepEd Early Childhood Care & Development (ECCD) competencies.',
              },
              {
                q: 'Do I need a computer, or does it work on mobile phones?',
                a: 'EarlyLearn Hub is mobile-first and fully responsive. You can open it on any smartphone, tablet, or desktop browser with zero app installation needed.',
              },
              {
                q: 'How do teachers review and give feedback on activities?',
                a: 'When a learner completes an activity or drawing, it appears directly in their teacher’s Teacher Dashboard queue. Teachers can review submissions, mark them as "Checked", and award encouraging stars.',
              },
              {
                q: 'How can Day Care workers and Teachers get teacher accounts?',
                a: 'Teachers can sign up or be registered by their Barangay or Municipal Administrator. Once given the Teacher role, they gain instant access to lesson publishing and submission grading.',
              },
            ].map((faq, idx) => (
              <div
                key={faq.q}
                className="bg-white rounded-2xl border border-[#EDE2CF] overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                  className="w-full p-5 text-left font-baloo text-base sm:text-lg font-bold text-ink flex items-center justify-between gap-4 hover:bg-[#FDFBF7] transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="text-coral text-xl font-bold shrink-0">
                    {openFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-ink-soft leading-relaxed border-t border-[#F5EEDB] animate-pop">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* FINAL CALL TO ACTION (SUNRISE BANNER)                */}
      {/* ---------------------------------------------------- */}
      <section className="py-20 bg-gradient-to-r from-sun via-orange to-coral text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="cloud cloud-1" />
          <div className="cloud cloud-2" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-extrabold uppercase tracking-wider">
            🌻 Join Our Growing Community
          </div>

          <h2 className="font-baloo text-3xl sm:text-5xl font-extrabold leading-tight">
            Ready to Spark Your Child's Love for Learning?
          </h2>

          <p className="text-sm sm:text-lg max-w-2xl mx-auto opacity-95 font-medium leading-relaxed">
            Register your learner today, connect with your local barangay day care center, and watch them
            blossom with every completed lesson.
          </p>

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-coral font-baloo text-lg font-extrabold shadow-lg hover:shadow-xl hover:bg-cream transition-all no-underline"
            >
              Sign Up as Learner / Parent →
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-md text-white font-baloo text-lg font-bold border border-white/30 transition-all no-underline"
            >
              Teacher / Admin Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* FOOTER                                               */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-sidebar text-sidebar-text py-14 border-t border-[#4E4334]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand column */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🌻</span>
                <span className="font-baloo text-2xl font-bold text-white">EarlyLearn Hub</span>
              </div>
              <p className="text-xs text-[#A99A7F] leading-relaxed">
                Early childhood care and digital education platform dedicated to the 22 barangays of
                Manolo Fortich, Bukidnon.
              </p>
              <div className="text-[11px] text-[#8C7D63]">
                Aligned with DepEd ECCD Guidelines
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <h4 className="font-baloo text-sm font-bold text-white uppercase tracking-wider">
                Platform
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a href="#features" className="hover:text-gold no-underline transition-colors">
                    Key Features
                  </a>
                </li>
                <li>
                  <a href="#curriculum" className="hover:text-gold no-underline transition-colors">
                    Learning Domains
                  </a>
                </li>
                <li>
                  <a href="#demo" className="hover:text-gold no-underline transition-colors">
                    Interactive Playground
                  </a>
                </li>
                <li>
                  <a href="#roles" className="hover:text-gold no-underline transition-colors">
                    Role Portals
                  </a>
                </li>
              </ul>
            </div>

            {/* Portals */}
            <div className="space-y-2">
              <h4 className="font-baloo text-sm font-bold text-white uppercase tracking-wider">
                Access Portals
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/login" className="hover:text-gold no-underline transition-colors">
                    Student Login
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-gold no-underline transition-colors">
                    Day Care Teacher Portal
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-gold no-underline transition-colors">
                    Barangay Admin Portal
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="hover:text-gold no-underline transition-colors">
                    New Learner Registration
                  </Link>
                </li>
              </ul>
            </div>

            {/* Location & Contact */}
            <div className="space-y-2">
              <h4 className="font-baloo text-sm font-bold text-white uppercase tracking-wider">
                Community Hub
              </h4>
              <p className="text-xs text-[#A99A7F] leading-relaxed">
                📍 Municipality of Manolo Fortich
                <br />
                Province of Bukidnon, Region X, Philippines
              </p>
              <p className="text-xs text-[#A99A7F]">
                Serving Day Care & Early Child Centers across all 22 barangays.
              </p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-[#4E4334] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#8C7D63] gap-4">
            <div>
              © {new Date().getFullYear()} EarlyLearn Hub — Manolo Fortich, Bukidnon. All rights reserved.
            </div>
            <div className="flex gap-4">
              <a href="#demo" className="hover:text-white no-underline">
                Demo
              </a>
              <Link to="/login" className="hover:text-white no-underline">
                Log In
              </Link>
              <Link to="/signup" className="hover:text-white no-underline">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
