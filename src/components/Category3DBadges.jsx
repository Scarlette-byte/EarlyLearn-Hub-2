// 3D Visual Badges for EarlyLearn Hub Category Cards
// Accurately matches the tactile 3D badges:
// 1. Alphabet (abc cube)
// 2. Numbers (1 2 / 3 4 cube)
// 3. Colors (Artist paint palette)
// 4. Shapes (3D Magenta triangle)
// 5. Animals (Cute puppy head)
// 6. Stories (Open storybook)

export function BadgeAlphabet({ className = 'w-14 h-14' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="abcGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <filter id="abcShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#1D4ED8" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* 3D Base */}
      <rect x="8" y="14" width="84" height="80" rx="24" fill="#1E40AF" />
      {/* Main Surface */}
      <rect x="8" y="8" width="84" height="80" rx="24" fill="url(#abcGrad)" filter="url(#abcShadow)" />
      {/* Subtle Inner Highlight */}
      <rect x="12" y="12" width="76" height="36" rx="18" fill="white" fillOpacity="0.18" />
      {/* Letter text abc */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="white"
        fontFamily="'Baloo 2', 'Nunito', sans-serif"
        fontWeight="900"
        fontSize="34"
        letterSpacing="-1"
      >
        abc
      </text>
    </svg>
  );
}

export function BadgeNumbers({ className = 'w-14 h-14' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="numGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <filter id="numShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#1D4ED8" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* 3D Base */}
      <rect x="8" y="14" width="84" height="80" rx="24" fill="#1E40AF" />
      {/* Main Surface */}
      <rect x="8" y="8" width="84" height="80" rx="24" fill="url(#numGrad)" filter="url(#numShadow)" />
      {/* Subtle Highlight */}
      <rect x="12" y="12" width="76" height="34" rx="18" fill="white" fillOpacity="0.18" />
      {/* 1 2 / 3 4 text */}
      <text x="34" y="44" textAnchor="middle" fill="white" fontFamily="'Baloo 2', 'Nunito', sans-serif" fontWeight="900" fontSize="24">1</text>
      <text x="66" y="44" textAnchor="middle" fill="white" fontFamily="'Baloo 2', 'Nunito', sans-serif" fontWeight="900" fontSize="24">2</text>
      <text x="34" y="72" textAnchor="middle" fill="white" fontFamily="'Baloo 2', 'Nunito', sans-serif" fontWeight="900" fontSize="24">3</text>
      <text x="66" y="72" textAnchor="middle" fill="white" fontFamily="'Baloo 2', 'Nunito', sans-serif" fontWeight="900" fontSize="24">4</text>
    </svg>
  );
}

export function BadgeColors({ className = 'w-14 h-14' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="palWood" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FED7AA" />
          <stop offset="100%" stopColor="#FDBA74" />
        </linearGradient>
        <filter id="palShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#C2410C" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Palette base 3D shadow */}
      <path d="M50 15 C75 15, 92 30, 90 52 C88 66, 78 72, 82 82 C84 88, 78 92, 70 90 C58 87, 46 92, 32 90 C15 87, 8 70, 10 50 C12 28, 28 15, 50 15 Z" fill="#EA580C" />
      {/* Palette body */}
      <path d="M50 12 C75 12, 92 27, 90 49 C88 63, 78 69, 82 79 C84 85, 78 89, 70 87 C58 84, 46 89, 32 87 C15 84, 8 67, 10 47 C12 25, 28 12, 50 12 Z" fill="url(#palWood)" filter="url(#palShadow)" />
      {/* Thumb hole */}
      <circle cx="74" cy="48" r="8.5" fill="#C2410C" fillOpacity="0.35" />
      {/* Paint spots */}
      <circle cx="30" cy="30" r="7.5" fill="#EC4899" />
      <circle cx="50" cy="24" r="7.5" fill="#8B5CF6" />
      <circle cx="28" cy="52" r="7" fill="#06B6D4" />
      <circle cx="44" cy="72" r="7" fill="#3B82F6" />
      <circle cx="62" cy="70" r="6.5" fill="#F59E0B" />
    </svg>
  );
}

export function BadgeShapes({ className = 'w-14 h-14' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="triGrad" x1="50" y1="12" x2="50" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <filter id="triShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#9F1239" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* 3D base depth */}
      <path d="M50 18 L88 88 L12 88 Z" fill="#9F1239" />
      {/* Main triangular face */}
      <path d="M50 12 L88 82 L12 82 Z" fill="url(#triGrad)" filter="url(#triShadow)" />
      {/* Bevel highlight */}
      <path d="M50 16 L20 78 L50 68 Z" fill="white" fillOpacity="0.22" />
    </svg>
  );
}

export function BadgeAnimals({ className = 'w-14 h-14' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dogFace" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <filter id="dogShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#B45309" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Left Ear */}
      <ellipse cx="22" cy="38" rx="14" ry="22" transform="rotate(-18 22 38)" fill="#B45309" />
      {/* Right Ear */}
      <ellipse cx="78" cy="38" rx="14" ry="22" transform="rotate(18 78 38)" fill="#B45309" />
      {/* Head */}
      <rect x="22" y="24" width="56" height="58" rx="28" fill="url(#dogFace)" filter="url(#dogShadow)" />
      {/* Eyes */}
      <ellipse cx="38" cy="48" rx="4.5" ry="5.5" fill="#1F2937" />
      <circle cx="36.5" cy="46" r="1.8" fill="white" />
      <ellipse cx="62" cy="48" rx="4.5" ry="5.5" fill="#1F2937" />
      <circle cx="60.5" cy="46" r="1.8" fill="white" />
      {/* Snout */}
      <ellipse cx="50" cy="62" rx="14" ry="10" fill="#FEF3C7" />
      {/* Nose */}
      <path d="M46 58 Q50 62 54 58 Q50 63 46 58 Z" fill="#1F2937" />
      {/* Mouth */}
      <path d="M50 62 Q50 68 50 70" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
      {/* Tongue */}
      <path d="M46 68 Q50 78 54 68 Z" fill="#F43F5E" />
    </svg>
  );
}

export function BadgeStories({ className = 'w-14 h-14' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bookCover" x1="10" y1="50" x2="90" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <filter id="bookShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#0369A1" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Cover Spine / Back */}
      <path d="M12 28 C26 24, 48 24, 50 30 C52 24, 74 24, 88 28 L88 78 C74 74, 52 74, 50 80 C48 74, 26 74, 12 78 Z" fill="#0369A1" />
      {/* Cover Body */}
      <path d="M12 25 C26 21, 48 21, 50 27 C52 21, 74 21, 88 25 L88 75 C74 71, 52 71, 50 77 C48 71, 26 71, 12 75 Z" fill="url(#bookCover)" filter="url(#bookShadow)" />
      {/* Pages Left */}
      <path d="M16 28 C28 24, 46 25, 48 29 L48 73 C46 69, 28 68, 16 72 Z" fill="#F8FAFC" />
      {/* Pages Right */}
      <path d="M84 28 C72 24, 54 25, 52 29 L52 73 C54 69, 72 68, 84 72 Z" fill="#FFFFFF" />
      {/* Bookmark Ribbon */}
      <path d="M48 27 L52 27 L52 48 L50 44 L48 48 Z" fill="#F59E0B" />
    </svg>
  );
}

export function CategoryBadge({ id, className = 'w-14 h-14' }) {
  switch (id) {
    case 'cat-alphabet':
      return <BadgeAlphabet className={className} />;
    case 'cat-numbers':
      return <BadgeNumbers className={className} />;
    case 'cat-colors':
      return <BadgeColors className={className} />;
    case 'cat-shapes':
      return <BadgeShapes className={className} />;
    case 'cat-animals':
      return <BadgeAnimals className={className} />;
    case 'cat-stories':
      return <BadgeStories className={className} />;
    default:
      return <BadgeAlphabet className={className} />;
  }
}
