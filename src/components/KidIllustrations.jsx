// Playful, colorful, rounded SVG illustrations & Phosphor duotone icon badges
// for Student/Parent dashboard, flashcards, counting visuals, shapes, animals, and stories.
import * as Phosphor from '@phosphor-icons/react';

// Soft child-friendly color themes for playful icon blobs
const PLAYFUL_THEMES = {
  coral: { bg: '#FFE4E6', ring: '#FECDD3', color: '#E11D48' },
  amber: { bg: '#FEF3C7', ring: '#FDE68A', color: '#D97706' },
  sky: { bg: '#E0F2FE', ring: '#BAE6FD', color: '#0284C7' },
  emerald: { bg: '#D1FAE5', ring: '#A7F3D0', color: '#059669' },
  purple: { bg: '#F3E8FF', ring: '#E9D5FF', color: '#7C3AED' },
  pink: { bg: '#FCE7F3', ring: '#FBCFE8', color: '#DB2777' },
  orange: { bg: '#FFEDD5', ring: '#FED7AA', color: '#EA580C' },
  teal: { bg: '#CCFBF1', ring: '#99F6E4', color: '#0D9488' },
  indigo: { bg: '#E0E7FF', ring: '#C7D2FE', color: '#4F46E5' },
  slate: { bg: '#F1F5F9', ring: '#E2E8F0', color: '#475569' },
};

const PLAYFUL_ICON_REGISTRY = {
  // Navigation & Actions
  'paper-plane': { icon: Phosphor.PaperPlaneTilt, theme: 'sky' },
  rocket: { icon: Phosphor.RocketLaunch, theme: 'coral' },
  logout: { icon: Phosphor.SignOut, theme: 'coral' },
  'arrow-left': { icon: Phosphor.ArrowLeft, theme: 'slate' },
  'arrow-right': { icon: Phosphor.ArrowRight, theme: 'sky' },
  'caret-left': { icon: Phosphor.CaretLeft, theme: 'sky' },
  'caret-right': { icon: Phosphor.CaretRight, theme: 'sky' },
  close: { icon: Phosphor.X, theme: 'coral' },
  search: { icon: Phosphor.MagnifyingGlass, theme: 'sky' },
  download: { icon: Phosphor.DownloadSimple, theme: 'emerald' },
  upload: { icon: Phosphor.UploadSimple, theme: 'sky' },
  'cloud-upload': { icon: Phosphor.CloudArrowUp, theme: 'sky' },
  cloud: { icon: Phosphor.Cloud, theme: 'sky' },
  camera: { icon: Phosphor.Camera, theme: 'coral' },
  settings: { icon: Phosphor.GearSix, theme: 'purple' },
  eye: { icon: Phosphor.Eye, theme: 'sky' },
  play: { icon: Phosphor.PlayCircle, theme: 'purple' },
  stop: { icon: Phosphor.StopCircle, theme: 'coral' },
  speaker: { icon: Phosphor.SpeakerHigh, theme: 'sky' },
  paperclip: { icon: Phosphor.Paperclip, theme: 'amber' },
  ruler: { icon: Phosphor.Ruler, theme: 'amber' },
  folder: { icon: Phosphor.FolderOpen, theme: 'amber' },

  // People & School
  'avatar-parent': { icon: Phosphor.UserCircleGear, theme: 'coral' },
  'avatar-child': { icon: Phosphor.Smiley, theme: 'amber' },
  family: { icon: Phosphor.UsersThree, theme: 'pink' },
  teacher: { icon: Phosphor.ChalkboardTeacher, theme: 'emerald' },
  school: { icon: Phosphor.Buildings, theme: 'sky' },
  hand: { icon: Phosphor.HandWaving, theme: 'amber' },
  handshake: { icon: Phosphor.Handshake, theme: 'orange' },
  run: { icon: Phosphor.PersonSimpleRun, theme: 'emerald' },
  chat: { icon: Phosphor.ChatsCircle, theme: 'purple' },

  // Learning & Status
  alphabet: { icon: Phosphor.TextAa, theme: 'coral' },
  numbers: { icon: Phosphor.NumberCircleOne, theme: 'teal' },
  colors: { icon: Phosphor.Palette, theme: 'amber' },
  palette: { icon: Phosphor.Palette, theme: 'pink' },
  shapes: { icon: Phosphor.Shapes, theme: 'emerald' },
  animals: { icon: Phosphor.PawPrint, theme: 'purple' },
  stories: { icon: Phosphor.BookOpenText, theme: 'orange' },
  'book-open': { icon: Phosphor.BookOpenText, theme: 'sky' },
  books: { icon: Phosphor.Books, theme: 'indigo' },
  clipboard: { icon: Phosphor.ClipboardText, theme: 'amber' },
  pencil: { icon: Phosphor.PencilSimpleLine, theme: 'orange' },
  crayon: { icon: Phosphor.PaintBrushBroad, theme: 'pink' },
  note: { icon: Phosphor.NotePencil, theme: 'sky' },
  video: { icon: Phosphor.FilmSlate, theme: 'purple' },
  file: { icon: Phosphor.FileText, theme: 'sky' },
  pdf: { icon: Phosphor.FilePdf, theme: 'coral' },
  image: { icon: Phosphor.Image, theme: 'emerald' },
  megaphone: { icon: Phosphor.Megaphone, theme: 'amber' },
  calendar: { icon: Phosphor.CalendarBlank, theme: 'sky' },
  clock: { icon: Phosphor.ClockCountdown, theme: 'amber' },
  check: { icon: Phosphor.CheckCircle, theme: 'emerald' },
  warning: { icon: Phosphor.WarningCircle, theme: 'amber' },
  celebrate: { icon: Phosphor.Confetti, theme: 'pink' },
  balloon: { icon: Phosphor.Balloon, theme: 'coral' },
  star: { icon: Phosphor.Star, theme: 'amber' },
  sparkles: { icon: Phosphor.Sparkle, theme: 'amber' },
  trophy: { icon: Phosphor.Trophy, theme: 'amber' },
  heart: { icon: Phosphor.Heart, theme: 'pink' },
  hearts: { icon: Phosphor.HeartStraight, theme: 'purple' },
  seedling: { icon: Phosphor.Plant, theme: 'emerald' },
  flower: { icon: Phosphor.FlowerLotus, theme: 'pink' },
  hibiscus: { icon: Phosphor.Flower, theme: 'coral' },
  puzzle: { icon: Phosphor.PuzzlePiece, theme: 'indigo' },
  lightbulb: { icon: Phosphor.LightbulbFilament, theme: 'amber' },
  cake: { icon: Phosphor.Cake, theme: 'pink' },
  music: { icon: Phosphor.MusicNotes, theme: 'purple' },
  car: { icon: Phosphor.CarProfile, theme: 'sky' },
  globe: { icon: Phosphor.GlobeHemisphereEast, theme: 'teal' },
};

/**
 * Playful rounded icon on a soft colored circle/blob background (or inline duotone).
 */
export function PlayfulIcon({
  name,
  size = 20,
  blob = true,
  blobClassName = '',
  className = '',
  label,
  title,
}) {
  const entry = PLAYFUL_ICON_REGISTRY[name] || PLAYFUL_ICON_REGISTRY.sparkles;
  const IconComp = entry.icon;
  const palette = PLAYFUL_THEMES[entry.theme] || PLAYFUL_THEMES.amber;

  if (!blob) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        role={label ? 'img' : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : 'true'}
        title={title || label || undefined}
      >
        <IconComp size={size} weight="duotone" color={palette.color} />
      </span>
    );
  }

  const boxPx = Math.round(size * 1.75);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl shrink-0 select-none ${blobClassName} ${className}`}
      style={{
        width: `${boxPx}px`,
        height: `${boxPx}px`,
        backgroundColor: palette.bg,
        border: `1.5px solid ${palette.ring}`,
      }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      title={title || label || undefined}
    >
      <IconComp size={size} weight="duotone" color={palette.color} />
    </span>
  );
}

/**
 * Custom colorful child-friendly SVG illustrations for all flashcards, animals,
 * fruits, everyday objects, weather, colors, shapes, and stories.
 */
export function KidIllustration({ name, className = 'w-16 h-16', label, title }) {
  const ariaProps = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true' };

  const renderSvg = () => {
    switch (name) {
      case 'apple':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFE4E6" />
            <path d="M50 28 C48 18, 55 14, 58 14" stroke="#78350F" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M53 22 C62 14, 74 18, 68 27 C62 31, 55 27, 53 22 Z" fill="#22C55E" />
            <path d="M50 30 C32 24, 18 38, 22 58 C25 75, 38 85, 50 81 C62 85, 75 75, 78 58 C82 38, 68 24, 50 30 Z" fill="#EF4444" />
            <ellipse cx="36" cy="46" rx="5" ry="10" transform="rotate(-20 36 46)" fill="#FCA5A5" opacity="0.65" />
            <circle cx="42" cy="56" r="3" fill="#1F2937" />
            <circle cx="58" cy="56" r="3" fill="#1F2937" />
            <path d="M45 63 Q50 68 55 63" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'ball':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <circle cx="50" cy="50" r="32" fill="#FFFFFF" stroke="#0284C7" strokeWidth="4" />
            <polygon points="50,36 62,45 57,59 43,59 38,45" fill="#0284C7" />
            <path d="M50 18 L50 36 M62 45 L80 40 M57 59 L69 75 M43 59 L31 75 M38 45 L20 40" stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        );

      case 'cat':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <polygon points="24,45 28,20 44,34" fill="#F97316" />
            <polygon points="76,45 72,20 56,34" fill="#F97316" />
            <polygon points="28,41 30,26 40,35" fill="#FBCFE8" />
            <polygon points="72,41 70,26 60,35" fill="#FBCFE8" />
            <ellipse cx="50" cy="56" rx="28" ry="24" fill="#FB923C" />
            <circle cx="39" cy="52" r="4" fill="#1F2937" />
            <circle cx="61" cy="52" r="4" fill="#1F2937" />
            <circle cx="37.8" cy="50.5" r="1.4" fill="#FFF" />
            <circle cx="59.8" cy="50.5" r="1.4" fill="#FFF" />
            <polygon points="47,59 53,59 50,63" fill="#EC4899" />
            <path d="M44 66 Q50 70 50 63 Q50 70 56 66" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M18 55 L30 57 M18 62 L30 61 M82 55 L70 57 M82 62 L70 61" stroke="#7C2D12" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );

      case 'black-cat':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E2E8F0" />
            <polygon points="24,45 28,20 44,34" fill="#1E293B" />
            <polygon points="76,45 72,20 56,34" fill="#1E293B" />
            <polygon points="28,41 30,26 40,35" fill="#F472B6" />
            <polygon points="72,41 70,26 60,35" fill="#F472B6" />
            <ellipse cx="50" cy="56" rx="28" ry="24" fill="#334155" />
            <circle cx="39" cy="52" r="4.5" fill="#FACC15" />
            <circle cx="61" cy="52" r="4.5" fill="#FACC15" />
            <circle cx="39" cy="52" r="2" fill="#0F172A" />
            <circle cx="61" cy="52" r="2" fill="#0F172A" />
            <polygon points="47,59 53,59 50,63" fill="#F472B6" />
            <path d="M44 66 Q50 70 56 66" stroke="#F8FAFC" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'dog':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <ellipse cx="23" cy="46" rx="11" ry="19" transform="rotate(-15 23 46)" fill="#B45309" />
            <ellipse cx="77" cy="46" rx="11" ry="19" transform="rotate(15 77 46)" fill="#B45309" />
            <rect x="24" y="28" width="52" height="50" rx="25" fill="#FBBF24" />
            <circle cx="39" cy="49" r="4.2" fill="#1F2937" />
            <circle cx="61" cy="49" r="4.2" fill="#1F2937" />
            <circle cx="37.8" cy="47.5" r="1.5" fill="#FFF" />
            <circle cx="59.8" cy="47.5" r="1.5" fill="#FFF" />
            <ellipse cx="50" cy="62" rx="13" ry="9" fill="#FEF9C3" />
            <ellipse cx="50" cy="58" rx="4.5" ry="3.2" fill="#1F2937" />
            <path d="M46 65 Q50 74 54 65 Z" fill="#F43F5E" />
          </svg>
        );

      case 'egg':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF9C3" />
            <path d="M50 18 C32 18, 24 44, 24 60 C24 76, 35 84, 50 84 C65 84, 76 76, 76 60 C76 44, 68 18, 50 18 Z" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="3.5" />
            <circle cx="50" cy="58" r="12" fill="#FBBF24" />
            <circle cx="46" cy="54" r="3" fill="#FEF08A" />
          </svg>
        );

      case 'fish':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <polygon points="72,50 88,34 88,66" fill="#FB923C" />
            <path d="M44 34 L56 22 L58 36 Z" fill="#F97316" />
            <ellipse cx="46" cy="50" rx="27" ry="19" fill="#38BDF8" />
            <path d="M48 33 Q55 50 48 67" stroke="#BAE6FD" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="31" cy="46" r="4" fill="#0F172A" />
            <circle cx="29.8" cy="44.8" r="1.4" fill="#FFF" />
            <path d="M24 55 Q29 59 34 55" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'goat':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DCFCE7" />
            <path d="M36 30 Q30 15 22 20" stroke="#92400E" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M64 30 Q70 15 78 20" stroke="#92400E" strokeWidth="5" strokeLinecap="round" fill="none" />
            <ellipse cx="23" cy="44" rx="9" ry="5" transform="rotate(-20 23 44)" fill="#E5E7EB" />
            <ellipse cx="77" cy="44" rx="9" ry="5" transform="rotate(20 77 44)" fill="#E5E7EB" />
            <ellipse cx="50" cy="52" rx="22" ry="24" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2.5" />
            <circle cx="41" cy="48" r="3.5" fill="#1E293B" />
            <circle cx="59" cy="48" r="3.5" fill="#1E293B" />
            <ellipse cx="50" cy="62" rx="9" ry="6" fill="#FDE68A" />
            <path d="M46 76 L50 85 L54 76 Z" fill="#CBD5E1" />
          </svg>
        );

      case 'house':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFEDD5" />
            <rect x="26" y="46" width="48" height="36" rx="4" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="3" />
            <polygon points="18,48 50,20 82,48" fill="#EF4444" stroke="#DC2626" strokeWidth="3" strokeLinejoin="round" />
            <rect x="43" y="58" width="14" height="24" rx="3" fill="#92400E" />
            <rect x="31" y="54" width="9" height="9" rx="2" fill="#38BDF8" />
            <rect x="60" y="54" width="9" height="9" rx="2" fill="#38BDF8" />
          </svg>
        );

      case 'island':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <path d="M16 72 Q50 64 84 72 L80 82 Q50 88 20 82 Z" fill="#38BDF8" />
            <path d="M26 70 Q50 52 74 70 Z" fill="#FBBF24" />
            <path d="M50 62 Q48 44 54 32" stroke="#92400E" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M54 32 Q38 28 34 38 M54 32 Q70 28 74 38 M54 32 Q44 18 36 24 M54 32 Q66 18 72 25" stroke="#16A34A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'jeep':
      case 'car':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <rect x="18" y="42" width="64" height="26" rx="8" fill="#EF4444" />
            <path d="M26 42 L34 28 L68 28 L76 42 Z" fill="#FBBF24" />
            <rect x="36" y="31" width="12" height="9" rx="2" fill="#E0F2FE" />
            <rect x="52" y="31" width="14" height="9" rx="2" fill="#E0F2FE" />
            <rect x="20" y="52" width="60" height="5" fill="#3B82F6" />
            <circle cx="33" cy="69" r="9" fill="#1E293B" />
            <circle cx="33" cy="69" r="4" fill="#CBD5E1" />
            <circle cx="67" cy="69" r="9" fill="#1E293B" />
            <circle cx="67" cy="69" r="4" fill="#CBD5E1" />
          </svg>
        );

      case 'kite':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <polygon points="50,16 74,44 50,70 26,44" fill="#F43F5E" />
            <polygon points="50,16 74,44 50,44" fill="#FBBF24" />
            <polygon points="50,44 26,44 50,70" fill="#3B82F6" />
            <path d="M50 70 Q58 78 48 86" stroke="#64748B" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="53" cy="77" r="3" fill="#10B981" />
          </svg>
        );

      case 'leaf':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DCFCE7" />
            <path d="M26 74 C24 40, 48 22, 76 24 C74 54, 56 76, 26 74 Z" fill="#22C55E" />
            <path d="M22 78 Q48 52 70 30" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M42 58 L38 45 M54 46 L65 50" stroke="#86EFAC" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );

      case 'mango':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <path d="M54 22 Q58 14 64 16" stroke="#78350F" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M56 20 C66 15, 74 22, 66 28 C60 30, 56 25, 56 20 Z" fill="#22C55E" />
            <path d="M54 24 C34 24, 24 44, 28 62 C32 78, 52 84, 64 74 C74 65, 74 36, 54 24 Z" fill="#FBBF24" />
            <ellipse cx="42" cy="46" rx="6" ry="12" transform="rotate(-20 42 46)" fill="#FDE047" opacity="0.7" />
          </svg>
        );

      case 'nest':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <ellipse cx="40" cy="48" rx="9" ry="12" transform="rotate(-12 40 48)" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="2" />
            <ellipse cx="58" cy="48" rx="9" ry="12" transform="rotate(12 58 48)" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="2" />
            <path d="M20 52 C22 74, 78 74, 80 52 Z" fill="#B45309" />
            <path d="M24 56 Q50 66 76 56 M28 63 Q50 72 72 63" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'orange':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFEDD5" />
            <path d="M52 20 C62 14, 70 20, 62 27 C56 29, 52 24, 52 20 Z" fill="#22C55E" />
            <circle cx="50" cy="55" r="27" fill="#F97316" />
            <circle cx="40" cy="45" r="2.5" fill="#FDBA74" />
            <circle cx="46" cy="40" r="2" fill="#FDBA74" />
            <circle cx="36" cy="53" r="2" fill="#FDBA74" />
          </svg>
        );

      case 'pineapple':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF9C3" />
            <path d="M50 14 L42 34 L58 34 Z" fill="#16A34A" />
            <path d="M36 18 L44 36 L52 32 Z" fill="#22C55E" />
            <path d="M64 18 L56 36 L48 32 Z" fill="#22C55E" />
            <rect x="30" y="33" width="40" height="48" rx="19" fill="#F59E0B" />
            <path d="M35 44 L65 70 M35 58 L56 77 M44 36 L65 55 M65 44 L35 70 M65 58 L44 77 M56 36 L35 55" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="43" cy="54" r="3" fill="#1F2937" />
            <circle cx="57" cy="54" r="3" fill="#1F2937" />
            <path d="M46 61 Q50 65 54 61" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'queen':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FCE7F3" />
            <polygon points="22,68 20,34 38,50 50,26 62,50 80,34 78,68" fill="#FBBF24" stroke="#D97706" strokeWidth="3" strokeLinejoin="round" />
            <rect x="22" y="66" width="56" height="9" rx="4" fill="#F59E0B" />
            <circle cx="50" cy="24" r="4" fill="#EC4899" />
            <circle cx="20" cy="32" r="3.5" fill="#3B82F6" />
            <circle cx="80" cy="32" r="3.5" fill="#3B82F6" />
            <circle cx="50" cy="56" r="4.5" fill="#EF4444" />
          </svg>
        );

      case 'rain':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <path d="M30 56 H70 A12 12 0 0 0 70 33 A16 16 0 0 0 40 29 A13 13 0 0 0 30 56 Z" fill="#60A5FA" />
            <path d="M36 64 L32 76 M50 64 L46 76 M64 64 L60 76" stroke="#0284C7" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );

      case 'sun':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF9C3" />
            <g stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round">
              <line x1="50" y1="14" x2="50" y2="23" />
              <line x1="50" y1="77" x2="50" y2="86" />
              <line x1="14" y1="50" x2="23" y2="50" />
              <line x1="77" y1="50" x2="86" y2="50" />
              <line x1="25" y1="25" x2="31" y2="31" />
              <line x1="69" y1="69" x2="75" y2="75" />
              <line x1="75" y1="25" x2="69" y2="31" />
              <line x1="31" y1="69" x2="25" y2="75" />
            </g>
            <circle cx="50" cy="50" r="21" fill="#FBBF24" />
            <circle cx="43" cy="47" r="2.8" fill="#78350F" />
            <circle cx="57" cy="47" r="2.8" fill="#78350F" />
            <path d="M44 55 Q50 60 56 55" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'tree':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DCFCE7" />
            <rect x="43" y="56" width="14" height="26" rx="3" fill="#92400E" />
            <circle cx="50" cy="36" r="19" fill="#22C55E" />
            <circle cx="35" cy="47" r="15" fill="#16A34A" />
            <circle cx="65" cy="47" r="15" fill="#16A34A" />
          </svg>
        );

      case 'umbrella':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#F3E8FF" />
            <path d="M50 22 V74 Q50 82 42 82 Q36 82 36 76" stroke="#7C3AED" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M18 52 C20 28, 80 28, 82 52 Z" fill="#EC4899" />
            <path d="M38 52 C40 30, 60 30, 62 52 Z" fill="#FBBF24" />
          </svg>
        );

      case 'vegetables':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DCFCE7" />
            <rect x="43" y="54" width="14" height="24" rx="4" fill="#86EFAC" />
            <circle cx="36" cy="44" r="14" fill="#16A34A" />
            <circle cx="64" cy="44" r="14" fill="#16A34A" />
            <circle cx="50" cy="35" r="16" fill="#22C55E" />
          </svg>
        );

      case 'water':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <path d="M50 18 C50 18, 74 48, 74 63 C74 76, 63 84, 50 84 C37 84, 26 76, 26 63 C26 48, 50 18, 50 18 Z" fill="#0EA5E9" />
            <ellipse cx="40" cy="60" rx="5" ry="10" transform="rotate(-15 40 60)" fill="#BAE6FD" opacity="0.75" />
          </svg>
        );

      case 'xylophone':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#F3E8FF" />
            <rect x="20" y="28" width="12" height="44" rx="5" fill="#EF4444" />
            <rect x="35" y="32" width="12" height="36" rx="5" fill="#F59E0B" />
            <rect x="50" y="36" width="12" height="28" rx="5" fill="#10B981" />
            <rect x="65" y="40" width="12" height="20" rx="5" fill="#3B82F6" />
            <circle cx="26" cy="50" r="2" fill="#FFF" />
            <circle cx="41" cy="50" r="2" fill="#FFF" />
            <circle cx="56" cy="50" r="2" fill="#FFF" />
            <circle cx="71" cy="50" r="2" fill="#FFF" />
          </svg>
        );

      case 'yellow':
      case 'shape-heart':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill={name === 'yellow' ? '#FEF9C3' : '#FCE7F3'} />
            <path
              d="M50 78 C50 78, 20 58, 20 38 C20 26, 30 20, 40 24 C45 26, 48 30, 50 34 C52 30, 55 26, 60 24 C70 20, 80 26, 80 38 C80 58, 50 78, 50 78 Z"
              fill={name === 'yellow' ? '#FACC15' : '#EC4899'}
            />
          </svg>
        );

      case 'zebra':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#F1F5F9" />
            <ellipse cx="34" cy="26" rx="6" ry="10" fill="#1E293B" />
            <ellipse cx="66" cy="26" rx="6" ry="10" fill="#1E293B" />
            <rect x="28" y="28" width="44" height="50" rx="20" fill="#FFFFFF" stroke="#1E293B" strokeWidth="3" />
            <path d="M29 40 H42 M58 40 H71 M29 50 H40 M60 50 H71" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="50" cy="66" rx="15" ry="10" fill="#1E293B" />
            <circle cx="44" cy="65" r="2.5" fill="#FFF" />
            <circle cx="56" cy="65" r="2.5" fill="#FFF" />
            <circle cx="41" cy="45" r="3" fill="#0F172A" />
            <circle cx="59" cy="45" r="3" fill="#0F172A" />
          </svg>
        );

      case 'basket':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <path d="M30 48 C30 24, 70 24, 70 48" stroke="#B45309" strokeWidth="5" fill="none" />
            <path d="M22 48 H78 L70 78 H30 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="3" strokeLinejoin="round" />
            <path d="M26 58 H74 M28 68 H72 M42 48 V78 M58 48 V78" stroke="#B45309" strokeWidth="2.5" />
          </svg>
        );

      case 'flower':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FCE7F3" />
            <circle cx="50" cy="28" r="13" fill="#F472B6" />
            <circle cx="71" cy="43" r="13" fill="#F472B6" />
            <circle cx="63" cy="68" r="13" fill="#F472B6" />
            <circle cx="37" cy="68" r="13" fill="#F472B6" />
            <circle cx="29" cy="43" r="13" fill="#F472B6" />
            <circle cx="50" cy="50" r="12" fill="#FACC15" />
          </svg>
        );

      case 'butterfly':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#F3E8FF" />
            <ellipse cx="32" cy="40" rx="16" ry="14" fill="#A855F7" />
            <ellipse cx="68" cy="40" rx="16" ry="14" fill="#A855F7" />
            <ellipse cx="35" cy="62" rx="12" ry="11" fill="#EC4899" />
            <ellipse cx="65" cy="62" rx="12" ry="11" fill="#EC4899" />
            <rect x="47" y="30" width="6" height="42" rx="3" fill="#1E293B" />
            <path d="M48 30 Q42 20 36 22 M52 30 Q58 20 64 22" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'balloon':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFE4E6" />
            <ellipse cx="50" cy="44" rx="21" ry="25" fill="#F43F5E" />
            <polygon points="46,71 54,71 50,67" fill="#E11D48" />
            <path d="M50 71 Q55 79 47 86" stroke="#64748B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <ellipse cx="42" cy="36" rx="4" ry="8" transform="rotate(-20 42 36)" fill="#FDA4AF" />
          </svg>
        );

      case 'star':
      case 'shape-star':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF9C3" />
            <polygon
              points="50,16 60,38 84,41 66,57 71,81 50,69 29,81 34,57 16,41 40,38"
              fill="#FACC15"
              stroke="#EAB308"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'sparkle':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <path d="M50 16 L57 43 L84 50 L57 57 L50 84 L43 57 L16 50 L43 43 Z" fill="#F59E0B" />
            <circle cx="74" cy="26" r="5" fill="#EC4899" />
            <circle cx="26" cy="72" r="4" fill="#3B82F6" />
          </svg>
        );

      case 'wave':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DBEAFE" />
            <path d="M16 54 Q33 38 50 54 T84 54 L84 78 L16 78 Z" fill="#2563EB" />
            <path d="M20 66 Q36 54 52 66 T80 66" stroke="#93C5FD" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        );

      case 'carrot':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFEDD5" />
            <path d="M58 26 L68 16 M62 30 L76 24 M54 24 L56 14" stroke="#16A34A" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M66 32 C72 38, 42 78, 28 76 C26 62, 58 26, 66 32 Z" fill="#F97316" />
          </svg>
        );

      case 'eggplant':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#F3E8FF" />
            <path d="M56 24 C74 28, 76 66, 54 78 C34 84, 24 68, 34 50 C42 36, 46 22, 56 24 Z" fill="#7C3AED" />
            <path d="M48 26 L58 18 L64 28 Z" fill="#16A34A" />
          </svg>
        );

      case 'chocolate':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <rect x="28" y="22" width="44" height="56" rx="6" fill="#78350F" />
            <rect x="33" y="27" width="15" height="14" rx="2" fill="#92400E" />
            <rect x="52" y="27" width="15" height="14" rx="2" fill="#92400E" />
            <rect x="33" y="45" width="15" height="14" rx="2" fill="#92400E" />
            <rect x="52" y="45" width="15" height="14" rx="2" fill="#92400E" />
            <path d="M26 56 L74 50 L74 78 L26 78 Z" fill="#EF4444" />
          </svg>
        );

      case 'cloud':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <path d="M28 66 H72 A14 14 0 0 0 72 39 A18 18 0 0 0 38 35 A15 15 0 0 0 28 66 Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="3" />
          </svg>
        );

      // 2D Geometric Shapes
      case 'shape-circle':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFE4E6" />
            <circle cx="50" cy="50" r="28" fill="#F43F5E" stroke="#BE123C" strokeWidth="3.5" />
          </svg>
        );
      case 'shape-square':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DBEAFE" />
            <rect x="24" y="24" width="52" height="52" rx="6" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="3.5" />
          </svg>
        );
      case 'shape-triangle':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DCFCE7" />
            <polygon points="50,20 80,74 20,74" fill="#10B981" stroke="#047857" strokeWidth="3.5" strokeLinejoin="round" />
          </svg>
        );
      case 'shape-rectangle':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFEDD5" />
            <rect x="18" y="32" width="64" height="36" rx="6" fill="#F97316" stroke="#C2410C" strokeWidth="3.5" />
          </svg>
        );
      case 'shape-oval':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#F3E8FF" />
            <ellipse cx="50" cy="50" rx="20" ry="30" fill="#8B5CF6" stroke="#6D28D9" strokeWidth="3.5" />
          </svg>
        );
      case 'shape-diamond':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <polygon points="50,18 78,50 50,82 22,50" fill="#0EA5E9" stroke="#0369A1" strokeWidth="3.5" strokeLinejoin="round" />
          </svg>
        );

      // Additional Farm & Philippine Animals
      case 'carabao':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E2E8F0" />
            <path d="M28 36 C12 28, 12 16, 26 20" stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M72 36 C88 28, 88 16, 74 20" stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
            <ellipse cx="50" cy="54" rx="24" ry="22" fill="#475569" />
            <ellipse cx="50" cy="64" rx="16" ry="10" fill="#94A3B8" />
            <circle cx="44" cy="64" r="2.8" fill="#1E293B" />
            <circle cx="56" cy="64" r="2.8" fill="#1E293B" />
            <circle cx="40" cy="48" r="3.5" fill="#0F172A" />
            <circle cx="60" cy="48" r="3.5" fill="#0F172A" />
          </svg>
        );

      case 'cow':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <ellipse cx="23" cy="42" rx="9" ry="5" fill="#1E293B" />
            <ellipse cx="77" cy="42" rx="9" ry="5" fill="#1E293B" />
            <rect x="26" y="28" width="48" height="48" rx="22" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2.5" />
            <circle cx="38" cy="38" r="7" fill="#1E293B" />
            <ellipse cx="50" cy="64" rx="17" ry="10" fill="#FBCFE8" />
            <circle cx="44" cy="64" r="2.5" fill="#9D174D" />
            <circle cx="56" cy="64" r="2.5" fill="#9D174D" />
            <circle cx="40" cy="49" r="3.2" fill="#0F172A" />
            <circle cx="60" cy="49" r="3.2" fill="#0F172A" />
          </svg>
        );

      case 'chicken':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFEDD5" />
            <circle cx="45" cy="24" r="6" fill="#EF4444" />
            <circle cx="55" cy="24" r="6" fill="#EF4444" />
            <ellipse cx="50" cy="56" rx="24" ry="24" fill="#FFFBEB" stroke="#FBBF24" strokeWidth="3" />
            <polygon points="45,54 55,54 50,63" fill="#F59E0B" />
            <circle cx="41" cy="48" r="3.5" fill="#1E293B" />
            <circle cx="59" cy="48" r="3.5" fill="#1E293B" />
          </svg>
        );

      case 'duck':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <circle cx="50" cy="46" r="22" fill="#FACC15" />
            <ellipse cx="50" cy="56" rx="14" ry="7" fill="#F97316" />
            <circle cx="41" cy="42" r="3.5" fill="#1E293B" />
            <circle cx="59" cy="42" r="3.5" fill="#1E293B" />
          </svg>
        );

      case 'pig':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FCE7F3" />
            <polygon points="24,38 28,20 42,30" fill="#F472B6" />
            <polygon points="76,38 72,20 58,30" fill="#F472B6" />
            <circle cx="50" cy="54" r="25" fill="#FBCFE8" stroke="#F472B6" strokeWidth="2.5" />
            <ellipse cx="50" cy="59" rx="11" ry="8" fill="#F472B6" />
            <circle cx="46" cy="59" r="2.5" fill="#9D174D" />
            <circle cx="54" cy="59" r="2.5" fill="#9D174D" />
            <circle cx="40" cy="46" r="3.2" fill="#1E293B" />
            <circle cx="60" cy="46" r="3.2" fill="#1E293B" />
          </svg>
        );

      case 'horse':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <polygon points="34,30 38,16 46,28" fill="#78350F" />
            <polygon points="66,30 62,16 54,28" fill="#78350F" />
            <rect x="30" y="26" width="40" height="52" rx="18" fill="#B45309" />
            <ellipse cx="50" cy="66" rx="14" ry="9" fill="#FDE68A" />
            <circle cx="45" cy="66" r="2.2" fill="#78350F" />
            <circle cx="55" cy="66" r="2.2" fill="#78350F" />
            <circle cx="41" cy="46" r="3.2" fill="#1E293B" />
            <circle cx="59" cy="46" r="3.2" fill="#1E293B" />
          </svg>
        );

      case 'bird':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" />
            <circle cx="50" cy="52" r="23" fill="#38BDF8" />
            <ellipse cx="50" cy="60" rx="14" ry="11" fill="#BAE6FD" />
            <polygon points="46,48 54,48 50,56" fill="#F59E0B" />
            <circle cx="41" cy="43" r="3.2" fill="#0F172A" />
            <circle cx="59" cy="43" r="3.2" fill="#0F172A" />
          </svg>
        );

      case 'frog':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#DCFCE7" />
            <circle cx="35" cy="34" r="10" fill="#22C55E" />
            <circle cx="65" cy="34" r="10" fill="#22C55E" />
            <ellipse cx="50" cy="56" rx="26" ry="20" fill="#22C55E" />
            <circle cx="35" cy="34" r="4" fill="#0F172A" />
            <circle cx="65" cy="34" r="4" fill="#0F172A" />
            <path d="M36 58 Q50 68 64 58" stroke="#14532D" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FEF3C7" />
            <polygon
              points="50,20 59,40 80,43 65,57 69,78 50,68 31,78 35,57 20,43 41,40"
              fill="#F59E0B"
            />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
      title={title || label || undefined}
      {...ariaProps}
    >
      {renderSvg()}
    </span>
  );
}

/**
 * Renders N playful mini illustrations for number counting cards (0 renders an empty basket).
 */
export function CountingVisual({ iconKey = 'star', count = 1, itemSize = 'w-7 h-7', label }) {
  if (count <= 0) {
    return (
      <div
        className="inline-flex items-center justify-center"
        role={label ? 'img' : undefined}
        aria-label={label || 'Zero items (empty basket)'}
      >
        <KidIllustration name="basket" className="w-10 h-10" />
      </div>
    );
  }

  const items = Array.from({ length: count }, (_, idx) => idx);
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1"
      role={label ? 'img' : undefined}
      aria-label={label || `${count} ${iconKey}`}
    >
      {items.map((idx) => (
        <KidIllustration key={idx} name={iconKey} className={itemSize} />
      ))}
    </div>
  );
}
