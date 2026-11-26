// Clean, consistent vector icon system for EarlyLearn Hub.
// - Admin / Teacher / Auth areas: crisp line icons powered by lucide-react.
// - Student / Parent areas: playful duotone icons on soft blobs & custom kid SVG illustrations.
// - Shared <Icon name="..." /> wrapper so icons are swappable everywhere.

import * as Lucide from 'lucide-react';
import { PlayfulIcon, KidIllustration } from './KidIllustrations.jsx';

const LINE_ICON_REGISTRY = {
  // Navigation & Dashboards
  overview: Lucide.LayoutGrid,
  'bar-chart': Lucide.BarChart3,
  'trending-up': Lucide.TrendingUp,
  users: Lucide.Users,
  user: Lucide.User,
  'user-check': Lucide.UserCheck,
  'user-plus': Lucide.UserPlus,
  teachers: Lucide.GraduationCap,
  teacher: Lucide.GraduationCap,
  learners: Lucide.Baby,
  child: Lucide.Baby,
  categories: Lucide.FolderKanban,
  folder: Lucide.Folder,
  'folder-open': Lucide.FolderOpen,
  materials: Lucide.BookOpen,
  book: Lucide.BookOpen,
  books: Lucide.Library,
  approvals: Lucide.CheckCircle2,
  building: Lucide.Building2,
  landmark: Lucide.Landmark,
  school: Lucide.School,
  home: Lucide.Home,
  neighborhood: Lucide.MapPinned,

  // Common Actions
  search: Lucide.Search,
  plus: Lucide.Plus,
  refresh: Lucide.RefreshCw,
  restore: Lucide.RotateCcw,
  edit: Lucide.Pencil,
  pencil: Lucide.Pencil,
  key: Lucide.KeyRound,
  lock: Lucide.Lock,
  unlock: Lucide.Unlock,
  shield: Lucide.ShieldCheck,
  trash: Lucide.Trash2,
  check: Lucide.Check,
  'check-circle': Lucide.CheckCircle2,
  close: Lucide.X,
  'x-circle': Lucide.XCircle,
  copy: Lucide.Copy,
  clipboard: Lucide.ClipboardList,
  'clipboard-check': Lucide.ClipboardCheck,
  pin: Lucide.MapPin,
  'push-pin': Lucide.Pin,
  calendar: Lucide.Calendar,
  clock: Lucide.Clock,
  alarm: Lucide.AlarmClock,
  bell: Lucide.Bell,
  megaphone: Lucide.Megaphone,
  send: Lucide.Send,
  rocket: Lucide.Rocket,
  save: Lucide.Save,
  printer: Lucide.Printer,
  download: Lucide.Download,
  upload: Lucide.Upload,
  'cloud-upload': Lucide.CloudUpload,
  inbox: Lucide.Inbox,
  eye: Lucide.Eye,
  'eye-off': Lucide.EyeOff,
  play: Lucide.Play,
  stop: Lucide.Square,
  speaker: Lucide.Volume2,
  menu: Lucide.Menu,
  settings: Lucide.Settings,
  'external-link': Lucide.ExternalLink,
  'arrow-right': Lucide.ArrowRight,
  'arrow-left': Lucide.ArrowLeft,
  'chevron-left': Lucide.ChevronLeft,
  'chevron-right': Lucide.ChevronRight,

  // Media, Files & Communication
  video: Lucide.Video,
  film: Lucide.Clapperboard,
  music: Lucide.Music,
  image: Lucide.Image,
  camera: Lucide.Camera,
  file: Lucide.FileText,
  'file-Spreadsheet': Lucide.FileSpreadsheet,
  paperclip: Lucide.Paperclip,
  ruler: Lucide.Ruler,
  layers: Lucide.Layers,
  table: Lucide.Table2,
  cards: Lucide.LayoutList,
  comment: Lucide.MessageSquare,
  phone: Lucide.Phone,
  smartphone: Lucide.Smartphone,
  mail: Lucide.Mail,
  loader: Lucide.Loader2,
  'help-circle': Lucide.HelpCircle,
  'arrow-big-up': Lucide.ArrowBigUp,
  'check-shield': Lucide.ShieldCheck,
  'alert-octagon': Lucide.AlertOctagon,

  // Status, Domain & Categories
  warning: Lucide.AlertTriangle,
  'alert-circle': Lucide.AlertCircle,
  info: Lucide.Info,
  lightbulb: Lucide.Lightbulb,
  target: Lucide.Target,
  star: Lucide.Star,
  sparkles: Lucide.Sparkles,
  trophy: Lucide.Trophy,
  seedling: Lucide.Sprout,
  flower: Lucide.Flower2,
  sun: Lucide.Sun,
  'cloud-sun': Lucide.CloudSun,
  baby: Lucide.Baby,
  dice: Lucide.Dices,
  puzzle: Lucide.Puzzle,
  palette: Lucide.Palette,
  shapes: Lucide.Shapes,
  alphabet: Lucide.CaseSensitive,
  numbers: Lucide.Binary,
  colors: Lucide.Palette,
  animals: Lucide.PawPrint,
  stories: Lucide.BookOpenText,
  car: Lucide.Car,
  globe: Lucide.Globe,
  heart: Lucide.Heart,
  apple: Lucide.Apple,
};

// Canonical icon keys stored in `categories.icon` in Supabase
export const CATEGORY_ICON_OPTIONS = [
  { key: 'alphabet', label: 'Alphabet' },
  { key: 'numbers', label: 'Numbers' },
  { key: 'colors', label: 'Colors & Art' },
  { key: 'shapes', label: 'Shapes' },
  { key: 'animals', label: 'Animals & Nature' },
  { key: 'stories', label: 'Stories & Reading' },
  { key: 'music', label: 'Music & Songs' },
  { key: 'video', label: 'Videos' },
  { key: 'puzzle', label: 'Games & Logic' },
  { key: 'seedling', label: 'Values & Growth' },
  { key: 'car', label: 'Transportation' },
  { key: 'globe', label: 'Community & World' },
  { key: 'star', label: 'Milestones' },
  { key: 'book', label: 'General Lesson' },
];

// Maps legacy database codepoint sequences or names to clean icon keys without any literal emoji in source
const LEGACY_CODEPOINT_KEY_MAP = {
  '1f524': 'alphabet', // legacy ABC symbol
  '1f522': 'numbers',  // legacy 1234 symbol
  '1f3a8': 'colors',   // legacy palette
  '1f53a': 'shapes',   // legacy triangle
  '1f536': 'shapes',   // legacy diamond
  '1f436': 'animals',  // legacy dog
  '1f431': 'animals',  // legacy cat
  '1f4d6': 'stories',  // legacy open book
  '1f4da': 'books',    // legacy books
  '1f697': 'car',      // legacy car
  '1f699': 'car',      // legacy suv
  '1f3b5': 'music',    // legacy note
  '1f3ac': 'video',    // legacy clapper
  '1f9e9': 'puzzle',   // legacy puzzle
  '1f331': 'seedling', // legacy seedling
  '2b50': 'star',      // legacy star
  '270f': 'pencil',    // legacy pencil
  '1f4dd': 'file',     // legacy memo
};

export function resolveCategoryIconKey(rawValue, fallback = 'book') {
  if (!rawValue || typeof rawValue !== 'string') return fallback;
  const trimmed = rawValue.trim().toLowerCase();
  if (!trimmed) return fallback;

  if (LINE_ICON_REGISTRY[trimmed]) return trimmed;

  // Check if value starts with a non-ASCII legacy symbol in DB
  const firstCp = trimmed.codePointAt(0);
  if (firstCp && firstCp > 127) {
    const hex = firstCp.toString(16).toLowerCase();
    return LEGACY_CODEPOINT_KEY_MAP[hex] || fallback;
  }

  // Name heuristics
  if (trimmed.includes('alpha') || trimmed.includes('abc') || trimmed.includes('letter')) return 'alphabet';
  if (trimmed.includes('num') || trimmed.includes('math') || trimmed.includes('count')) return 'numbers';
  if (trimmed.includes('color') || trimmed.includes('art') || trimmed.includes('paint')) return 'colors';
  if (trimmed.includes('shape')) return 'shapes';
  if (trimmed.includes('animal') || trimmed.includes('pet')) return 'animals';
  if (trimmed.includes('stor') || trimmed.includes('read') || trimmed.includes('book')) return 'stories';
  if (trimmed.includes('music') || trimmed.includes('song')) return 'music';
  if (trimmed.includes('video') || trimmed.includes('watch')) return 'video';
  if (trimmed.includes('car') || trimmed.includes('transport')) return 'car';

  return fallback;
}

/**
 * Shared swappable <Icon /> wrapper across the entire application.
 * - variant="line" (default): clean Lucide line icon for Admin/Teacher/Auth
 * - variant="playful": colorful Phosphor duotone icon (with optional soft rounded blob) for Student/Parent
 * - variant="illustration": custom colorful SVG illustration for flashcards & stories
 */
export function Icon({
  name = 'book',
  variant = 'line',
  size = 16,
  strokeWidth = 2,
  blob = true,
  className = '',
  label,
  title,
}) {
  if (variant === 'illustration') {
    return <KidIllustration name={name} className={className || 'w-14 h-14'} label={label} title={title} />;
  }

  if (variant === 'playful') {
    return (
      <PlayfulIcon
        name={name}
        size={size}
        blob={blob}
        className={className}
        label={label}
        title={title}
      />
    );
  }

  const resolvedKey = LINE_ICON_REGISTRY[name] ? name : resolveCategoryIconKey(name, 'book');
  const Comp = LINE_ICON_REGISTRY[resolvedKey] || Lucide.BookOpen;

  return (
    <Comp
      size={size}
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`.trim()}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      title={title || label || undefined}
    />
  );
}

export default Icon;

// Named icon components preserved for backwards compatibility across Admin/Teacher modules
export function IconOverview({ className = 'w-4 h-4', label, title }) {
  return <Lucide.LayoutGrid className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconUsers({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Users className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconTeachers({ className = 'w-4 h-4', label, title }) {
  return <Lucide.GraduationCap className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconLearners({ className = 'w-4 h-4', label, title }) {
  return <Lucide.User className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconCategories({ className = 'w-4 h-4', label, title }) {
  return <Lucide.FolderKanban className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconMaterials({ className = 'w-4 h-4', label, title }) {
  return <Lucide.BookOpen className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconApprovals({ className = 'w-4 h-4', label, title }) {
  return <Lucide.CheckCircle2 className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconSearch({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Search className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconPlus({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Plus className={className} strokeWidth={2.1} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconRefresh({ className = 'w-4 h-4', label, title }) {
  return <Lucide.RefreshCw className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconEdit({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Pencil className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconKey({ className = 'w-4 h-4', label, title }) {
  return <Lucide.KeyRound className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconTrash({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Trash2 className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconCheck({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Check className={className} strokeWidth={2.2} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconClose({ className = 'w-4 h-4', label, title }) {
  return <Lucide.X className={className} strokeWidth={2.1} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconCopy({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Copy className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconPin({ className = 'w-4 h-4', label, title }) {
  return <Lucide.MapPin className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconCalendar({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Calendar className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconShield({ className = 'w-4 h-4', label, title }) {
  return <Lucide.ShieldCheck className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconArrowRight({ className = 'w-4 h-4', label, title }) {
  return <Lucide.ArrowRight className={className} strokeWidth={2} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconDice({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Dices className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconVideo({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Video className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconBook({ className = 'w-4 h-4', label, title }) {
  return <Lucide.BookOpen className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconMusic({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Music className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconLayers({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Layers className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconBuilding({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Building2 className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}

export function IconUpload({ className = 'w-4 h-4', label, title }) {
  return <Lucide.Upload className={className} strokeWidth={1.9} aria-label={label} aria-hidden={label ? undefined : 'true'} title={title} />;
}
