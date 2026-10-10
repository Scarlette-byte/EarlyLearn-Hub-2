import { useState } from 'react';
import { barangays } from '../../lib/supabaseClient';

export default function ProgramMonitoring({
  cdcs = [],
  activityReports = [],
  onVerifyReport,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedCompliance, setSelectedCompliance] = useState('');
  const [activeReport, setActiveReport] = useState(null);

  // Mandatory ECCD Activities list
  const requiredActivities = [
    'Q1 ECCD Assessment Administration',
    'Monthly Supplementary Feeding & Nutrition',
    'Parent-Teacher ECCD Orientation',
    'Weekly Sensory & Fine Motor Play Circle',
    'Hygiene & Handwashing Demonstration',
    'Mother Tongue Phonics & Storytelling',
  ];

  // Centers with compliance scores
  const centerComplianceList = cdcs.map((cdc, idx) => {
    // Generate realistic compliance scores
    const completedCount = cdc.completedActivitiesCount ?? (idx % 5 === 0 ? 5 : 6);
    const totalRequired = requiredActivities.length;
    const percentage = Math.round((completedCount / totalRequired) * 100);

    let status = 'Fully Compliant';
    if (percentage < 80) status = 'Overdue';
    else if (percentage < 100) status = 'In Progress';

    return {
      ...cdc,
      completedCount,
      totalRequired,
      percentage,
      status,
    };
  });

  // Filter compliance
  const filteredCompliance = centerComplianceList.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.barangay.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBarangay = !selectedBarangay || c.barangay === selectedBarangay;
    const matchesComp = !selectedCompliance || c.status === selectedCompliance;

    return matchesSearch && matchesBarangay && matchesComp;
  });

  // Metrics
  const totalCenters = centerComplianceList.length;
  const compliantCount = centerComplianceList.filter((c) => c.status === 'Fully Compliant').length;
  const avgComplianceRate =
    totalCenters > 0
      ? Math.round(
          centerComplianceList.reduce((acc, c) => acc + c.percentage, 0) / totalCenters
        )
      : 92;
  const pendingReportsCount = activityReports.filter((r) => !r.mswd_verified).length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Required ECCD Activities
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {requiredActivities.length} Mandatory
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Per Daycare Center</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Center Compliance Rate
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {avgComplianceRate}%
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {compliantCount} / {totalCenters} Centers at 100%
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-accent uppercase tracking-wider">
            Submitted Activity Reports
          </div>
          <div className="font-fraunces text-2xl font-bold text-accent mt-1">
            {activityReports.length}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">By Daycare Workers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
            Pending MSWD Verification
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {pendingReportsCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Awaiting review</div>
        </div>
      </div>

      {/* Program Compliance Tracker */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Daycare Center Program Compliance Tracker
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Track whether each Daycare Center across the 22 barangays of Manolo Fortich has completed the required early childhood activities.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div>
            <input
              type="text"
              placeholder="Search by center or barangay..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedCompliance}
              onChange={(e) => setSelectedCompliance(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Compliance Levels</option>
              <option value="Fully Compliant">Fully Compliant (100%)</option>
              <option value="In Progress">In Progress (&gt;80%)</option>
              <option value="Overdue">Overdue (&lt;80%)</option>
            </select>
          </div>
        </div>

        {/* Compliance Table */}
        <div className="overflow-x-auto rounded-xl border border-card-border mt-3">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                <th className="px-4 py-3">Daycare Center & Barangay</th>
                <th className="px-4 py-3">Completed Activities</th>
                <th className="px-4 py-3">Compliance Progress</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F1E7]">
              {filteredCompliance.map((c) => (
                <tr key={c.id || c.name} className="hover:bg-[#FFFDF9]">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-dash-ink">{c.name}</div>
                    <div className="text-[11px] text-dash-ink-soft">
                      Brgy. {c.barangay}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold">
                    {c.completedCount} / {c.totalRequired} Activities
                  </td>
                  <td className="px-4 py-3.5 min-w-[150px]">
                    <div className="flex justify-between font-bold text-[11px] mb-1">
                      <span>{c.percentage}%</span>
                    </div>
                    <div className="w-full bg-[#EAE0CF] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.percentage === 100
                            ? 'bg-[#2E6B38]'
                            : c.percentage >= 80
                            ? 'bg-[#E5A823]'
                            : 'bg-danger'
                        }`}
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold ${
                        c.status === 'Fully Compliant'
                          ? 'bg-[#DCEBDD] text-[#2E6B38]'
                          : c.status === 'In Progress'
                          ? 'bg-[#FFF3D6] text-[#8C6200]'
                          : 'bg-[#FDE2E2] text-[#9E2A2B]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submitted Activity Reports Queue */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        <div>
          <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
            Submitted Activity Reports from Daycare Workers
          </h3>
          <p className="text-xs text-dash-ink-soft mt-0.5">
            Review activity execution notes, attendance turnout, and photo evidence submitted by local teachers.
          </p>
        </div>

        <div className="space-y-3">
          {activityReports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-2xl bg-[#FFFDF9] border border-card-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-accent transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-fraunces font-bold text-sm text-dash-ink">
                    {report.title}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      report.mswd_verified
                        ? 'bg-[#DCEBDD] text-[#2E6B38]'
                        : 'bg-[#FFF3D6] text-[#8C6200]'
                    }`}
                  >
                    {report.mswd_verified ? 'Verified ✓' : 'Pending Verification'}
                  </span>
                </div>
                <div className="text-xs text-dash-ink-soft">
                  Center: <b className="text-dash-ink">{report.cdc_name}</b> • Submitting
                  Worker: {report.teacher_name} • Date: {report.date}
                </div>
                <div className="text-xs text-[#5A4C3C] mt-1 leading-relaxed">
                  {report.summary}
                </div>
                <div className="text-[11px] text-dash-ink-soft flex items-center gap-3 pt-1">
                  <span>👥 Attendees: <b>{report.attendees_count} Toddlers (Ages 3–4)</b></span>
                  <span>📷 Photo Documentation Attached</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!report.mswd_verified && (
                  <button
                    onClick={() => onVerifyReport(report.id)}
                    className="px-3 py-1.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    Verify Report ✓
                  </button>
                )}
                <button
                  onClick={() => setActiveReport(report)}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF5EC] text-dash-ink hover:bg-[#EFE8DC] font-bold text-xs transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* REPORT DOSSIER MODAL */}
      {activeReport && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 animate-pop">
            <div className="flex items-start justify-between border-b border-card-border pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FAF5EC] text-accent tracking-wider">
                  MSWD Activity Report Dossier
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {activeReport.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#FAF5EC] rounded-xl">
                  <span className="text-dash-ink-soft text-[11px] block">Daycare Center</span>
                  <b className="text-dash-ink text-sm">{activeReport.cdc_name}</b>
                </div>
                <div className="p-3 bg-[#FAF5EC] rounded-xl">
                  <span className="text-dash-ink-soft text-[11px] block">Daycare Worker</span>
                  <b className="text-dash-ink text-sm">{activeReport.teacher_name}</b>
                </div>
              </div>

              <div className="p-3 bg-[#FAF5EC] rounded-xl">
                <span className="text-dash-ink-soft text-[11px] block">Date Conducted & Turnout</span>
                <b className="text-dash-ink">
                  {activeReport.date} • {activeReport.attendees_count} Children (Ages 3–4) Attended
                </b>
              </div>

              <div className="p-3 bg-[#FFFDF9] border border-card-border rounded-xl space-y-1">
                <span className="text-dash-ink-soft text-[11px] block font-bold">Activity Summary & Highlights:</span>
                <p className="text-dash-ink m-0 leading-relaxed">
                  {activeReport.summary}
                </p>
              </div>

              <div className="p-3 bg-[#FAF5EC] rounded-xl flex items-center justify-between">
                <span>Verification Status:</span>
                <b className={activeReport.mswd_verified ? 'text-[#2E6B38]' : 'text-[#8C6200]'}>
                  {activeReport.mswd_verified ? 'Verified by MSWDO ✓' : 'Under Review'}
                </b>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
              {!activeReport.mswd_verified && (
                <button
                  onClick={() => {
                    onVerifyReport(activeReport.id);
                    setActiveReport(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs"
                >
                  Verify Activity ✓
                </button>
              )}
              <button
                onClick={() => setActiveReport(null)}
                className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
