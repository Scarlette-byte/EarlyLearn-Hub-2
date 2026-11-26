import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { isSuperAdminUser } from '../../lib/roles.js';
import Icon from '../Icons.jsx';
import { Button, Card, Badge } from '../ui/index.js';
import {
  isAuthenticSupabaseMaterial,
  getCleanTeacherModulesList,
  deduplicateTeacherModules,
  cleanTeacherDisplayName,
} from '../../lib/curriculumData.js';

export default function MswdOverview({
  profile,
  learnersCount = 0,
  cdcsCount = 0,
  teachersCount = 0,
  pendingVerificationCount = 0,
  assessmentsCount = 0,
  onNavigateTab,
}) {
  const isSuperAdmin = isSuperAdminUser(profile);

  const getLocalCompliedActivities = () => {
    return getCleanTeacherModulesList();
  };

  const [compliedActivities, setCompliedActivities] = useState(getLocalCompliedActivities);

  const loadCompliedActivities = useCallback(async () => {
    const localList = getLocalCompliedActivities();
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data
          .filter((m) => isAuthenticSupabaseMaterial(m))
          .map((m) => {
            let meta = {};
            let cleanDescription = m.content_text || '';
            if (m.content_text && m.content_text.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(m.content_text);
                if (parsed && parsed.__metadata) {
                  meta = parsed;
                  cleanDescription = parsed.description || '';
                }
              } catch {}
            }
            const isApproved = m.status === 'approved' || m.status === 'Approved';
            const isRejected =
              m.status === 'rejected' || m.status === 'Rejected' || m.status === 'needs_revision';
            return {
              id: m.id,
              title: m.title || 'Curriculum Learning Activity',
              teacher_name: cleanTeacherDisplayName(meta.teacher_name) || 'CDC Teacher',
              teacher_id: m.created_by,
              cdc_name: meta.cdc_name || 'Daycare Center',
              barangay: meta.barangay || 'Manolo Fortich',
              level: meta.level || (m.age_range?.includes('3') ? 'Pre-K1' : 'Pre-K2'),
              quarter: meta.quarter || 1,
              week: meta.week || 'Week 1',
              sub_theme: meta.sub_theme || '',
              theme: meta.theme || 'Early Childhood Learning',
              module_type: meta.module_type || 'Activity Worksheet',
              file_type: meta.file_type || 'PDF',
              file_size: meta.file_size || '2.4 MB',
              file_name: meta.file_name || null,
              upload_date: m.created_at
                ? new Date(m.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })
                : 'Recent',
              status: isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending Review',
              verified_by_mswd: isApproved,
              posted_to_students: Boolean(meta.posted_to_students),
              target_student_name: meta.target_student_name || 'All Class Learners',
              description: cleanDescription,
              content_url: m.content_url || null,
            };
          });

        const deduplicatedSb = deduplicateTeacherModules(mapped);
        const merged = deduplicatedSb.map((sb) => {
          const loc = localList.find(
            (l) =>
              l.id === sb.id ||
              (l.title &&
                sb.title &&
                l.title.trim().toLowerCase() === sb.title.trim().toLowerCase())
          );
          if (loc) {
            const bestUrl =
              sb.content_url && !String(sb.content_url).startsWith('idb://filename/')
                ? sb.content_url
                : loc.content_url || sb.content_url || null;
            return {
              ...sb,
              file_name: sb.file_name || loc.file_name || null,
              file_type: sb.file_type || loc.file_type || 'PDF',
              file_size: sb.file_size || loc.file_size || '2.4 MB',
              posted_to_students: Boolean(loc.posted_to_students ?? sb.posted_to_students),
              target_student_name: loc.target_student_name || sb.target_student_name,
              content_url: bestUrl,
            };
          }
          return sb;
        });
        const localOnly = localList.filter((l) => !merged.some((s) => s.id === l.id));
        setCompliedActivities(deduplicateTeacherModules([...merged, ...localOnly]));
        return;
      }
    } catch {}
    setCompliedActivities(localList);
  }, []);

  useEffect(() => {
    loadCompliedActivities();
    const handleSync = () => loadCompliedActivities();
    window.addEventListener('storage', handleSync);
    window.addEventListener('earlylearn_modules_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_modules_updated', handleSync);
    };
  }, [loadCompliedActivities]);

  const MODULES = [
    {
      tab: 'enrollees',
      badge: 'Core Function 1',
      badgeVariant: 'primary',
      icon: 'landmark',
      iconTone: 'bg-brand-leaf-tint text-brand-leaf-deep border-brand-leaf/30',
      title: 'Barangay Enrollee Population',
      desc: 'Official municipal population census covering 3,041 enrollees across all 22 Barangays and 62 Child Development Centers (Pre-K 1: 1,001 • Pre-K 2: 1,596 • ITED: 439 • 5 Yrs: 5).',
      footer: '3,041 Total Enrollees (62 CDCs)',
    },
    {
      tab: 'centers',
      badge: 'Core Function 2',
      badgeVariant: 'info',
      icon: 'school',
      iconTone: 'bg-status-info-bg text-status-info border-status-info-border',
      title: 'Daycare Center Monitoring',
      desc: 'View each daycare center’s registered toddlers, daycare workers, capacity limits, and monthly attendance summaries.',
      footer: `${cdcsCount} Centers Across 22 Barangays`,
    },
    {
      tab: 'reports',
      badge: 'Core Function 3',
      badgeVariant: 'gold',
      icon: 'file',
      iconTone: 'bg-brand-yellow-tint text-brand-yellow-deep border-brand-yellow/60',
      title: 'Reports Generation',
      desc: 'Generate and download monthly or yearly municipal reports on child enrollment, attendance, developmental progress, and center metrics.',
      footer: 'Exportable CSV & Print',
    },
    {
      tab: 'programs',
      badge: 'Core Function 4',
      badgeVariant: 'coral',
      icon: 'clipboard-check',
      iconTone: 'bg-brand-coral-tint text-brand-coral-deep border-brand-coral/40',
      title: 'Activity & Module Monitoring',
      desc: 'Monitor learning modules uploaded by Child Development Teachers, verify weekly curriculum activity submissions, and review CDC compliance.',
      footer: `${compliedActivities.length} Teacher Activities`,
    },
    {
      tab: 'curriculum',
      badge: 'Curriculum',
      badgeVariant: 'gold',
      icon: 'seedling',
      iconTone: 'bg-brand-yellow-tint text-brand-yellow-deep border-brand-yellow/60',
      title: 'Curriculum Guides',
      desc: 'Official DepEd/ECCD Pre-K1 & Pre-K2 themes and sub-themes that can be assigned directly to teachers across CDCs.',
      footer: 'Pre-K1 & Pre-K2 Matrices',
    },
    {
      tab: 'teachers',
      badge: 'Personnel',
      badgeVariant: 'primary',
      icon: 'teachers',
      iconTone: 'bg-brand-leaf-tint text-brand-leaf-deep border-brand-leaf/30',
      title: 'Manage Teachers',
      desc: 'Manage Child Development Teachers (CDTs and Aides), view their assigned Barangay and CDC center, and manage credentials.',
      footer: `${teachersCount} Registered Teachers`,
    },
  ];

  const welcomeName = (() => {
    const rawName = (profile?.full_name || '').trim();
    const isGenericAdmin =
      !rawName || /admin\s*test/i.test(rawName) || /^admin$/i.test(rawName);
    return isGenericAdmin ? 'Administrator' : rawName;
  })();

  return (
    <div className="space-y-6 min-w-0">
      {/* Executive Welcome Banner matching Login's Forest + Warm Cream aesthetic */}
      <div className="relative overflow-hidden rounded-auth-card bg-ui-panel text-white p-6 sm:p-8 border border-ui-panel-deep shadow-auth-card">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255, 251, 234, 0.85) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-yellow/15 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-12 w-72 h-72 rounded-full bg-brand-leaf/20 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 min-w-0">
          <div className="space-y-2 max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-extrabold uppercase tracking-wider text-brand-cream max-w-full">
              <Icon name="landmark" size={13} className="text-brand-yellow shrink-0" />
              <span className="truncate">
                {isSuperAdmin
                  ? 'Municipal System Administration & Governance • Manolo Fortich'
                  : 'Municipal Social Welfare & Development Office • Manolo Fortich'}
              </span>
            </div>
            <h2 className="font-baloo text-2xl sm:text-3xl font-extrabold text-white m-0 leading-tight break-words">
              Welcome, {welcomeName}
            </h2>
            <p className="text-xs sm:text-sm text-white/82 leading-relaxed m-0 break-words">
              {isSuperAdmin
                ? 'Comprehensive governance authority over Early Childhood Care & Development (ECCD), Daycare Center monitoring, educator accreditation, and municipal user access control.'
                : 'Managing early childhood care, daycare center operations, and developmental milestones for children aged 3 to 4 years old across all 22 barangays of our municipality.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isSuperAdmin && (
              <Button variant="accent" size="md" icon="users" onClick={() => onNavigateTab('users')}>
                Manage Users
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              icon="clipboard-check"
              onClick={() => onNavigateTab('programs')}
              className="!bg-brand-leaf hover:!bg-[#68AC49] !text-ui-panel-deep font-extrabold"
            >
              Review Teacher Activities ({compliedActivities.length})
            </Button>
            <button
              type="button"
              onClick={() => onNavigateTab('curriculum')}
              className="px-4 py-2 rounded-ui-btn bg-white/10 hover:bg-white/18 border border-white/20 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer inline-flex items-center gap-2 min-h-[38px]"
            >
              <Icon name="target" size={15} className="text-brand-yellow shrink-0" />
              <span>Assign MSWD Topics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Core MSWD Operational Modules Grid */}
      <div className="space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h3 className="font-baloo text-lg sm:text-xl font-extrabold text-ui-ink m-0">
              Core MSWD Operational Modules
            </h3>
            <p className="text-xs sm:text-[13px] text-ui-ink-muted m-0 mt-0.5">
              Select any operational module below to manage municipal day care services and compliance:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {MODULES.map((mod) => (
            <Card
              key={mod.tab}
              onClick={() => onNavigateTab(mod.tab)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigateTab(mod.tab);
                }
              }}
              className="group cursor-pointer hover:border-brand-leaf/70 hover:shadow-card-hover transition-all flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
              bodyClassName="flex flex-col justify-between h-full gap-4"
            >
              <div className="space-y-2.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${mod.iconTone}`}
                  >
                    <Icon name={mod.icon} size={20} />
                  </span>
                  <Badge variant={mod.badgeVariant}>{mod.badge}</Badge>
                </div>
                <h4 className="font-baloo text-base sm:text-lg font-extrabold text-ui-ink group-hover:text-brand-leaf-deep transition-colors m-0 break-words">
                  {mod.title}
                </h4>
                <p className="text-xs text-ui-ink-secondary leading-relaxed m-0 break-words">
                  {mod.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-ui-border flex items-center justify-between gap-2 text-xs font-extrabold text-brand-leaf-deep">
                <span className="truncate">{mod.footer}</span>
                <span className="inline-flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
                  <span>Open</span>
                  <Icon name="arrow-right" size={14} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
