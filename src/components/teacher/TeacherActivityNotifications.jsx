import { useState, useMemo } from 'react';

export default function TeacherActivityNotifications({
  materials = [],
  onNavigateToUpload,
  onOpenUploadModal,
}) {
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'approved' | 'pending' | 'revision'

  // Calculate status breakdown
  const metrics = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let revision = 0;

    materials.forEach((m) => {
      const isApproved = m.status === 'Approved' || m.status === 'approved' || m.verified_by_mswd;
      const isRevision =
        m.status === 'Needs Revision' ||
        m.status === 'needs_revision' ||
        m.status === 'Rejected' ||
        m.status === 'rejected';

      if (isApproved) approved++;
      else if (isRevision) revision++;
      else pending++;
    });

    return { total: materials.length, approved, pending, revision };
  }, [materials]);

  // Filter materials for the notification feed
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const isApproved = m.status === 'Approved' || m.status === 'approved' || m.verified_by_mswd;
      const isRevision =
        m.status === 'Needs Revision' ||
        m.status === 'needs_revision' ||
        m.status === 'Rejected' ||
        m.status === 'rejected';

      if (statusFilter === 'approved') return isApproved;
      if (statusFilter === 'pending') return !isApproved && !isRevision;
      if (statusFilter === 'revision') return isRevision;
      return true;
    });
  }, [materials, statusFilter]);

  return (
    <div className="bg-white rounded-2xl border border-card-border p-5 shadow-xs space-y-4">
      {/* Header with Title & Quick Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF5EE] border border-amber-200 text-accent text-[11px] font-bold">
            <span>🔔</span>
            <span>MSWDO Activity Review &amp; Approval System</span>
          </div>
          <h3 className="font-fraunces text-base sm:text-lg font-bold text-dash-ink m-0 mt-1">
            Submitted Activities Verification Status
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time MSWD administrative oversight before activities are published to student dashboards.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({metrics.total})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'approved'
                ? 'bg-[#2E6B38] text-white shadow-xs'
                : 'bg-[#DCEBDD] text-[#2E6B38] hover:bg-[#cee4d0]'
            }`}
          >
            <span>✓ Approved</span>
            <span>({metrics.approved})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'pending'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
            }`}
          >
            <span>⏳ Pending Review</span>
            <span>({metrics.pending})</span>
          </button>

          {metrics.revision > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('revision')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'revision'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200 animate-pulse'
              }`}
            >
              <span>⚠️ Needs Action</span>
              <span>({metrics.revision})</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Cards List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filteredMaterials.map((mat) => {
          const isApproved = mat.status === 'Approved' || mat.status === 'approved' || mat.verified_by_mswd;
          const isRevision =
            mat.status === 'Needs Revision' ||
            mat.status === 'needs_revision' ||
            mat.status === 'Rejected' ||
            mat.status === 'rejected';

          return (
            <div
              key={mat.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isApproved
                  ? 'bg-[#F9FCF9] border-emerald-200 hover:border-emerald-300'
                  : isRevision
                  ? 'bg-[#FFF8F8] border-rose-200 hover:border-rose-300'
                  : 'bg-[#FFFDF7] border-amber-200 hover:border-amber-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Pill */}
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCEBDD] text-[#2E6B38] border border-emerald-300">
                        <span>✓</span>
                        <span>Approved &amp; Live on Student Dashboard</span>
                      </span>
                    ) : isRevision ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <span>⚠️</span>
                        <span>Needs Revision / Changes Requested</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <span>⏳</span>
                        <span>Pending MSWDO Admin Review</span>
                      </span>
                    )}

                    {/* Level & Week Tag */}
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {mat.level || 'Pre-K1'} • {mat.week || 'Week 1'}
                    </span>

                    {/* File Type */}
                    <span className="text-[10.5px] text-slate-400 font-mono">
                      {mat.file_type || 'PDF'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm m-0 pt-0.5">
                    {mat.title}
                  </h4>

                  {mat.sub_theme && (
                    <div className="text-[11px] text-amber-900 font-medium">
                      ECCD Theme: {mat.sub_theme}
                    </div>
                  )}

                  {/* Specific Status Explanation Notice */}
                  {isApproved ? (
                    <p className="text-[11.5px] text-emerald-800 m-0 leading-relaxed pt-0.5">
                      Verified and approved by MSWDO. This activity is now linked and visible exclusively to learners in your assigned daycare center class.
                    </p>
                  ) : isRevision ? (
                    <div className="mt-1 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-0.5">
                      <div className="font-bold flex items-center gap-1 text-rose-800">
                        <span>💬 MSWDO Administrator Notes:</span>
                      </div>
                      <div className="leading-relaxed whitespace-pre-wrap">
                        {mat.mswd_comments || mat.revision_notes || 'Please review the activity instructions or worksheet file and resubmit.'}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-amber-800 m-0 leading-relaxed pt-0.5">
                      Submitted to MSWDO. Once verified and approved, it will be automatically added to your students' dashboard activities.
                    </p>
                  )}
                </div>

                {/* Side Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0 pt-1 sm:pt-0">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {mat.created_at || 'Recent'}
                  </span>

                  {mat.content_url && (
                    <a
                      href={mat.content_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10.5px] border border-slate-200 shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <span>📎</span>
                      <span>View File</span>
                    </a>
                  )}

                  {isRevision && onOpenUploadModal && (
                    <button
                      type="button"
                      onClick={() => onOpenUploadModal(mat)}
                      className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-[10.5px] shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <span>✏️</span>
                      <span>Resubmit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredMaterials.length === 0 && (
          <div className="py-8 text-center text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="text-2xl mb-1">📭</div>
            <div className="font-semibold text-xs text-slate-700">
              {statusFilter === 'all'
                ? 'No activities uploaded yet'
                : `No activities matching "${statusFilter}"`}
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
              When you upload activities, worksheets, or PDFs, their MSWDO verification progress will be tracked here in real time.
            </p>
            {onNavigateToUpload && (
              <button
                type="button"
                onClick={onNavigateToUpload}
                className="mt-2.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <span>+ Upload Learning Material</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
