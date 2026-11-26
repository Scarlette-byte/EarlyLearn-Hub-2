import { useState, useMemo } from 'react';
import { supabase, barangays } from '../../lib/supabaseClient';
import { REPORT_REGISTRY, exportReportToCsv, logReportExport } from '../../lib/reportRegistry.js';
import { Button, Card, Table, FormField, Badge, EmptyState } from '../ui/index.js';
import { input } from '../../lib/ui.js';

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

  const selectClass = `${input} !py-2 !text-xs cursor-pointer`;

  return (
    <div className="space-y-5 min-w-0">
      <Card
        icon="file"
        title="Reports Generation"
        subtitle="Role-scoped MSWDO & ECCD municipal reports with clean print formatting and CSV export."
        accentBar
        className="no-print"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" icon="printer" onClick={handlePrint}>
              Print Report
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="download"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
            >
              Export CSV
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Report Type Selector Pills */}
          <div className="flex flex-wrap gap-2">
            {scopedReports.map((rep) => {
              const isSelected = activeReport?.id === rep.id;
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`px-3.5 py-2 rounded-ui-btn text-xs font-extrabold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-leaf-deep text-white border-brand-leaf-deep shadow-xs'
                      : 'bg-ui-surface-subtle text-ui-ink-secondary border-ui-border hover:border-ui-border-strong hover:text-ui-ink'
                  }`}
                >
                  {rep.title}
                </button>
              );
            })}
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-4 border-t border-ui-border">
            <FormField label="School Year" htmlFor="rep-sy">
              <select
                id="rep-sy"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className={selectClass}
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
                className={selectClass}
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
                className={selectClass}
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
                className={selectClass}
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
                className={selectClass}
              />
            </FormField>

            <FormField label="Date To" htmlFor="rep-to">
              <input
                id="rep-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={selectClass}
              />
            </FormField>
          </div>
        </div>
      </Card>

      {/* Report Output Table */}
      {activeReport && (
        <Card
          title={activeReport.title}
          subtitle={activeReport.description}
          action={<Badge variant="primary">{rows.length} record(s)</Badge>}
        >
          {rows.length === 0 ? (
            <EmptyState
              icon="bar-chart"
              title="No matching records"
              description="Adjust the school year, barangay, CDC, class, or date range filters above to view report data."
            />
          ) : (
            <Table
              columns={activeReport.columns}
              data={rows}
              keyField={activeReport.columns[0]?.key || 'id'}
            />
          )}
        </Card>
      )}
    </div>
  );
}
