import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

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
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((m) => m && m.id && !/^mod-0[1-9]$|^mod-1[0-2]$/.test(m.id));
    } catch {
      return [];
    }
  };

  const [compliedActivities, setCompliedActivities] = useState(getLocalCompliedActivities);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const loadCompliedActivities = useCallback(async () => {
    const localList = getLocalCompliedActivities();
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map((m) => {
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
            teacher_name: meta.teacher_name || 'CDC Teacher',
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

        const merged = mapped.map((sb) => {
          const loc = localList.find((l) => l.id === sb.id);
          return loc
            ? {
                ...sb,
                posted_to_students: Boolean(loc.posted_to_students ?? sb.posted_to_students),
                target_student_name: loc.target_student_name || sb.target_student_name,
              }
            : sb;
        });
        const localOnly = localList.filter((l) => !merged.some((s) => s.id === l.id));
        setCompliedActivities([...merged, ...localOnly]);
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

  const handleMswdDecision = async (activityId, decision) => {
    const isApprove = decision === 'approve';
    const updated = compliedActivities.map((m) =>
      m.id === activityId
        ? {
            ...m,
            status: isApprove ? 'Approved' : 'Rejected',
            verified_by_mswd: isApprove,
            posted_to_students: isApprove ? m.posted_to_students : false,
          }
        : m
    );
    setCompliedActivities(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {}

    try {
      await supabase
        .from('materials')
        .update({ status: isApprove ? 'approved' : 'rejected' })
        .eq('id', activityId);
    } catch {}

    if (viewingActivity?.id === activityId) {
      setViewingActivity((prev) =>
        prev
          ? {
              ...prev,
              status: isApprove ? 'Approved' : 'Rejected',
              verified_by_mswd: isApprove,
              posted_to_students: isApprove ? prev.posted_to_students : false,
            }
          : null
      );
    }

    setToastMsg(
      isApprove
        ? '✅ Activity APPROVED by MSWD! The teacher can now post this activity to their specific Student Dashboard.'
        : '❌ Activity REJECTED by MSWD. The teacher has been notified.'
    );
    setTimeout(() => setToastMsg(''), 4000);
  };

  const pendingReviewCount = compliedActivities.filter(
    (m) => !m.verified_by_mswd && m.status !== 'Approved' && m.status !== 'Rejected' && m.status !== 'Needs Revision'
  ).length;
  const approvedCount = compliedActivities.filter((m) => m.verified_by_mswd || m.status === 'Approved').length;
  const rejectedCount = compliedActivities.filter((m) => m.status === 'Rejected' || m.status === 'Needs Revision').length;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-[#DCEBDD] border border-emerald-300 text-[#2E6B38] font-bold text-xs flex items-center justify-between shadow-xs">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg('')}
            className="text-[#2E6B38] font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
            {isSuperAdmin
              ? `Welcome, ${profile?.full_name || 'Municipal Super Administrator'}`
              : `Welcome, ${profile?.full_name || 'MSWD ECCD Administrator'}`}
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

      {/* ===================================================================== */}
      {/* TEACHER COMPLIED ACTIVITIES — MSWD VIEW & APPROVE / REJECT PANEL      */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-card-border shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0E6D2]">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent bg-[#FFF5EE] px-2.5 py-0.5 rounded-full mb-1">
              <span>📋</span>
              <span>MSWD Teacher Compliance &amp; Approval Gate</span>
            </div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Teacher Complied Activities — View &amp; Approve / Reject
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              View what activities teachers have already complied with. Once MSWD approves an activity, the teacher can post it to their specific Student Dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              ⏳ Pending: {pendingReviewCount}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#DCEBDD] text-[#2E6B38] border border-emerald-200">
              ✓ Approved: {approvedCount}
            </span>
            {rejectedCount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                ✕ Rejected: {rejectedCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('programs')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
            >
              Full Activity Monitor →
            </button>
          </div>
        </div>

        {compliedActivities.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#FAF5EC]/60 border border-dashed border-[#E5DAC4] text-center space-y-1.5">
            <div className="text-xl">📂</div>
            <div className="font-bold text-xs text-dash-ink">
              No Teacher Complied Activities Submitted Yet
            </div>
            <p className="text-[11.5px] text-dash-ink-soft max-w-md mx-auto">
              When teachers comply with their MSWD-assigned topic and upload their activity, it will appear here for MSWD to view and decide whether to Approve or Reject.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                  <th className="px-3.5 py-2.5">Teacher &amp; Day Care Center</th>
                  <th className="px-3.5 py-2.5">Complied Activity &amp; MSWD Topic</th>
                  <th className="px-3 py-2.5 text-center">Level / Week</th>
                  <th className="px-3 py-2.5 text-center">MSWD Decision</th>
                  <th className="px-3 py-2.5 text-center">Student Dashboard</th>
                  <th className="px-3.5 py-2.5 text-right">MSWD Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {compliedActivities.slice(0, 6).map((act) => {
                  const isApproved = act.verified_by_mswd || act.status === 'Approved';
                  const isRejected = act.status === 'Rejected' || act.status === 'Needs Revision';

                  return (
                    <tr key={act.id} className="hover:bg-[#FFFDF9] transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{act.teacher_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {act.cdc_name} • Brgy. {act.barangay}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 max-w-xs">
                        <div className="font-bold text-dash-ink truncate">{act.title}</div>
                        <div className="text-[11px] text-[#8C6200] font-medium truncate">
                          Topic: {act.sub_theme || act.theme}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
                          {act.level} • Q{act.quarter} ({act.week})
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            isApproved
                              ? 'bg-[#DCEBDD] text-[#2E6B38] border border-emerald-200'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isApproved ? 'Approved ✓' : isRejected ? 'Rejected ✕' : 'Pending Review'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {isApproved ? (
                          act.posted_to_students ? (
                            <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              🚀 Posted ({act.target_student_name || 'Class'})
                            </span>
                          ) : (
                            <span className="text-[10.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              🔓 Teacher Can Post Now
                            </span>
                          )
                        ) : (
                          <span className="text-[10.5px] text-slate-400">🔒 Locked</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingActivity(act)}
                            className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-[11px] border border-[#E5DAC4] cursor-pointer"
                          >
                            👁️ View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMswdDecision(act.id, 'approve')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-[#2E6B38] hover:bg-[#23532B] text-white'
                            }`}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMswdDecision(act.id, 'reject')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
                              isRejected
                                ? 'bg-rose-200 text-rose-900 border border-rose-300'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick View Modal for Complied Activity */}
      {viewingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-card-border shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  {viewingActivity.level} • Q{viewingActivity.quarter} • {viewingActivity.week}
                </span>
                <h4 className="font-fraunces text-base font-bold text-dash-ink m-0 mt-1">
                  {viewingActivity.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingActivity(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#EBE1CF] text-xs space-y-1.5">
              <div>
                <span className="text-slate-500">Complied by Teacher:</span>{' '}
                <b className="text-slate-900">{viewingActivity.teacher_name}</b>
              </div>
              <div>
                <span className="text-slate-500">Day Care Center:</span>{' '}
                <b className="text-slate-900">{viewingActivity.cdc_name} (Brgy. {viewingActivity.barangay})</b>
              </div>
              <div>
                <span className="text-slate-500">MSWD Topic:</span>{' '}
                <b className="text-amber-900">{viewingActivity.sub_theme || viewingActivity.theme}</b>
              </div>
              {viewingActivity.description && (
                <div className="pt-1.5 border-t border-[#E5DAC4] text-slate-700">
                  <span className="font-bold block text-slate-800 mb-0.5">Activity Instructions:</span>
                  {viewingActivity.description}
                </div>
              )}
              {viewingActivity.content_url && (
                <div className="pt-1.5">
                  <a
                    href={viewingActivity.content_url}
                    target="_blank"
                    rel="noreferrer"
                    download={viewingActivity.file_name || undefined}
                    className="inline-flex items-center gap-1 text-accent font-bold underline"
                  >
                    📎 Open / Download Attached Activity File ({viewingActivity.file_type || 'File'})
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingActivity(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMswdDecision(viewingActivity.id, 'reject')}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                >
                  ✕ Reject Activity
                </button>
                <button
                  type="button"
                  onClick={() => handleMswdDecision(viewingActivity.id, 'approve')}
                  className="px-4 py-2 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white text-xs font-bold cursor-pointer"
                >
                  ✓ Approve (Allow Teacher to Post)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
