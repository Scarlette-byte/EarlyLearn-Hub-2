import { useState, useMemo } from 'react';
import { supabase, barangays } from '../../lib/supabaseClient';
import { REPORT_REGISTRY, exportReportToCsv, logReportExport } from '../../lib/reportRegistry.js';
import { Button, Table, FormField, Badge, EmptyState } from '../ui/index.js';

export default function ReportsGeneration({
  learners = [],
  cdcs = [],
  teachers = [],
  assessments = [],
  activityReports = [],
  classes = [],
  userRole = 'admin',
}) {
  const scopedReports = useMemo(
    () => REPORT_REGISTRY.filter((r) => !r.allowedRoles || r.allowedRoles.includes(userRole)),
    [userRole]
  );

  const [selectedReportId, setSelectedReportId] = useState(scopedReports[0]?.id || 'class_enrollment');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [barangay, setBarangay] = useState('');
  const [cdcId, setCdcId] = useState('');
  const [classId, setClassId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const activeReport = useMemo(
    () => scopedReports.find((r) => r.id === selectedReportId) || scopedReports[0],
    [scopedReports, selectedReportId]
  );

  const filters = useMemo(
    () => ({ schoolYear, barangay, cdcId, classId, dateFrom, dateTo }),
    [schoolYear, barangay, cdcId, classId, dateFrom, dateTo]
  );

  const rows = useMemo(() => {
    if (!activeReport) return [];
    return activeReport.buildRows(
      { learners, cdcs, teachers, assessments, activityReports, classes },
      filters
    );
  }, [activeReport, learners, cdcs, teachers, assessments, activityReports, classes, filters]);

  const handlePrint = async () => {
    await logReportExport(supabase, { reportId: activeReport?.id, format: 'print', filters });
    window.print();
  };

  const handleExportCsv = async () => {
    if (!activeReport) return;
    await logReportExport(supabase, { reportId: activeReport.id, format: 'csv', filters });
    exportReportToCsv(`${activeReport.id}_${schoolYear}.csv`, activeReport.columns, rows);
  };

  return (
    <div className="space-y-5 min-w-0">
      <div className="bg-white rounded-2xl border border-[#ece6da] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#2b261c] m-0 break-words">
              Reports Generation
            </h3>
            <p className="text-xs text-[#7c725e] mt-1 m-0 break-words">
              Role-scoped MSWD &amp; ECCD reports with print and CSV export.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={handlePrint}>
              Print
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>

        {/* Report Selector */}
        <div className="flex flex-wrap gap-2">
          {scopedReports.map((rep) => (
            <button
              key={rep.id}
              type="button"
              onClick={() => setSelectedReportId(rep.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                activeReport?.id === rep.id
                  ? 'bg-[#f4b41a] text-[#2b261c] border-[#e0a210]'
                  : 'bg-[#faf8f4] text-[#5c5342] border-[#ece6da] hover:bg-[#f2ede3]'
              }`}
            >
              {rep.title}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-[#f2ede3]">
          <FormField label="School Year" htmlFor="rep-sy">
            <select
              id="rep-sy"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#ddd5c5] bg-white"
            >
              <option value="2026-2027">2026-2027</option>
              <option value="2025-2026">2025-2026</option>
            </select>
          </FormField>

          <FormField label="Barangay" htmlFor="rep-brgy">
            <select
              id="rep-brgy"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#ddd5c5] bg-white"
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="CDC" htmlFor="rep-cdc">
            <select
              id="rep-cdc"
              value={cdcId}
              onChange={(e) => setCdcId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#ddd5c5] bg-white"
            >
              <option value="">All CDCs</option>
              {cdcs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Class" htmlFor="rep-class">
            <select
              id="rep-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#ddd5c5] bg-white"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Date From" htmlFor="rep-from">
            <input
              id="rep-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#ddd5c5] bg-white"
            />
          </FormField>

          <FormField label="Date To" htmlFor="rep-to">
            <input
              id="rep-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#ddd5c5] bg-white"
            />
          </FormField>
        </div>
      </div>

      {/* Report Output */}
      {activeReport && (
        <div className="bg-white rounded-2xl border border-[#ece6da] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-base font-bold text-[#2b261c] m-0 break-words">
                {activeReport.title}
              </h4>
              <p className="text-xs text-[#7c725e] m-0 break-words">{activeReport.description}</p>
            </div>
            <Badge variant="info">{rows.length} record(s)</Badge>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No matching records"
              description="Adjust the school year, barangay, CDC, class, or date range filters to view data."
            />
          ) : (
            <Table
              columns={activeReport.columns}
              data={rows}
              keyField={activeReport.columns[0]?.key || 'id'}
            />
          )}
        </div>
      )}
    </div>
  );
}
