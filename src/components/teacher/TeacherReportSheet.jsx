import { useMemo } from 'react';
import { cleanStudentName, isPlaceholderStudentName } from '../../lib/learnersService.js';

export function formatAgeInYears(learner) {
  const raw = String(learner?.birthdate || learner?.child_age || learner?.age || '').trim();
  if (raw) {
    const fixed = raw.replace(/\bmonths\b/gi, 'years');
    if (fixed.toLowerCase().includes('years') || /^\d{4}-\d{2}-\d{2}$/.test(fixed)) {
      return fixed;
    }
    if (fixed.includes('4-4.11') || fixed.includes('5-6') || fixed === '4') {
      return '4 to 4.11 years (Pre-K2)';
    }
  }
  return '3 to 3.11 years (Pre-K1)';
}

export function getRatingBadgeClass(rating) {
  if (rating === 'Developing as Expected') {
    return 'bg-[#DCEBDD] text-[#2E6B38] border border-[#BDE0C0]';
  }
  if (rating === 'Needs Support' || rating === 'Needs Reinforcement') {
    return 'bg-[#FFF3D6] text-[#8C6200] border border-[#F5DC9A]';
  }
  if (rating === 'Delay' || rating === 'Requires Follow-up') {
    return 'bg-[#FDE2E2] text-[#9E2A2B] border border-[#F8B4B4]';
  }
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

export default function TeacherReportSheet({
  mode = 'learner', // 'learner' | 'class'
  learner = null,
  learners = [],
  cdcName = '',
  teacherBarangay = '',
  teacherName = 'Child Development Teacher',
  onClose,
}) {
  const effectiveCdc =
    cdcName ||
    learner?.cdc_name ||
    learner?.assessment?.cdc_name ||
    (teacherBarangay ? `${teacherBarangay} Child Development Center` : 'Child Development Center');

  const todayDate = new Date().toISOString().split('T')[0];

  const scopedClassLearners = useMemo(() => {
    const list = [];
    const seen = new Set();
    (learners || []).forEach((item) => {
      const cleaned = cleanStudentName(item?.full_name || item?.child_name || '');
      if (!cleaned || isPlaceholderStudentName(cleaned)) return;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        ...item,
        full_name: cleaned,
      });
    });
    list.sort((a, b) => {
      const aEval = Boolean(a.assessment);
      const bEval = Boolean(b.assessment);
      if (aEval !== bEval) return aEval ? 1 : -1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
    return list;
  }, [learners]);

  const classTotals = useMemo(() => {
    const total = scopedClassLearners.length;
    let evaluated = 0;
    let developing = 0;
    let reinforcement = 0;
    let followUp = 0;

    scopedClassLearners.forEach((l) => {
      const ass = l.assessment;
      if (ass) {
        evaluated += 1;
        if (ass.overall_status === 'Developing as Expected') developing += 1;
        else if (ass.overall_status === 'Needs Reinforcement') reinforcement += 1;
        else if (ass.overall_status === 'Requires Follow-up') followUp += 1;
      }
    });

    return {
      total,
      evaluated,
      pending: total - evaluated,
      developing,
      reinforcement,
      followUp,
    };
  }, [scopedClassLearners]);

  function handlePrintOnlyReport() {
    window.print();
  }

  function handleDownloadCsv() {
    const headers = [
      'Learner Name',
      'Age / Level',
      'Barangay',
      'Center Name',
      'Assessment Date',
      'Cognitive',
      'Physical and Motor',
      'Social-Emotional',
      'Language',
      'Overall Result',
      'Observations',
      'Recommendation',
    ];

    const escapeCsv = (val) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = scopedClassLearners.map((l) => {
      const ass = l.assessment;
      return [
        l.full_name,
        formatAgeInYears(l),
        l.barangay || teacherBarangay || '',
        effectiveCdc,
        ass?.date || 'Not evaluated',
        ass?.cognitive_status || 'Not evaluated',
        ass?.physical_status || 'Not evaluated',
        ass?.social_status || 'Not evaluated',
        ass?.language_status || 'Not evaluated',
        ass?.overall_status || 'Not evaluated',
        ass?.observations || '',
        ass?.recommendation || '',
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeCdc = effectiveCdc.replace(/[^a-zA-Z0-9]+/g, '_');
    link.download = `Class_Report_${safeCdc}_${todayDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const singleAssessment = learner?.assessment || (learner?.overall_status ? learner : null);
  const singleChildName = cleanStudentName(
    learner?.full_name || learner?.child_name || singleAssessment?.child_name || 'Learner'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Isolated @media print styles: hides everything except #teacher-printable-report-sheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #teacher-printable-report-sheet,
          #teacher-printable-report-sheet * {
            visibility: visible !important;
          }
          #teacher-printable-report-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-[#FAF5EC] rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-card-border max-h-[94vh] flex flex-col gap-4">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-card-border">
          <div className="text-sm font-bold text-dash-ink">
            {mode === 'class' ? 'Class Report Preview' : 'Child Report Preview'}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {mode === 'class' && (
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-dash-ink font-bold text-xs cursor-pointer"
              >
                Download CSV
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintOnlyReport}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-sm shadow-xs cursor-pointer"
            >
              Print or Save as PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-dash-ink font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Paper-Style Report Sheet */}
        <div className="overflow-y-auto flex-1">
          <div
            id="teacher-printable-report-sheet"
            className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-300 shadow-sm text-dash-ink space-y-6 mx-auto"
          >
            {/* Official Report Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 space-y-1">
              <div className="text-xs sm:text-sm font-bold text-dash-ink-soft">
                Municipality of Manolo Fortich, Bukidnon - MSWDO
              </div>
              <h2 className="font-fraunces text-xl sm:text-2xl font-bold text-dash-ink m-0">
                Child Development Report
              </h2>
              <div className="text-xs sm:text-sm font-semibold text-dash-ink pt-0.5">
                {effectiveCdc}
              </div>
            </div>

            {mode === 'learner' ? (
              /* ============================================================ */
              /* INDIVIDUAL LEARNER REPORT                                    */
              /* ============================================================ */
              <div className="space-y-5 text-xs sm:text-sm">
                {/* Child Info Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#FAF5EC] border border-card-border">
                  <div>
                    <span className="text-dash-ink-soft">Child name: </span>
                    <strong className="text-dash-ink">{singleChildName}</strong>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft">Date: </span>
                    <strong className="text-dash-ink">
                      {singleAssessment?.date || todayDate}
                    </strong>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft">Age and level: </span>
                    <strong className="text-dash-ink">{formatAgeInYears(learner)}</strong>
                  </div>
                  <div>
                    <span className="text-dash-ink-soft">Barangay: </span>
                    <strong className="text-dash-ink">
                      {learner?.barangay || singleAssessment?.barangay || teacherBarangay || '—'}
                    </strong>
                  </div>
                </div>

                {!singleAssessment ? (
                  <div className="p-8 rounded-2xl border border-gray-200 bg-gray-50 text-center space-y-1">
                    <div className="font-bold text-base text-dash-ink">
                      This learner has not been evaluated yet.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 4 Developmental Domain Ratings */}
                    <div className="space-y-2">
                      <div className="font-bold text-dash-ink">Domain ratings</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          { label: 'Cognitive', value: singleAssessment.cognitive_status },
                          { label: 'Physical and Motor', value: singleAssessment.physical_status },
                          { label: 'Social-Emotional', value: singleAssessment.social_status },
                          { label: 'Language', value: singleAssessment.language_status },
                        ].map((dom) => (
                          <div
                            key={dom.label}
                            className="p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-2"
                          >
                            <span className="font-semibold text-dash-ink">{dom.label}</span>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${getRatingBadgeClass(
                                dom.value
                              )}`}
                            >
                              {dom.value || 'Developing as Expected'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Overall Result */}
                    <div className="p-3.5 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-dash-ink">Overall result</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${getRatingBadgeClass(
                          singleAssessment.overall_status
                        )}`}
                      >
                        {singleAssessment.overall_status}
                      </span>
                    </div>

                    {/* Observations */}
                    <div className="p-3.5 rounded-xl border border-gray-200 space-y-1">
                      <div className="font-bold text-dash-ink">Teacher observations</div>
                      <p className="text-dash-ink-soft m-0 leading-relaxed">
                        {singleAssessment.observations || 'No observations recorded.'}
                      </p>
                    </div>

                    {/* Recommendation */}
                    <div className="p-3.5 rounded-xl border border-gray-200 space-y-1">
                      <div className="font-bold text-dash-ink">Recommendation</div>
                      <p className="text-dash-ink-soft m-0 leading-relaxed">
                        {singleAssessment.recommendation || 'No recommendation recorded.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================ */
              /* CLASS SUMMARY REPORT                                         */
              /* ============================================================ */
              <div className="space-y-5 text-xs">
                {/* Summary Totals */}
                <div className="p-4 rounded-xl bg-[#FAF5EC] border border-card-border space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-sm text-dash-ink">
                      {classTotals.total} learners • {classTotals.evaluated} evaluated •{' '}
                      {classTotals.pending} pending
                    </div>
                    <div className="text-xs text-dash-ink-soft">Date: {todayDate}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-full font-bold bg-[#DCEBDD] text-[#2E6B38] border border-[#BDE0C0]">
                      Developing as Expected: {classTotals.developing}
                    </span>
                    <span className="px-2.5 py-1 rounded-full font-bold bg-[#FFF3D6] text-[#8C6200] border border-[#F5DC9A]">
                      Needs Reinforcement: {classTotals.reinforcement}
                    </span>
                    <span className="px-2.5 py-1 rounded-full font-bold bg-[#FDE2E2] text-[#9E2A2B] border border-[#F8B4B4]">
                      Requires Follow-up: {classTotals.followUp}
                    </span>
                  </div>
                </div>

                {/* Class Table */}
                <div className="overflow-x-auto border border-gray-300 rounded-xl">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#FAF5EC] border-b border-gray-300 font-bold text-dash-ink">
                        <th className="p-2.5">Learner name</th>
                        <th className="p-2.5">Age</th>
                        <th className="p-2.5">Cognitive</th>
                        <th className="p-2.5">Physical</th>
                        <th className="p-2.5">Social</th>
                        <th className="p-2.5">Language</th>
                        <th className="p-2.5">Overall result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {scopedClassLearners.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-6 text-center text-dash-ink-soft">
                            No learners in this class yet.
                          </td>
                        </tr>
                      ) : (
                        scopedClassLearners.map((l) => {
                          const ass = l.assessment;
                          return (
                            <tr key={l.id || l.full_name}>
                              <td className="p-2.5 font-bold text-dash-ink">{l.full_name}</td>
                              <td className="p-2.5 text-dash-ink-soft">{formatAgeInYears(l)}</td>
                              {ass ? (
                                <>
                                  <td className="p-2.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getRatingBadgeClass(
                                        ass.cognitive_status
                                      )}`}
                                    >
                                      {ass.cognitive_status}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getRatingBadgeClass(
                                        ass.physical_status
                                      )}`}
                                    >
                                      {ass.physical_status}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getRatingBadgeClass(
                                        ass.social_status
                                      )}`}
                                    >
                                      {ass.social_status}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getRatingBadgeClass(
                                        ass.language_status
                                      )}`}
                                    >
                                      {ass.language_status}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${getRatingBadgeClass(
                                        ass.overall_status
                                      )}`}
                                    >
                                      {ass.overall_status}
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <td colSpan="5" className="p-2.5 text-gray-500 italic">
                                  This learner has not been evaluated yet.
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Official Signature Lines */}
            <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs sm:text-sm border-t border-gray-200">
              <div>
                <div className="text-dash-ink-soft mb-6">Prepared by:</div>
                <div className="font-bold text-dash-ink border-b border-gray-400 pb-1 inline-block min-w-[220px]">
                  {singleAssessment?.teacher_name || teacherName}
                </div>
                <div className="text-xs text-dash-ink-soft mt-1">Child Development Worker</div>
              </div>

              <div>
                <div className="text-dash-ink-soft mb-6">Noted by:</div>
                <div className="font-bold text-dash-ink border-b border-gray-400 pb-1 inline-block min-w-[220px]">
                  MSWDO
                </div>
                <div className="text-xs text-dash-ink-soft mt-1">
                  Municipal Social Welfare and Development Office
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

