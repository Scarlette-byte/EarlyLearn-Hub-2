import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { barangays } from '../lib/supabaseClient';

// Gentle micro-interaction sound generator using Web Audio API
function playChime(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'success') {
      // Warm, gentle dual-tone marimba chime (C5 & G5)
      [523.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.08, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.24);
      });
    } else if (type === 'tap') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5 soft tap
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    }
  } catch {
    // Gracefully ignore if browser audio is disabled
  }
}

// Toddler text-to-speech helper with warm, natural rate
function speakToddlerWord(text) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // Ignore if not supported
  }
}

// --- Inline Clean SVG Icons ---
function IconSprout({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20h10" />
      <path d="M12 20v-8" />
      <path d="M12 12c-3.5 0-6-2.5-6-6 4 0 6 2.5 6 6Z" />
      <path d="M12 12c3.5 0 6-2.5 6-6-4 0-6 2.5-6 6Z" />
    </svg>
  );
}

function IconCheck({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconBook({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
    </svg>
  );
}

function IconPalette({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.2 0-.9.8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10Z" />
    </svg>
  );
}

function IconMusic({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconHeart({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconHand({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function IconSparkles({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function IconPin({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconMobile({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function IconUsers({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSun({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function IconVolume({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Demo State (Calibrated specifically for 3-4 year olds)
  const [demoTab, setDemoTab] = useState('words'); // 'words' | 'shapes' | 'count'
  const [activeWordKey, setActiveWordKey] = useState('A');
  const [selectedShape, setSelectedShape] = useState('circle');
  const [currentCount, setCurrentCount] = useState(3);
  const [interactionFeedback, setInteractionFeedback] = useState('Tap any card to play and listen together!');

  // Role showcase state
  const [activeRole, setActiveRole] = useState('parent');

  // Barangay filter search
  const [barangaySearch, setBarangaySearch] = useState('');
  const [activeBarangay, setActiveBarangay] = useState('Tankulan (Poblacion)');

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 20) {
        setNavScrolled(true);
      } else {
        setNavScrolled(false);
      }
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 3-4 Year Old First Words & Phonics Data
  const toddlerWordsData = {
    A: {
      letter: 'A',
      word: 'Apple',
      localWord: 'Mansanas',
      pronunciation: 'Ah - ple',
      desc: 'Sweet, crisp red apple. A healthy morning snack for little hands!',
      tag: 'Healthy Food',
      color: 'bg-[#FF6B6B]',
      lightBg: 'bg-[#FFF0F0]',
      borderColor: 'border-[#FFC7C7]',
      accentText: 'text-[#D94141]',
      symbol: '🍎',
    },
    B: {
      letter: 'B',
      word: 'Butterfly',
      localWord: 'Alibangbang',
      pronunciation: 'Buh - ter - fly',
      desc: 'Gentle wings fluttering among the flowers in our barangay gardens.',
      tag: 'Garden Friend',
      color: 'bg-[#3FA9F5]',
      lightBg: 'bg-[#F0F8FF]',
      borderColor: 'border-[#CCE7FF]',
      accentText: 'text-[#1D82CC]',
      symbol: '🦋',
    },
    K: {
      letter: 'K',
      word: 'Carabao',
      localWord: 'Kalabaw',
      pronunciation: 'Kah - lah - bow',
      desc: 'The strong, gentle water buffalo resting peacefully near the ricefields.',
      tag: 'Bukidnon Farm',
      color: 'bg-[#4E8D7C]',
      lightBg: 'bg-[#EDF6F3]',
      borderColor: 'border-[#CFE6DF]',
      accentText: 'text-[#2D6657]',
      symbol: '🐃',
    },
    P: {
      letter: 'P',
      word: 'Pineapple',
      localWord: 'Pinya',
      pronunciation: 'Pine - ap - ple',
      desc: 'Golden sweet pineapples harvested across the fertile plateaus of Manolo Fortich.',
      tag: 'Manolo Fortich Pride',
      color: 'bg-[#E5A823]',
      lightBg: 'bg-[#FFF9EA]',
      borderColor: 'border-[#FDE7B4]',
      accentText: 'text-[#9C6E07]',
      symbol: '🍍',
    },
    S: {
      letter: 'S',
      word: 'Sun',
      localWord: 'Adlaw',
      pronunciation: 'Suh - n',
      desc: 'Warm golden sun shining over the rolling hills of Bukidnon every morning.',
      tag: 'Nature Wonder',
      color: 'bg-[#FFA94D]',
      lightBg: 'bg-[#FFF5EB]',
      borderColor: 'border-[#FFE0C2]',
      accentText: 'text-[#C96B10]',
      symbol: '☀️',
    },
  };

  // 3-4 Year Old Shapes & Colors Data
  const toddlerShapesData = [
    {
      id: 'circle',
      name: 'Circle',
      localName: 'Bilog',
      colorName: 'Sunshine Yellow',
      hex: '#FFD93D',
      bgClass: 'bg-[#FFD93D]',
      borderClass: 'border-[#E0BE28]',
      textClass: 'text-[#5E4C06]',
      itemExample: 'Round like the morning sun and sweet pineapple slices.',
      iconPath: (
        <svg className="w-16 h-16 mx-auto text-[#FFD93D]" viewBox="0 0 100 100" fill="currentColor">
          <circle cx="50" cy="50" r="44" />
        </svg>
      ),
    },
    {
      id: 'square',
      name: 'Square',
      localName: 'Kuwadrado',
      colorName: 'Sky Blue',
      hex: '#6EC6FF',
      bgClass: 'bg-[#6EC6FF]',
      borderClass: 'border-[#43A4E5]',
      textClass: 'text-[#0C588C]',
      itemExample: 'Four equal sides like a nursery picture book or classroom window.',
      iconPath: (
        <svg className="w-16 h-16 mx-auto text-[#6EC6FF]" viewBox="0 0 100 100" fill="currentColor">
          <rect x="10" y="10" width="80" height="80" rx="14" />
        </svg>
      ),
    },
    {
      id: 'triangle',
      name: 'Triangle',
      localName: 'Triyanggulo',
      colorName: 'Pine Green',
      hex: '#6BCB77',
      bgClass: 'bg-[#6BCB77]',
      borderClass: 'border-[#4EA85A]',
      textClass: 'text-[#1D6026]',
      itemExample: 'Three points like the towering pine trees of Dahilayan hills.',
      iconPath: (
        <svg className="w-16 h-16 mx-auto text-[#6BCB77]" viewBox="0 0 100 100" fill="currentColor">
          <polygon points="50,10 90,88 10,88" strokeLinejoin="round" strokeWidth="8" stroke="currentColor" />
        </svg>
      ),
    },
    {
      id: 'star',
      name: 'Star',
      localName: 'Bituon',
      colorName: 'Coral Pink',
      hex: '#FF6B6B',
      bgClass: 'bg-[#FF6B6B]',
      borderClass: 'border-[#DF4848]',
      textClass: 'text-[#8C1515]',
      itemExample: 'Five points like the reward stickers your Day Care teacher gives you!',
      iconPath: (
        <svg className="w-16 h-16 mx-auto text-[#FF6B6B]" viewBox="0 0 100 100" fill="currentColor">
          <polygon points="50,8 62,37 94,40 69,61 77,92 50,75 23,92 31,61 6,40 38,37" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  function handleWordSelect(key) {
    setActiveWordKey(key);
    playChime('tap');
    const item = toddlerWordsData[key];
    speakToddlerWord(`${item.letter}. ${item.word}. ${item.localWord}`);
    setInteractionFeedback(`Great job! "${item.letter}" is for ${item.word} (${item.localWord})!`);
  }

  function handleShapeSelect(shape) {
    setSelectedShape(shape.id);
    playChime('success');
    speakToddlerWord(`${shape.name}. ${shape.localName}`);
    setInteractionFeedback(`Wonderful! You recognized the ${shape.name} (${shape.localName})!`);
  }

  function handleCountChange(num) {
    setCurrentCount(num);
    playChime('tap');
    speakToddlerWord(`${num}`);
    setInteractionFeedback(`Counting: ${num} item${num > 1 ? 's' : ''}! One by one, little steps.`);
  }

  const filteredBarangays = barangays.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#2B241C] font-nunito selection:bg-[#FFE082] selection:text-[#2B241C]">
      {/* ---------------------------------------------------- */}
      {/* ACCESSIBLE TOP HEADER / NAVIGATION                   */}
      {/* ---------------------------------------------------- */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navScrolled
            ? 'bg-[#FFFDF8]/95 backdrop-blur-md shadow-sm border-b border-[#EFE7D8] py-3'
            : 'bg-transparent py-4 sm:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B6B] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <IconSprout className="w-6 h-6" />
            </div>
            <div>
              <div className="font-baloo text-xl sm:text-2xl font-extrabold text-[#2B241C] tracking-tight leading-none">
                EarlyLearn Hub
              </div>
              <div className="text-[11px] font-bold text-[#8C7A65] tracking-wide mt-0.5">
                Manolo Fortich • Ages 3–4 (Nursery & Day Care)
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7 font-bold text-sm text-[#6E5D4B]">
            <a href="#about-age" className="hover:text-[#FF6B6B] transition-colors no-underline">
              Why Ages 3–4
            </a>
            <a href="#curriculum" className="hover:text-[#FF6B6B] transition-colors no-underline">
              ECCD Domains
            </a>
            <a href="#interactive-preview" className="hover:text-[#FF6B6B] transition-colors no-underline">
              Activity Preview
            </a>
            <a href="#ecosystem" className="hover:text-[#FF6B6B] transition-colors no-underline">
              How It Works
            </a>
            <a href="#barangays" className="hover:text-[#FF6B6B] transition-colors no-underline">
              22 Barangays
            </a>
            <a href="#faq" className="hover:text-[#FF6B6B] transition-colors no-underline">
              FAQ
            </a>
          </nav>

          {/* Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-sm font-bold text-[#4A3B2C] hover:text-[#FF6B6B] hover:bg-[#F5EFE3] transition-colors no-underline"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 rounded-xl bg-[#FF6B6B] hover:bg-[#F4495C] text-white font-baloo text-sm font-bold shadow-sm hover:shadow transition-all active:scale-95 no-underline flex items-center gap-2"
            >
              <span>Register Child</span>
              <span className="text-xs">→</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-[#E8DFC9] text-[#2B241C] bg-white"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FFFDF8] border-b border-[#EAE0CD] px-4 pt-3 pb-5 space-y-3 font-bold text-sm shadow-md animate-pop">
            <a
              href="#about-age"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#2B241C] hover:text-[#FF6B6B] no-underline"
            >
              Why Ages 3–4 (Nursery & Day Care)
            </a>
            <a
              href="#curriculum"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#2B241C] hover:text-[#FF6B6B] no-underline"
            >
              ECCD Learning Domains
            </a>
            <a
              href="#interactive-preview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#2B241C] hover:text-[#FF6B6B] no-underline"
            >
              Toddler Activity Preview
            </a>
            <a
              href="#ecosystem"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#2B241C] hover:text-[#FF6B6B] no-underline"
            >
              Day Care Centers & Roles
            </a>
            <a
              href="#barangays"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#2B241C] hover:text-[#FF6B6B] no-underline"
            >
              All 22 Barangays
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#2B241C] hover:text-[#FF6B6B] no-underline"
            >
              Frequently Asked Questions
            </a>
            <div className="pt-3 border-t border-[#EAE0CD] flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full text-center py-2.5 rounded-xl border border-[#D8CEBC] text-[#4A3B2C] font-bold no-underline"
              >
                Sign In to Portal
              </Link>
              <Link
                to="/signup"
                className="w-full text-center py-2.5 rounded-xl bg-[#FF6B6B] text-white font-baloo font-bold no-underline"
              >
                Register Learner (Ages 3–4)
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------- */}
      {/* HERO SECTION (SPECIFIC TO AGES 3 TO 4)               */}
      {/* ---------------------------------------------------- */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden border-b border-[#F0E6D4] bg-gradient-to-b from-[#FFF7EA] via-[#FFFBF2] to-[#FFFDF8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Clear Value Proposition */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Program & Age Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFE8CC] border border-[#FFD099] text-[#8C4A00] text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#E65100]" />
                <span>Dedicated to Ages 3 to 4 • Child Development Centers of Manolo Fortich</span>
              </div>

              {/* Main Headline */}
              <h1 className="font-baloo text-3xl sm:text-5xl lg:text-[52px] font-extrabold text-[#2B241C] leading-[1.15] tracking-tight">
                Gentle early learning designed specifically for toddlers{' '}
                <span className="text-[#FF6B6B] underline decoration-[#FFD93D] decoration-4 underline-offset-4">
                  aged 3 to 4 years old.
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-[#5A4C3C] max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                EarlyLearn Hub connects Barangay Child Development Centers, day care teachers,
                and parents across Manolo Fortich, Bukidnon. Aligned with the Philippine Early Childhood Care
                and Development (ECCD) competencies for Nursery and Day Care learners.
              </p>

              {/* Call to Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <Link
                  to="/signup"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#FF6B6B] hover:bg-[#F4495C] text-white font-baloo text-base font-bold shadow-md hover:shadow-lg transition-all no-underline flex items-center justify-center gap-2"
                >
                  <span>Register Learner (Ages 3–4)</span>
                  <span>→</span>
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-[#FAF4E8] text-[#2B241C] font-baloo text-base font-bold border border-[#DCCFB8] transition-all no-underline flex items-center justify-center gap-2"
                >
                  <span>Teacher & Parent Sign In</span>
                </Link>
                <a
                  href="#interactive-preview"
                  className="w-full sm:w-auto px-4 py-3 rounded-xl text-[#8C4A00] font-bold text-sm hover:underline flex items-center justify-center gap-1 no-underline"
                >
                  <span>Try 3–4 Activity Preview</span>
                  <span>↓</span>
                </a>
              </div>

              {/* Developmentally Tailored Badges */}
              <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mx-auto lg:mx-0 text-left">
                <div className="p-3 rounded-xl bg-white border border-[#EBE1CF] flex items-start gap-2.5 shadow-2xs">
                  <div className="p-1 rounded-md bg-[#FFF3D6] text-[#A67100] shrink-0 mt-0.5">
                    <IconSprout className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#2B241C]">Ages 3–4 Specific</div>
                    <div className="text-[11px] text-[#7A6B59] leading-tight">Nursery & Day Care milestones</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#EBE1CF] flex items-start gap-2.5 shadow-2xs">
                  <div className="p-1 rounded-md bg-[#E8F5E9] text-[#2E7D32] shrink-0 mt-0.5">
                    <IconMobile className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#2B241C]">Mobile & Lightweight</div>
                    <div className="text-[11px] text-[#7A6B59] leading-tight">Low-data on family phones</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#EBE1CF] flex items-start gap-2.5 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="p-1 rounded-md bg-[#E3F2FD] text-[#1565C0] shrink-0 mt-0.5">
                    <IconPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#2B241C]">22 Barangays</div>
                    <div className="text-[11px] text-[#7A6B59] leading-tight">Manolo Fortich community</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Toddler Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_12px_40px_rgba(43,36,28,0.08)] border border-[#EADBCA] relative">
                {/* Center Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-[#F4EDE0]">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A67100] px-2 py-0.5 rounded bg-[#FFF4D6]">
                      Toddler Daily Discovery (Ages 3–4)
                    </span>
                    <h3 className="font-baloo text-base font-bold text-[#2B241C] mt-1">
                      Tankulan Child Development Center
                    </h3>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Nursery Level</span>
                  </div>
                </div>

                {/* Lesson Prompt */}
                <div className="mt-5 p-4 rounded-2xl bg-[#FFF9EC] border border-[#F5E5C9]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8C6D1F] mb-1.5">
                    <span>Topic: Shapes & Fruits in Bukidnon</span>
                    <span>10 Min Session</span>
                  </div>
                  <h4 className="font-baloo text-lg font-bold text-[#2B241C]">
                    "Can you spot the sweet Pinya?"
                  </h4>
                  <p className="text-xs text-[#6B5A47] mt-0.5 mb-3 leading-relaxed">
                    Tap the golden pineapple harvested from the fields of Manolo Fortich.
                  </p>

                  {/* Interactive Options for 3-4 Year Old Fingers */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleWordSelect('P')}
                      className="p-3 rounded-xl bg-[#FFFDF5] border-2 border-[#E5A823] text-[#6E4B03] font-baloo font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#FFF3D6] transition-colors"
                    >
                      <span className="text-xl">🍍</span>
                      <span>Pinya (Pineapple)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWordSelect('A')}
                      className="p-3 rounded-xl bg-[#FFFDF5] border-2 border-[#FFC7C7] text-[#A82B2B] font-baloo font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#FFEAEB] transition-colors"
                    >
                      <span className="text-xl">🍎</span>
                      <span>Mansanas (Apple)</span>
                    </button>
                  </div>
                </div>

                {/* Feedback Indicator */}
                <div className="mt-3.5 p-3 rounded-xl bg-[#F4F9F4] border border-[#D4E8D4] text-xs font-bold text-[#286333] flex items-center gap-2">
                  <IconSparkles className="w-4 h-4 text-[#2E7D32] shrink-0" />
                  <span>{interactionFeedback}</span>
                </div>

                {/* Footer notes */}
                <div className="mt-4 pt-3 border-t border-[#F4EDE0] flex items-center justify-between text-[11px] text-[#7A6B59]">
                  <span>Guided with Day Care Teacher Check-ins</span>
                  <span className="font-bold text-[#FF6B6B]">DepEd ECCD Aligned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* WHY AGES 3 TO 4 (DEVELOPMENTAL EXPLANATION)          */}
      {/* ---------------------------------------------------- */}
      <section id="about-age" className="py-20 bg-white border-b border-[#F0E6D4] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#A65100] px-3 py-1 rounded-full bg-[#FFE8CC]">
              Developmental Focus: 36 to 48 Months
            </span>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2B241C]">
              Why EarlyLearn Hub is calibrated specifically for 3 to 4-year-olds
            </h2>
            <p className="text-base text-[#5A4C3C] leading-relaxed">
              Between 3 and 4 years old, toddlers transition from infant exploration to structured
              language, motor independence, and social routines. Rather than overwhelming young children
              with generic software, our platform is tailored for this exact window of growth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-7 rounded-2xl bg-[#FFFBF5] border border-[#EFE5D5] space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FFE4D6] text-[#C94F1C] flex items-center justify-center mb-4">
                <IconHand className="w-6 h-6" />
              </div>
              <h3 className="font-baloo text-xl font-bold text-[#2B241C]">
                Built for Little Fingers & Big Touch Targets
              </h3>
              <p className="text-xs sm:text-sm text-[#6B5A47] leading-relaxed">
                Toddlers at age 3 and 4 are still refining finger grasp and fine motor coordination.
                Buttons are oversized, visual targets are clear, and interactions require zero complex typing or scrolling.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-[#FFFBF5] border border-[#EFE5D5] space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#E3F2FD] text-[#1565C0] flex items-center justify-center mb-4">
                <IconBook className="w-6 h-6" />
              </div>
              <h3 className="font-baloo text-xl font-bold text-[#2B241C]">
                Short 10-Minute Guided Play Sessions
              </h3>
              <p className="text-xs sm:text-sm text-[#6B5A47] leading-relaxed">
                Developmental research shows 3 to 4-year-olds benefit most from short, interactive bursts
                rather than extended screen time. Activities are bite-sized and designed to be completed together with parents.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-[#FFFBF5] border border-[#EFE5D5] space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center mb-4">
                <IconHeart className="w-6 h-6" />
              </div>
              <h3 className="font-baloo text-xl font-bold text-[#2B241C]">
                Rooted in Familiar Bukidnon Surroundings
              </h3>
              <p className="text-xs sm:text-sm text-[#6B5A47] leading-relaxed">
                Lessons use real community contexts: pineapples of Manolo Fortich, friendly carabaos, local flora,
                and Mother Tongue words (Bisaya/Tagalog alongside English) that match what children hear at home.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* INTERACTIVE TODDLER ACTIVITY PREVIEW (AGES 3–4)      */}
      {/* ---------------------------------------------------- */}
      <section id="interactive-preview" className="py-20 bg-[#FAF5EC] border-b border-[#F0E6D4] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#2E7D32] px-3 py-1 rounded-full bg-[#E8F5E9]">
              Hands-On Interactive Experience
            </span>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2B241C]">
              Explore Sample Activities for Ages 3 to 4
            </h2>
            <p className="text-base text-[#5A4C3C]">
              Click between the three foundational learning areas below to test how our lessons
              engage toddlers in gentle sound recognition, color sorting, and 1-to-5 counting.
            </p>
          </div>

          {/* Activity Switcher Tabs */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-8">
            <button
              type="button"
              onClick={() => {
                setDemoTab('words');
                playChime('tap');
              }}
              className={`px-5 py-2.5 rounded-xl font-baloo text-sm sm:text-base font-bold transition-all ${
                demoTab === 'words'
                  ? 'bg-[#FF6B6B] text-white shadow-sm'
                  : 'bg-white text-[#5A4C3C] hover:bg-[#F2ECE0] border border-[#E8DFC9]'
              }`}
            >
              First Words & Sounds
            </button>
            <button
              type="button"
              onClick={() => {
                setDemoTab('shapes');
                playChime('tap');
              }}
              className={`px-5 py-2.5 rounded-xl font-baloo text-sm sm:text-base font-bold transition-all ${
                demoTab === 'shapes'
                  ? 'bg-[#FF6B6B] text-white shadow-sm'
                  : 'bg-white text-[#5A4C3C] hover:bg-[#F2ECE0] border border-[#E8DFC9]'
              }`}
            >
              Shapes & Colors
            </button>
            <button
              type="button"
              onClick={() => {
                setDemoTab('count');
                playChime('tap');
              }}
              className={`px-5 py-2.5 rounded-xl font-baloo text-sm sm:text-base font-bold transition-all ${
                demoTab === 'count'
                  ? 'bg-[#FF6B6B] text-white shadow-sm'
                  : 'bg-white text-[#5A4C3C] hover:bg-[#F2ECE0] border border-[#E8DFC9]'
              }`}
            >
              Count With Me (1 to 5)
            </button>
          </div>

          {/* Interactive Activity Board */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(43,36,28,0.06)] border border-[#EAE0CE]">
            {/* TAB 1: FIRST WORDS & SOUNDS */}
            {demoTab === 'words' && (
              <div className="space-y-6">
                <div className="text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-[#F4EDE0] pb-4">
                  <div>
                    <h3 className="font-baloo text-lg font-bold text-[#2B241C]">
                      Sound & Object Identification (Ages 3–4)
                    </h3>
                    <p className="text-xs text-[#7A6B59]">
                      Tap a letter button to see the item, pronounce the word, and hear local mother tongue context.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#A67100] px-2.5 py-1 bg-[#FFF4D6] rounded-md">
                    Mother Tongue & English
                  </span>
                </div>

                {/* Letter buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {Object.keys(toddlerWordsData).map((key) => {
                    const item = toddlerWordsData[key];
                    const isSelected = activeWordKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleWordSelect(key)}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-baloo text-2xl font-extrabold flex items-center justify-center transition-all ${
                          isSelected
                            ? `${item.color} text-white shadow-md scale-105 ring-4 ring-[#FF6B6B]/20`
                            : 'bg-[#F9F5EC] text-[#2B241C] hover:bg-[#F2ECE0] border border-[#E8DFC9]'
                        }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>

                {/* Active Card Showcase */}
                {toddlerWordsData[activeWordKey] && (
                  <div
                    className={`p-6 rounded-2xl ${toddlerWordsData[activeWordKey].lightBg} border-2 ${toddlerWordsData[activeWordKey].borderColor} flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left transition-all`}
                  >
                    <div className="w-24 h-24 rounded-2xl bg-white shadow-sm flex items-center justify-center text-5xl shrink-0">
                      {toddlerWordsData[activeWordKey].symbol}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className={`font-baloo text-2xl sm:text-3xl font-extrabold ${toddlerWordsData[activeWordKey].accentText}`}>
                          {toddlerWordsData[activeWordKey].letter} is for {toddlerWordsData[activeWordKey].word}
                        </span>
                        <span className="text-xs font-bold text-[#6B5A47] px-2 py-0.5 rounded bg-white border border-[#E8DFC9]">
                          Local: {toddlerWordsData[activeWordKey].localWord}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#5A4C3C] leading-relaxed">
                        {toddlerWordsData[activeWordKey].desc}
                      </p>
                      <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            speakToddlerWord(
                              `${toddlerWordsData[activeWordKey].letter}. ${toddlerWordsData[activeWordKey].word}. ${toddlerWordsData[activeWordKey].localWord}`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#D5C7B0] hover:bg-[#F4ECE0] text-xs font-bold text-[#2B241C] flex items-center gap-1.5 transition-colors"
                        >
                          <IconVolume className="w-4 h-4 text-[#FF6B6B]" />
                          <span>Say Word Aloud</span>
                        </button>
                        <span className="text-[11px] text-[#7A6B59] font-medium">
                          Phonetic sound: <em>{toddlerWordsData[activeWordKey].pronunciation}</em>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SHAPES & COLORS */}
            {demoTab === 'shapes' && (
              <div className="space-y-6">
                <div className="text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-[#F4EDE0] pb-4">
                  <div>
                    <h3 className="font-baloo text-lg font-bold text-[#2B241C]">
                      Basic Shape & Color Association (Ages 3–4)
                    </h3>
                    <p className="text-xs text-[#7A6B59]">
                      At 3 to 4 years old, toddlers match circles, squares, triangles, and primary colors.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#2E7D32] px-2.5 py-1 bg-[#E8F5E9] rounded-md">
                    Visual Recognition
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {toddlerShapesData.map((shape) => {
                    const isSelected = selectedShape === shape.id;
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        onClick={() => handleShapeSelect(shape)}
                        className={`p-4 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-[#FFF9EE] border-[#FF6B6B] shadow-sm scale-102'
                            : 'bg-[#FFFDF9] border-[#EAE0CF] hover:bg-[#F8F2E4]'
                        }`}
                      >
                        <div className="w-16 h-16 flex items-center justify-center">
                          {shape.iconPath}
                        </div>
                        <div className="font-baloo text-base font-bold text-[#2B241C] leading-none">
                          {shape.name}
                        </div>
                        <div className="text-[11px] font-bold text-[#7A6B59]">
                          {shape.localName} ({shape.colorName})
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Shape Detail */}
                {selectedShape && (
                  <div className="p-4 rounded-2xl bg-[#FFF9EE] border border-[#F5E5C9] text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <div className="font-baloo text-base font-bold text-[#2B241C]">
                        {toddlerShapesData.find((s) => s.id === selectedShape)?.name} (
                        {toddlerShapesData.find((s) => s.id === selectedShape)?.localName})
                      </div>
                      <div className="text-xs text-[#5A4C3C] mt-0.5">
                        {toddlerShapesData.find((s) => s.id === selectedShape)?.itemExample}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const s = toddlerShapesData.find((item) => item.id === selectedShape);
                        if (s) speakToddlerWord(`${s.name}. ${s.localName}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#D5C7B0] hover:bg-[#F4ECE0] text-xs font-bold text-[#2B241C] flex items-center gap-1.5 shrink-0"
                    >
                      <IconVolume className="w-3.5 h-3.5 text-[#FF6B6B]" />
                      <span>Hear Pronunciation</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: COUNT WITH ME (1 TO 5) */}
            {demoTab === 'count' && (
              <div className="space-y-6">
                <div className="text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-[#F4EDE0] pb-4">
                  <div>
                    <h3 className="font-baloo text-lg font-bold text-[#2B241C]">
                      Counting with One-to-One Correspondence (1 to 5)
                    </h3>
                    <p className="text-xs text-[#7A6B59]">
                      For 3 to 4-year-olds, counting up to 5 with physical objects builds the core math foundation.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#1565C0] px-2.5 py-1 bg-[#E3F2FD] rounded-md">
                    Math Readiness
                  </span>
                </div>

                {/* Number selector */}
                <div className="flex justify-center gap-2 sm:gap-4">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleCountChange(num)}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl font-baloo text-xl sm:text-2xl font-extrabold flex items-center justify-center transition-all ${
                        currentCount === num
                          ? 'bg-[#3FA9F5] text-white shadow-sm scale-110'
                          : 'bg-[#F9F5EC] text-[#2B241C] hover:bg-[#F2ECE0] border border-[#E8DFC9]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                {/* Count visualizer */}
                <div className="p-6 rounded-2xl bg-[#F0F8FF] border border-[#CCE7FF] text-center space-y-4">
                  <div className="font-baloo text-2xl font-bold text-[#1D82CC]">
                    {currentCount} Pinya (Pineapple{currentCount > 1 ? 's' : ''})
                  </div>
                  <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                    {Array.from({ length: currentCount }).map((_, i) => (
                      <div
                        key={i}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-sm border border-[#CCE7FF] flex items-center justify-center text-3xl sm:text-4xl animate-pop"
                      >
                        🍍
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#5A4C3C]">
                    Count them out loud: {Array.from({ length: currentCount }).map((_, i) => i + 1).join('... ')}!
                  </p>
                </div>
              </div>
            )}

            {/* Bottom prompt */}
            <div className="mt-6 pt-4 border-t border-[#F4EDE0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7A6B59] gap-3">
              <span>All 3–4 year old activities include teacher guidelines and printable offline sheets.</span>
              <Link to="/signup" className="text-[#FF6B6B] font-bold hover:underline no-underline">
                Register a child to access all 50+ toddler activities →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* ECCD CURRICULUM DOMAINS (AGES 3–4 DEPED STANDARDS)   */}
      {/* ---------------------------------------------------- */}
      <section id="curriculum" className="py-20 bg-white border-b border-[#F0E6D4] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#1565C0] px-3 py-1 rounded-full bg-[#E3F2FD]">
              DepEd ECCD Aligned (Ages 3.0 to 4.11)
            </span>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2B241C]">
              Holistic Early Childhood Developmental Domains
            </h2>
            <p className="text-base text-[#5A4C3C]">
              Structured according to the Philippine Early Childhood Care and Development (ECCD) checklist
              specifically verified for toddlers in nursery and community day care centers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Receptive & Expressive Language',
                tag: 'Wika at Komunikasyon',
                desc: 'Listening to short rhymes, pointing to pictured objects, answering "what" questions, and expressing basic needs.',
                icon: <IconBook className="w-5 h-5 text-[#FF6B6B]" />,
                colorBorder: 'border-l-4 border-l-[#FF6B6B]',
              },
              {
                title: 'Fine & Gross Motor Skills',
                tag: 'Kasanayang Pisikal',
                desc: 'Scribbling within broad lines, stringing big beads, gentle balancing, jumping, and clapping to music rhythms.',
                icon: <IconHand className="w-5 h-5 text-[#E5A823]" />,
                colorBorder: 'border-l-4 border-l-[#E5A823]',
              },
              {
                title: 'Cognitive & Math Readiness',
                tag: 'Batayang Sipnayan',
                desc: 'Counting 1 to 5, sorting items by big and small, grouping colors, and identifying basic geometric shapes.',
                icon: <IconSparkles className="w-5 h-5 text-[#3FA9F5]" />,
                colorBorder: 'border-l-4 border-l-[#3FA9F5]',
              },
              {
                title: 'Self-Help & Independence',
                tag: 'Pangangalaga sa Sarili',
                desc: 'Guided handwashing steps, tidying up play blocks, taking off shoes, and participating in mealtime routines.',
                icon: <IconCheck className="w-5 h-5 text-[#4E8D7C]" />,
                colorBorder: 'border-l-4 border-l-[#4E8D7C]',
              },
              {
                title: 'Socio-Emotional Awareness',
                tag: 'Pansarili at Emosyonal',
                desc: 'Playing alongside peers in day care, expressing joy and comfort, greeting teachers, and taking turns with toys.',
                icon: <IconHeart className="w-5 h-5 text-[#9B7EDE]" />,
                colorBorder: 'border-l-4 border-l-[#9B7EDE]',
              },
              {
                title: 'Community & Nature Discovery',
                tag: 'Agham at Kapaligiran',
                desc: 'Discovering pine trees, farm animals like carabaos, tropical weather, and the scenic landscapes of Bukidnon.',
                icon: <IconSprout className="w-5 h-5 text-[#6BCB77]" />,
                colorBorder: 'border-l-4 border-l-[#6BCB77]',
              },
            ].map((domain) => (
              <div
                key={domain.title}
                className={`p-6 rounded-2xl bg-[#FFFDF9] border border-[#EBE1CF] ${domain.colorBorder} shadow-2xs hover:shadow-xs transition-shadow space-y-2.5`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-white border border-[#EAE0CF] shadow-xs">
                    {domain.icon}
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#F4EDE0] text-[#6E5D4B]">
                    {domain.tag}
                  </span>
                </div>
                <h3 className="font-baloo text-lg font-bold text-[#2B241C] pt-1">
                  {domain.title}
                </h3>
                <p className="text-xs sm:text-[13px] text-[#6B5A47] leading-relaxed">
                  {domain.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 3-PILLAR ECOSYSTEM: TEACHERS, PARENTS, CENTERS       */}
      {/* ---------------------------------------------------- */}
      <section id="ecosystem" className="py-20 bg-[#FAF5EC] border-b border-[#F0E6D4] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#A65100] px-3 py-1 rounded-full bg-[#FFE8CC]">
              Community Architecture
            </span>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2B241C]">
              How EarlyLearn Hub Supports the Community
            </h2>
            <p className="text-base text-[#5A4C3C]">
              Early childhood learning succeeds when parents, day care teachers, and barangay centers
              work hand-in-hand.
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-8">
            {[
              { id: 'parent', label: 'For Parents & Guardians' },
              { id: 'teacher', label: 'For Day Care Teachers' },
              { id: 'barangay', label: 'For 22 Barangay Centers' },
            ].map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setActiveRole(role.id);
                  playChime('tap');
                }}
                className={`px-5 py-2.5 rounded-xl font-baloo text-sm sm:text-base font-bold transition-all ${
                  activeRole === role.id
                    ? 'bg-[#2B241C] text-white shadow-sm'
                    : 'bg-white text-[#5A4C3C] hover:bg-[#F2ECE0] border border-[#E8DFC9]'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          {/* Role Detail Cards */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(43,36,28,0.06)] border border-[#EAE0CE]">
            {activeRole === 'parent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-[#FF6B6B] uppercase tracking-wide">
                    Home & Mobile Guided Learning
                  </span>
                  <h3 className="font-baloo text-2xl font-bold text-[#2B241C]">
                    Spend 10 joyful minutes a day guiding your toddler
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5A4C3C] leading-relaxed">
                    No complicated apps or high phone requirements. Open activities directly in your mobile
                    browser, practice nursery rhymes and colors with your 3 or 4-year-old, and upload photos of their completed drawings to their teacher.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-[#2B241C]">
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Works on standard smartphones with low mobile data
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Clear prompts written for parents to read aloud
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Teacher feedback delivered right to your child's profile
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/signup"
                      className="inline-block px-5 py-2.5 rounded-xl bg-[#FF6B6B] text-white font-baloo font-bold text-sm no-underline hover:bg-[#F4495C]"
                    >
                      Sign Up as Learner (Ages 3–4)
                    </Link>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-[#FFF9EE] border border-[#F5E5C9] space-y-3">
                  <div className="text-xs font-bold text-[#8C6D1F]">Daily Toddler Routine (Example)</div>
                  <div className="p-3 bg-white rounded-xl border border-[#EAE0CF] space-y-1">
                    <div className="text-xs font-bold text-[#2B241C]">1. Morning Phonics (3 mins)</div>
                    <div className="text-[11px] text-[#7A6B59]">Listen to "P is for Pinya" and say it 3 times</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#EAE0CF] space-y-1">
                    <div className="text-xs font-bold text-[#2B241C]">2. Finger Tracing (5 mins)</div>
                    <div className="text-[11px] text-[#7A6B59]">Trace the circle sun on a piece of scrap paper</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#EAE0CF] space-y-1">
                    <div className="text-xs font-bold text-[#2B241C]">3. Teacher Submission (2 mins)</div>
                    <div className="text-[11px] text-[#7A6B59]">Take a quick photo and tap Submit to earn a star!</div>
                  </div>
                </div>
              </div>
            )}

            {activeRole === 'teacher' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-[#2E7D32] uppercase tracking-wide">
                    Child Development Workers (CDWs)
                  </span>
                  <h3 className="font-baloo text-2xl font-bold text-[#2B241C]">
                    Manage nursery materials and review toddler submissions
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5A4C3C] leading-relaxed">
                    Day Care workers can publish 3–4 year old lesson materials, assign specific categories (fine motor, phonics, storytime), review drawings and submissions, and broadcast announcements to all registered parents in their barangay.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-[#2B241C]">
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Filter materials specifically by 3–4 year old age range
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> 1-click submission review queue with 'Checked' approval
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Barangay-level announcement broadcast
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/login"
                      className="inline-block px-5 py-2.5 rounded-xl bg-[#2B241C] text-white font-baloo font-bold text-sm no-underline hover:bg-[#3D3327]"
                    >
                      Day Care Teacher Sign In
                    </Link>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-[#F0F8F2] border border-[#CFE7D5] space-y-3">
                  <div className="text-xs font-bold text-[#286333]">Teacher Review Workflow</div>
                  <div className="p-3 bg-white rounded-xl border border-[#D5EAD9] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#2B241C]">Circle Tracing Activity</div>
                      <div className="text-[11px] text-[#7A6B59]">Learner: Nursery Student • Tankulan</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                      Checked ✓
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#D5EAD9] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#2B241C]">First Words: Kalabaw</div>
                      <div className="text-[11px] text-[#7A6B59]">Learner: Nursery Student • Damilag</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-[#FFF3D6] text-[#A67100] text-xs font-bold">
                      Needs Review
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeRole === 'barangay' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-[#1565C0] uppercase tracking-wide">
                    Municipal & Barangay Child Centers
                  </span>
                  <h3 className="font-baloo text-2xl font-bold text-[#2B241C]">
                    Uniting all 22 barangays of Manolo Fortich
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5A4C3C] leading-relaxed">
                    Administrators have visibility into registered day care centers, child development workers,
                    and toddler enrollment numbers across every barangay in our municipality, ensuring no community center is left behind.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-[#2B241C]">
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Dedicated coverage for all 22 barangays
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> Verified teacher assignment & learner verification
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#2E7D32]">✓</span> DepEd ECCD alignment across centers
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link
                      to="/login"
                      className="inline-block px-5 py-2.5 rounded-xl bg-[#C9784A] text-white font-baloo font-bold text-sm no-underline hover:bg-[#B36437]"
                    >
                      Admin Dashboard Access
                    </Link>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-[#FFF9EE] border border-[#F5E5C9] space-y-3">
                  <div className="text-xs font-bold text-[#8C6D1F]">Barangay Coverage Overview</div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-white rounded-xl border border-[#EAE0CF]">
                      <div className="font-baloo text-2xl font-bold text-[#2B241C]">22</div>
                      <div className="text-[11px] text-[#7A6B59]">Barangays Supported</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-[#EAE0CF]">
                      <div className="font-baloo text-2xl font-bold text-[#C9784A]">Ages 3–4</div>
                      <div className="text-[11px] text-[#7A6B59]">Target Learner Group</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-[#EAE0CF] text-xs text-center text-[#5A4C3C]">
                    Province of Bukidnon • DepEd ECCD Aligned
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 22 BARANGAYS DIRECTORY (MANOLO FORTICH)               */}
      {/* ---------------------------------------------------- */}
      <section id="barangays" className="py-20 bg-white border-b border-[#F0E6D4] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#A67100] px-3 py-1 rounded-full bg-[#FFF4D6]">
              Local Community Centers
            </span>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2B241C]">
              Serving All 22 Barangays of Manolo Fortich
            </h2>
            <p className="text-base text-[#5A4C3C]">
              Find your local Child Development Center. Parents and day care workers can easily select their barangay to connect directly.
            </p>

            {/* Barangay Search Filter */}
            <div className="pt-2 max-w-md mx-auto">
              <input
                type="text"
                placeholder="Search barangay (e.g. Tankulan, Damilag, Alae)..."
                value={barangaySearch}
                onChange={(e) => setBarangaySearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#D8CEBC] bg-[#FFFDF9] text-sm font-bold text-[#2B241C] outline-none focus:border-[#FF6B6B] transition-colors"
              />
            </div>
          </div>

          {/* Barangay Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-5xl mx-auto">
            {filteredBarangays.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setActiveBarangay(b);
                  playChime('tap');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeBarangay === b
                    ? 'bg-[#FF6B6B] text-white shadow-xs scale-103'
                    : 'bg-[#F9F5EC] text-[#4A3B2C] hover:bg-[#F2ECE0] border border-[#EAE0CF]'
                }`}
              >
                <span>📍 {b}</span>
              </button>
            ))}
          </div>

          {/* Active Barangay Information Card */}
          {activeBarangay && (
            <div className="mt-8 max-w-xl mx-auto p-6 rounded-2xl bg-[#FFFBF5] border border-[#E8DFC9] text-center space-y-2 animate-pop">
              <span className="text-[11px] font-bold text-[#2E7D32] uppercase tracking-wide">
                Active Community Learning Center
              </span>
              <h3 className="font-baloo text-2xl font-bold text-[#2B241C]">
                Barangay {activeBarangay} Child Development Center
              </h3>
              <p className="text-xs sm:text-sm text-[#6B5A47] leading-relaxed">
                Early childhood care activities (Ages 3 to 4) are coordinated for families residing in Barangay {activeBarangay}, Manolo Fortich, Bukidnon.
              </p>
              <div className="pt-2">
                <Link
                  to="/signup"
                  className="inline-block px-5 py-2.5 rounded-xl bg-[#FF6B6B] text-white font-baloo font-bold text-xs hover:bg-[#F4495C] no-underline shadow-xs"
                >
                  Register a 3–4 Year Old in {activeBarangay} →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* FREQUENTLY ASKED QUESTIONS (FAQ)                    */}
      {/* ---------------------------------------------------- */}
      <section id="faq" className="py-20 bg-[#FAF5EC] border-b border-[#F0E6D4] scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#2E7D32] px-3 py-1 rounded-full bg-[#E8F5E9]">
              Parent & Teacher Answers
            </span>
            <h2 className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2B241C]">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-[#5A4C3C]">
              Clear information about age specificity, device requirements, and barangay access.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: 'Why is EarlyLearn Hub specifically focused on children aged 3 to 4?',
                a: 'Between ages 3 and 4 (the Nursery / Day Care stage), children experience crucial milestones in speech sounds, basic shapes, one-to-one counting, and daily routines. By tailoring the content specifically to 36–48 months, the activities avoid being too difficult or overstimulating.',
              },
              {
                q: 'Do parents need expensive computers or high-speed Wi-Fi?',
                a: 'Not at all. The platform is mobile-first and optimized for lightweight web browsing on standard family smartphones with limited cellular data.',
              },
              {
                q: 'Is EarlyLearn Hub completely free for families in Manolo Fortich?',
                a: 'Yes. It is a public community early education platform serving all 22 barangays of Manolo Fortich, Bukidnon without subscription fees or hidden costs.',
              },
              {
                q: 'How do Day Care Teachers track student activities?',
                a: 'Day care teachers log into their Teacher Portal, upload worksheets or short guides, review submissions sent by parents, mark items as "Checked", and send encouraging star feedback.',
              },
              {
                q: 'What if my child speaks Bisaya or Tagalog at home?',
                a: 'Our early word and phonics cards include familiar mother tongue context (such as Mansanas, Kalabaw, Pinya, and Adlaw) alongside English, ensuring toddlers learn from familiar cultural anchors.',
              },
            ].map((faq, idx) => (
              <div
                key={faq.q}
                className="bg-white rounded-2xl border border-[#EAE0CF] overflow-hidden shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                  className="w-full p-5 text-left font-baloo text-base sm:text-lg font-bold text-[#2B241C] flex items-center justify-between gap-4 hover:bg-[#FFFDF9] transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="text-[#FF6B6B] text-xl font-bold shrink-0">
                    {openFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#5A4C3C] leading-relaxed border-t border-[#F5EEDB] animate-pop">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* FINAL CALL TO ACTION (WARM INVITATION)              */}
      {/* ---------------------------------------------------- */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-[#FFD93D] via-[#FFA94D] to-[#FF6B6B] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <span className="inline-block px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider">
            Nursery & Day Care • Manolo Fortich, Bukidnon
          </span>

          <h2 className="font-baloo text-3xl sm:text-5xl font-extrabold leading-tight">
            Give your 3 to 4-year-old a joyful, guided head start.
          </h2>

          <p className="text-sm sm:text-base max-w-xl mx-auto opacity-95 font-medium leading-relaxed">
            Register your learner today, connect with your local barangay Child Development Center,
            and explore bite-sized daily activities together at home.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-[#D94141] font-baloo text-base font-extrabold shadow-md hover:bg-[#FFF9EE] transition-all no-underline"
            >
              Register Child (Ages 3–4) →
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-black/15 hover:bg-black/25 text-white font-baloo text-base font-bold border border-white/40 transition-all no-underline"
            >
              Sign In to Portal
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* FOOTER                                               */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-[#2B241C] text-[#C2B49F] py-12 border-t border-[#3D3327]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-2.5 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF6B6B] text-white flex items-center justify-center">
                  <IconSprout className="w-5 h-5" />
                </div>
                <span className="font-baloo text-xl font-bold text-white">EarlyLearn Hub</span>
              </div>
              <p className="text-xs text-[#A89882] leading-relaxed">
                Early childhood care and education platform specifically tailored for 3 to 4-year-old learners across the 22 barangays of Manolo Fortich, Bukidnon.
              </p>
              <div className="text-[11px] text-[#8A7963]">
                DepEd ECCD Aligned (Ages 3.0 to 4.11)
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <h4 className="font-baloo text-sm font-bold text-white uppercase tracking-wider">
                Platform
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a href="#about-age" className="hover:text-white no-underline transition-colors">
                    Why Ages 3–4
                  </a>
                </li>
                <li>
                  <a href="#curriculum" className="hover:text-white no-underline transition-colors">
                    ECCD Domains
                  </a>
                </li>
                <li>
                  <a href="#interactive-preview" className="hover:text-white no-underline transition-colors">
                    Activity Preview
                  </a>
                </li>
                <li>
                  <a href="#barangays" className="hover:text-white no-underline transition-colors">
                    22 Barangays
                  </a>
                </li>
              </ul>
            </div>

            {/* Portals */}
            <div className="space-y-2">
              <h4 className="font-baloo text-sm font-bold text-white uppercase tracking-wider">
                Portals
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/login" className="hover:text-white no-underline transition-colors">
                    Student Login
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white no-underline transition-colors">
                    Day Care Teacher Portal
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white no-underline transition-colors">
                    Barangay Admin Portal
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="hover:text-white no-underline transition-colors">
                    New Learner Registration
                  </Link>
                </li>
              </ul>
            </div>

            {/* Location & Details */}
            <div className="space-y-2">
              <h4 className="font-baloo text-sm font-bold text-white uppercase tracking-wider">
                Community
              </h4>
              <p className="text-xs text-[#A89882] leading-relaxed">
                📍 Municipality of Manolo Fortich
                <br />
                Province of Bukidnon, Region X, Philippines
              </p>
              <p className="text-xs text-[#8A7963]">
                Supporting Day Care & Child Development Centers across all 22 barangays.
              </p>
            </div>
          </div>

          <div className="mt-10 pt-5 border-t border-[#3D3327] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7A6B59] gap-3">
            <div>
              © {new Date().getFullYear()} EarlyLearn Hub — Manolo Fortich, Bukidnon. All rights reserved.
            </div>
            <div className="flex gap-4">
              <Link to="/login" className="hover:text-white no-underline">
                Sign In
              </Link>
              <Link to="/signup" className="hover:text-white no-underline">
                Register (Ages 3–4)
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
