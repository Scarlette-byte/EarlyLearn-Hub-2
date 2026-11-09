import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
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
  const isSuperAdmin = profile?.role === 'superadmin' || profile?.isSuperAdmin;

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
          const isRejected = m.status === 'rejected' || m.status === 'Rejected' || m.status === 'needs_revision';
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
              ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
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
              (l.title && sb.title && l.title.trim().toLowerCase() === sb.title.trim().toLowerCase())
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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#FAF5EC] via-[#FFFDF8] to-[#FFF8EE] p-6 sm:p-7 rounded-3xl border border-card-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE4D6] text-accent text-xs font-bold">
            <span>🏛️</span>
            <span>
              {isSuperAdmin
                ? 'Municipal System Administration & Governance • Manolo Fortich, Bukidnon'
                : 'Municipal Social Welfare and Development Office • Manolo Fortich, Bukidnon'}
            </span>
          </div>
          <h2 className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink m-0">
            {(() => {
              const rawName = (profile?.full_name || '').trim();
              const isGenericAdmin =
                !rawName || /admin\s*test/i.test(rawName) || /^admin$/i.test(rawName);
              const finalName = isGenericAdmin ? 'ADMIN' : rawName;
              return `Welcome, ${finalName}`;
            })()}
          </h2>
          <p className="text-xs sm:text-sm text-dash-ink-soft leading-relaxed m-0">
            {isSuperAdmin
              ? 'Comprehensive governance authority over Early Childhood Care & Development (ECCD), Daycare Center monitoring, educator accreditation, and municipal user access control.'
              : 'Managing early childhood care, daycare center operations, and developmental milestones for children aged 3 to 4 years old across all 22 barangays of our municipality.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {isSuperAdmin && (
            <button
              onClick={() => onNavigateTab('users')}
              className="px-4 py-2.5 rounded-xl bg-[#5A2E9E] hover:bg-[#472280] text-white font-bold text-xs shadow-xs transition-colors"
            >
              Manage Users
            </button>
          )}
          <button
            onClick={() => onNavigateTab('programs')}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Review Teacher Activities ({compliedActivities.length})
          </button>
          <button
            onClick={() => onNavigateTab('curriculum')}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#D5C7B0] hover:bg-[#FAF5EC] text-dash-ink font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Assign MSWD Topics
          </button>
        </div>
      </div>

      {/* 5 Core MSWD Functions Navigation Grid */}
      <div className="space-y-3">
        <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
          Specific Core Functions of MSWD in EarlyLearnHub
        </h3>
        <p className="text-xs text-dash-ink-soft m-0">
          Select any core operational module below to manage municipal day care services and compliance:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {/* Function 1 */}
          <div
            onClick={() => onNavigateTab('enrollees')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FFE4D6] text-accent flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🏛️
              </span>
              <span className="text-[11px] font-bold text-accent bg-[#FFF5EE] px-2 py-0.5 rounded-full">
                Core Function 1
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-accent transition-colors">
              Barangay Enrollee Population
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Official municipal population census covering 3,091 enrollees across all 22 Barangays and 62 Child Development Centers (Pre-K 1: 1,001 • Pre-K 2: 1,646 • ITED: 439 • 5 Yrs: 5).
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-accent">
              <span>3,091 Total Enrollees (62 CDCs)</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 2 */}
          <div
            onClick={() => onNavigateTab('centers')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#E0EFFE] text-[#1E5B94] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🏫
              </span>
              <span className="text-[11px] font-bold text-[#1E5B94] bg-[#F0F7FF] px-2 py-0.5 rounded-full">
                Core Function 2
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#1E5B94] transition-colors">
              Daycare Center Monitoring
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              View each daycare center’s registered toddlers, daycare workers, capacity limits, and monthly attendance summaries.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#1E5B94]">
              <span>{cdcsCount} Centers Across 22 Barangays</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 3 */}
          <div
            onClick={() => onNavigateTab('reports')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FFF3D6] text-[#8C6200] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                📄
              </span>
              <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFFBF0] px-2 py-0.5 rounded-full">
                Core Function 3
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#8C6200] transition-colors">
              Reports Generation
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Generate and download monthly or yearly municipal reports on child enrollment, attendance, developmental progress, and center metrics.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#8C6200]">
              <span>Exportable CSV/PDF</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 4 */}
          <div
            onClick={() => onNavigateTab('programs')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#E8DEF8] text-[#553C9A] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                📋
              </span>
              <span className="text-[11px] font-bold text-[#553C9A] bg-[#F7F4FD] px-2 py-0.5 rounded-full">
                Core Function 4
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#553C9A] transition-colors">
              Activity &amp; Module Monitoring
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Monitor learning modules uploaded by Child Development Teachers, verify weekly curriculum activity submissions, and review CDC compliance.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#553C9A]">
              <span>{compliedActivities.length} Teacher Activities</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Curriculum Guides Quick Link */}
          <div
            onClick={() => onNavigateTab('curriculum')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FFF9CC] text-[#8C6200] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🌱
              </span>
              <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFFBF0] px-2 py-0.5 rounded-full">
                Curriculum
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-accent transition-colors">
              Curriculum Guides
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Official DepEd/ECCD Pre-K1 &amp; Pre-K2 themes and sub-themes that can be assigned directly to teachers across CDCs.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-accent">
              <span>Pre-K1 &amp; Pre-K2 Matrices</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Teacher Roster Quick Link */}
          <div
            onClick={() => onNavigateTab('teachers')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FAF5EC] text-dash-ink flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                👩‍🏫
              </span>
              <span className="text-[11px] font-bold text-dash-ink bg-[#FAF5EC] px-2 py-0.5 rounded-full">
                Personnel
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-accent transition-colors">
              Manage Teachers
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Manage Child Development Teachers (CDTs and Aides), view their assigned Barangay and CDC center, and manage credentials.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-accent">
              <span>{teachersCount} Registered Teachers</span>
              <span>Open →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
