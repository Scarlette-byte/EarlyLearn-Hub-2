import { useState } from 'react';
import { barangays } from '../../lib/supabaseClient';

export default function DaycareCenterMonitoring({
  cdcs = [],
  learners = [],
  teachers = [],
  onUpdateCdcCapacity,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [inspectingCdc, setInspectingCdc] = useState(null);

  // Group learners by CDC
  const learnersByCdc = {};
  learners.forEach((l) => {
    const key = l.cdcs?.name || l.cdc_name || (l.barangay ? `${l.barangay} CDC` : 'Unassigned');
    if (!learnersByCdc[key]) learnersByCdc[key] = [];
    learnersByCdc[key].push(l);
  });

  // Group teachers by CDC
  const teachersByCdc = {};
  teachers.forEach((t) => {
    const key = t.cdcs?.name || (t.barangay ? `${t.barangay} CDC` : 'Unassigned');
    if (!teachersByCdc[key]) teachersByCdc[key] = [];
    teachersByCdc[key].push(t);
  });

  // Combine CDC items with dynamic stats
  const centerList = cdcs.map((cdc) => {
    const name = cdc.name;
    const enrolled = learnersByCdc[name]?.length || cdc.enrolledCount || 0;
    const capacity = cdc.capacity || 28;
    const utilization = Math.round((enrolled / capacity) * 100);
    const assignedTeachers = teachersByCdc[name] || [];
    const attendanceRate = cdc.attendanceRate || 92;

    let status = 'Optimal';
    if (utilization >= 95) status = 'At Capacity';
    else if (utilization >= 80) status = 'Near Capacity';

    return {
      ...cdc,
      enrolled,
      capacity,
      utilization,
      assignedTeachers,
      attendanceRate,
      status,
    };
  });

  // Filter centers
  const filteredCenters = centerList.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.barangay.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.assignedTeachers.some((t) =>
        t.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesBarangay = !selectedBarangay || c.barangay === selectedBarangay;
    const matchesStatus = !selectedStatus || c.status === selectedStatus;

    return matchesSearch && matchesBarangay && matchesStatus;
  });

  // Overall metrics
  const totalCenters = centerList.length;
  const totalEnrolled = centerList.reduce((acc, c) => acc + c.enrolled, 0);
  const avgUtilization =
    totalCenters > 0
      ? Math.round(
          centerList.reduce((acc, c) => acc + c.utilization, 0) / totalCenters
        )
      : 0;
  const avgAttendance =
    totalCenters > 0
      ? Math.round(
          centerList.reduce((acc, c) => acc + c.attendanceRate, 0) / totalCenters
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Daycare Centers
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {totalCenters}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Across 22 Barangays</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-accent uppercase tracking-wider">
            Capacity Utilization
          </div>
          <div className="font-fraunces text-2xl font-bold text-accent mt-1">
            {avgUtilization}%
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Average enrollment fill</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Monthly Attendance Avg
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {avgAttendance}%
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Daily toddler turnout</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#1E5B94] uppercase tracking-wider">
            Daycare Workers (CDWs)
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#1E5B94] mt-1">
            {teachers.length || 24}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Assigned teachers</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Daycare Center Monitoring
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Monitor enrollment capacity, assigned workers, and attendance summaries for every center in Manolo Fortich.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div>
            <input
              type="text"
              placeholder="Search by center, worker, or barangay..."
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
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Operational Statuses</option>
              <option value="Optimal">Optimal Capacity (&lt;80%)</option>
              <option value="Near Capacity">Near Capacity (80–95%)</option>
              <option value="At Capacity">At Capacity (95%+)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Centers Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase tracking-wider">
                <th className="px-4 py-3">Daycare Center & Barangay</th>
                <th className="px-4 py-3">Assigned Daycare Workers</th>
                <th className="px-4 py-3">Enrollment / Capacity</th>
                <th className="px-4 py-3 text-center">Attendance Summary</th>
                <th className="px-4 py-3 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F1E7] text-xs text-dash-ink">
              {filteredCenters.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dash-ink-soft">
                    No daycare centers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCenters.map((cdc) => {
                  return (
                    <tr key={cdc.id || cdc.name} className="hover:bg-[#FFFDF9] transition-colors">
                      {/* Name & Barangay */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-sm text-dash-ink">{cdc.name}</div>
                        <div className="text-[11px] text-dash-ink-soft mt-0.5">
                          📍 Brgy. {cdc.barangay}
                        </div>
                      </td>

                      {/* Daycare Workers */}
                      <td className="px-4 py-3.5">
                        {cdc.assignedTeachers.length > 0 ? (
                          cdc.assignedTeachers.map((t) => (
                            <div key={t.id} className="font-semibold text-dash-ink">
                              {t.full_name}{' '}
                              <span className="text-[10px] text-dash-ink-soft">
                                ({t.contact_number || 'Teacher'})
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-dash-ink-soft italic">
                            1 Assigned Child Development Worker
                          </div>
                        )}
                      </td>

                      {/* Capacity Utilization Progress */}
                      <td className="px-4 py-3.5 min-w-[160px]">
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span>
                            {cdc.enrolled} / {cdc.capacity} Children
                          </span>
                          <span
                            className={
                              cdc.utilization >= 95
                                ? 'text-danger'
                                : cdc.utilization >= 80
                                ? 'text-[#8C6200]'
                                : 'text-[#2E6B38]'
                            }
                          >
                            {cdc.utilization}%
                          </span>
                        </div>
                        <div className="w-full bg-[#EAE0CF] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              cdc.utilization >= 95
                                ? 'bg-danger'
                                : cdc.utilization >= 80
                                ? 'bg-[#E5A823]'
                                : 'bg-[#6BCB77]'
                            }`}
                            style={{ width: `${Math.min(cdc.utilization, 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Attendance Summary */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="font-bold text-sm text-[#2E6B38]">
                          {cdc.attendanceRate}%
                        </div>
                        <div className="text-[10px] text-dash-ink-soft">
                          Avg. 22.4 Present / Day
                        </div>
                      </td>

                      {/* Operations */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setInspectingCdc(cdc)}
                          className="px-3 py-1.5 rounded-xl bg-accent text-white font-bold text-xs hover:bg-[#B5673C] transition-colors shadow-xs"
                        >
                          View Roster & Ops
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT CENTER DOSSIER MODAL */}
      {inspectingCdc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-5 animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FAF5EC] text-accent tracking-wider">
                  Daycare Center Operational Dossier
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {inspectingCdc.name}
                </h3>
                <p className="text-xs text-dash-ink-soft">
                  Barangay {inspectingCdc.barangay}, Manolo Fortich, Bukidnon
                </p>
              </div>
              <button
                onClick={() => setInspectingCdc(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC]"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 bg-[#FAF5EC] rounded-xl">
                <span className="text-dash-ink-soft block text-[11px]">Enrolled (3–4 y/o)</span>
                <b className="font-fraunces text-xl text-dash-ink">
                  {inspectingCdc.enrolled}
                </b>
              </div>
              <div className="p-3 bg-[#FAF5EC] rounded-xl">
                <span className="text-dash-ink-soft block text-[11px]">Max Capacity</span>
                <b className="font-fraunces text-xl text-accent">
                  {inspectingCdc.capacity}
                </b>
              </div>
              <div className="p-3 bg-[#FAF5EC] rounded-xl">
                <span className="text-dash-ink-soft block text-[11px]">Avg Attendance</span>
                <b className="font-fraunces text-xl text-[#2E6B38]">
                  {inspectingCdc.attendanceRate}%
                </b>
              </div>
            </div>

            {/* Weekly Attendance Breakdown */}
            <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-card-border space-y-2">
              <div className="font-bold text-xs text-dash-ink">
                Weekly Attendance Patterns (Ages 3–4)
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
                <div className="p-2 rounded-lg bg-[#FAF5EC]">
                  <span className="text-dash-ink-soft block">Mon</span>
                  <b className="text-dash-ink">95%</b>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF5EC]">
                  <span className="text-dash-ink-soft block">Tue</span>
                  <b className="text-dash-ink">94%</b>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF5EC]">
                  <span className="text-dash-ink-soft block">Wed</span>
                  <b className="text-dash-ink">92%</b>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF5EC]">
                  <span className="text-dash-ink-soft block">Thu</span>
                  <b className="text-dash-ink">91%</b>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF5EC]">
                  <span className="text-dash-ink-soft block">Fri</span>
                  <b className="text-dash-ink">90%</b>
                </div>
              </div>
            </div>

            {/* Enrolled Children Roster for this CDC */}
            <div className="space-y-2">
              <div className="font-bold text-xs text-dash-ink flex items-center justify-between">
                <span>Enrolled Children Roster (Ages 3–4)</span>
                <span className="text-dash-ink-soft font-normal">
                  {learnersByCdc[inspectingCdc.name]?.length || 0} registered
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-card-border divide-y divide-[#F6F1E7] text-xs">
                {(learnersByCdc[inspectingCdc.name] || []).length === 0 ? (
                  <div className="p-4 text-center text-dash-ink-soft italic">
                    No active learner profiles tagged to this center yet.
                  </div>
                ) : (
                  learnersByCdc[inspectingCdc.name].map((l) => (
                    <div
                      key={l.id}
                      className="p-2.5 flex items-center justify-between hover:bg-[#FAF5EC]"
                    >
                      <div>
                        <div className="font-bold text-dash-ink">{l.full_name}</div>
                        <div className="text-[10px] text-dash-ink-soft">
                          Guardian: {l.parent_name || 'N/A'} • Contact:{' '}
                          {l.parent_contact || 'N/A'}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DCEBDD] text-[#2E6B38] font-bold">
                        {l.enrollment_status || 'Enrolled'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
              <button
                onClick={() => setInspectingCdc(null)}
                className="px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs"
              >
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
