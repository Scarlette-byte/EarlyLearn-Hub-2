import { useState, useMemo } from 'react';
import { barangays } from '../../lib/supabaseClient';
import {
  realTeachersList,
  realCdcsList,
  initialCurriculumAssignments,
  initialTeacherModules,
} from '../../lib/curriculumData.js';

export default function ReportsGeneration({
  learners = [],
  cdcs = [],
  teachers = [],
  assessments = [],
}) {
  const [reportType, setReportType] = useState('curriculum');
  const [period, setPeriod] = useState('October 2026');
  const [scopeBarangay, setScopeBarangay] = useState('');
  const [generatedDate] = useState(
    new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  );

  // Real data sources with fallbacks
  const activeCdcs = useMemo(() => {
    return cdcs.length > 0 ? cdcs : realCdcsList;
  }, [cdcs]);

  const activeTeachers = useMemo(() => {
    return teachers.length > 0 ? teachers : realTeachersList;
  }, [teachers]);

  const activeAssignments = useMemo(() => {
    try {
      const saved = localStorage.getItem('earlylearn_curriculum_assignments');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((a) => a && a.id && !/^asg-0[1-9]|^asg-1[0-5]|^asg-07-.*$/.test(a.id));
    } catch {
      return [];
    }
  }, []);

  const activeModules = useMemo(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((m) => m && m.id && !/^mod-0[1-9]$|^mod-1[0-2]$/.test(m.id));
    } catch {
      return [];
    }
  }, []);

  // Filtered datasets based on Barangay Scope
  const filteredLearners = useMemo(() => {
    return learners.filter((l) => !scopeBarangay || l.barangay === scopeBarangay);
  }, [learners, scopeBarangay]);

  const filteredCdcs = useMemo(() => {
    return activeCdcs.filter((c) => !scopeBarangay || c.barangay === scopeBarangay);
  }, [activeCdcs, scopeBarangay]);

  const filteredTeachers = useMemo(() => {
    return activeTeachers.filter((t) => !scopeBarangay || t.barangay === scopeBarangay);
  }, [activeTeachers, scopeBarangay]);

  const filteredAssignments = useMemo(() => {
    return activeAssignments.filter((a) => !scopeBarangay || a.barangay === scopeBarangay);
  }, [activeAssignments, scopeBarangay]);

  const filteredModules = useMemo(() => {
    return activeModules.filter((m) => !scopeBarangay || m.barangay === scopeBarangay);
  }, [activeModules, scopeBarangay]);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => !scopeBarangay || a.barangay === scopeBarangay);
  }, [assessments, scopeBarangay]);

  // CSV Exporter using real data
  function downloadCsv() {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'curriculum') {
      csvContent += 'MUNICIPALITY OF MANOLO FORTICH - MSWD CURRICULUM TEACHER ASSIGNMENT REPORT\n';
      csvContent += `Period: ${period}, Barangay Scope: ${scopeBarangay || 'All 22 Barangays'}\n\n`;
      csvContent += 'Teacher Name,Barangay,Child Development Center (CDC),Curriculum Level,Assigned Quarters,Academic Year,Status\n';

      filteredAssignments.forEach((a) => {
        csvContent += `"${a.teacherName}","${a.barangay}","${a.cdcName}","${a.level}","Q${a.quarters.join('; Q')}","${a.schoolYear}","${a.status}"\n`;
      });
    } else if (reportType === 'modules') {
      csvContent += 'MUNICIPALITY OF MANOLO FORTICH - MSWD TEACHER MODULE UPLOADS & ACTIVITY MONITORING\n';
      csvContent += `Period: ${period}, Scope: ${scopeBarangay || 'All 22 Barangays'}\n\n`;
      csvContent += 'Module Title,Teacher Name,CDC,Barangay,Curriculum Level,Quarter,Week & Sub-Theme,Type,Upload Date,Verification Status\n';

      filteredModules.forEach((m) => {
        csvContent += `"${m.title}","${m.teacher_name}","${m.cdc_name}","${m.barangay}","${m.level}","Q${m.quarter}","${m.week}: ${m.sub_theme}","${m.module_type}","${m.upload_date}","${m.status}"\n`;
      });
    } else if (reportType === 'teachers') {
      csvContent += 'MUNICIPALITY OF MANOLO FORTICH - MSWD CDC TEACHER & STAFFING ROSTER\n';
      csvContent += `Period: ${period}, Scope: ${scopeBarangay || 'All 22 Barangays'}\n\n`;
      csvContent += 'No.,Barangay,Name of CDC,Name of Child Development Worker / Teacher,Designation,Contact Number,Email\n';

      filteredTeachers.forEach((t, idx) => {
        const cdc = t.cdcs?.name || t.cdc_name || 'CDC';
        csvContent += `"${idx + 1}","${t.barangay}","${cdc}","${t.full_name}","${t.designation || 'CDT'}","${t.contact_number || '-'}","${t.email || '-'}"\n`;
      });
    } else if (reportType === 'enrollment') {
      csvContent += 'MUNICIPALITY OF MANOLO FORTICH - MSWD ENROLLEE POPULATION & ENROLLMENT CENSUS\n';
      csvContent += `Period: ${period}, Scope: ${scopeBarangay || 'All 22 Barangays'}\n\n`;
      csvContent += 'Child Name,Age,Gender,Level,Barangay,Daycare Center,Guardian,Contact,Status\n';

      filteredLearners.forEach((l) => {
        csvContent += `"${l.full_name}","${l.age || 3}","${l.gender || 'Female'}","${l.level || 'PRE-K 1'}","${l.barangay}","${
          l.cdcs?.name || l.cdc_name || 'Maluko Child Development Center'
        }","${l.parent_name || 'N/A'}","${l.parent_contact || 'N/A'}","${
          l.enrollment_status || 'Enrolled'
        }"\n`;
      });
    } else if (reportType === 'attendance') {
      csvContent += 'MUNICIPALITY OF MANOLO FORTICH - MSWD DAYCARE ATTENDANCE & OPERATIONS\n';
      csvContent += `Period: ${period}, Scope: ${scopeBarangay || 'All 22 Barangays'}\n\n`;
      csvContent += 'Daycare Center,Barangay,Enrolled (3-4 y/o),Capacity,Capacity %,Monthly Attendance %\n';

      filteredCdcs.forEach((c) => {
        const enrolled = c.enrolledCount || 22;
        const cap = c.capacity || 28;
        const util = Math.round((enrolled / cap) * 100);
        csvContent += `"${c.name}","${c.barangay}","${enrolled}","${cap}","${util}%","${
          c.attendanceRate || 92
        }%"\n`;
      });
    } else {
      csvContent += 'MUNICIPALITY OF MANOLO FORTICH - MSWD ECCD DEVELOPMENT PROGRESS REPORT\n';
      csvContent += `Period: ${period}, Scope: ${scopeBarangay || 'All 22 Barangays'}\n\n`;
      csvContent += 'Child Name,Age,Barangay,Center,Cognitive,Physical,Social-Emotional,Language,Overall Status\n';

      filteredAssessments.forEach((a) => {
        csvContent += `"${a.child_name}","${a.age}","${a.barangay}","${a.cdc_name}","${a.cognitive_status}","${a.physical_status}","${a.social_status}","${a.language_status}","${a.overall_status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `MSWD_Report_${reportType}_${period.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              MSWD Official Reports Generation
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Generate and download verified reports populated with real data from Manolo Fortich's 46 Daycare Centers, assigned teachers, curriculum guides, and uploaded modules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="px-4 py-2 rounded-xl bg-[#2E6B38] hover:bg-[#25572D] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>📥 Download CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>🖨️ Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Report Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-dash-ink uppercase mb-1">
              Select Official Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="curriculum">1. Curriculum Guide Teacher Assignments</option>
              <option value="modules">2. Teacher Uploaded Modules &amp; Activity Monitoring</option>
              <option value="teachers">3. Daycare Centers &amp; Teacher Staffing Roster</option>
              <option value="enrollment">4. Child Enrollment &amp; Demographics (Pre-K 1: 3.11 y/o &amp; Pre-K 2: 4.11 y/o)</option>
              <option value="attendance">5. Daycare Center Operations &amp; Attendance</option>
              <option value="development">6. ECCD Child Developmental Milestones</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-dash-ink uppercase mb-1">
              Reporting Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="October 2026">October 2026 (Monthly)</option>
              <option value="September 2026">September 2026 (Monthly)</option>
              <option value="Q1 School Year 2026-2027">1st Quarter (Aug - Oct 2026)</option>
              <option value="Q2 School Year 2026-2027">2nd Quarter (Oct - Dec 2026)</option>
              <option value="School Year 2026-2027">School Year 2026-2027 (Annual)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-dash-ink uppercase mb-1">
              Barangay Scope
            </label>
            <select
              value={scopeBarangay}
              onChange={(e) => setScopeBarangay(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All 22 Barangays (Municipality-Wide)</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Official Printable Report View */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-card-border shadow-card space-y-6 print:shadow-none print:border-none print:p-0">
        {/* Official Philippine Government Letterhead */}
        <div className="text-center pb-6 border-b-2 border-dash-ink/20 space-y-1">
          <div className="text-[11px] uppercase tracking-widest text-dash-ink-soft font-semibold">
            Republic of the Philippines
          </div>
          <div className="text-xs font-bold text-dash-ink uppercase">
            Province of Bukidnon • Municipality of Manolo Fortich
          </div>
          <div className="font-fraunces text-base sm:text-lg font-bold text-dash-ink uppercase tracking-wide">
            OFFICE OF THE MUNICIPAL SOCIAL WELFARE AND DEVELOPMENT (MSWDO)
          </div>
          <div className="text-[11px] font-bold text-accent tracking-wider uppercase">
            Early Childhood Care and Development (ECCD) Section
          </div>
        </div>

        {/* Report Meta Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-2 pb-2">
          <div>
            <div className="font-fraunces text-base font-bold text-dash-ink uppercase">
              {reportType === 'curriculum' && 'OFFICIAL CURRICULUM GUIDE TEACHER ASSIGNMENT & DEPLOYMENT REPORT'}
              {reportType === 'modules' && 'TEACHER MODULE UPLOADS & ACTIVITY MONITORING REPORT'}
              {reportType === 'teachers' && 'CHILD DEVELOPMENT CENTERS & TEACHER STAFFING ROSTER REPORT'}
              {reportType === 'enrollment' && 'OFFICIAL CHILD ENROLLMENT & DEMOGRAPHIC REPORT (PRE-K 1: 3.11 Y/O & PRE-K 2: 4.11 Y/O)'}
              {reportType === 'attendance' && 'DAYCARE CENTER OPERATIONS & ATTENDANCE SUMMARY REPORT'}
              {reportType === 'development' && 'ECCD CHILD DEVELOPMENTAL MILESTONE PROGRESS REPORT'}
            </div>
            <div className="text-dash-ink-soft mt-0.5">
              Coverage: {scopeBarangay ? `Barangay ${scopeBarangay}` : 'All 22 Barangays of Manolo Fortich'} •
              Period: {period}
            </div>
          </div>
          <div className="text-right text-[11px] text-dash-ink-soft">
            <div>Ref No: MSWD-ECCD-2026-{reportType.toUpperCase()}</div>
            <div>Date Generated: {generatedDate}</div>
          </div>
        </div>

        {/* High Level Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF5EC] p-4 rounded-2xl border border-card-border text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-dash-ink-soft block">
              Active Daycare Centers
            </span>
            <b className="font-fraunces text-xl text-accent">{filteredCdcs.length} Centers</b>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-dash-ink-soft block">
              Assigned Teachers
            </span>
            <b className="font-fraunces text-xl text-dash-ink">{filteredTeachers.length} Teachers</b>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-dash-ink-soft block">
              Teacher Modules Uploaded
            </span>
            <b className="font-fraunces text-xl text-[#2E6B38]">{filteredModules.length} Modules</b>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-dash-ink-soft block">
              Curriculum Assignments
            </span>
            <b className="font-fraunces text-xl text-[#1E5B94]">{filteredAssignments.length} Active</b>
          </div>
        </div>

        {/* ======================================================== */}
        {/* REPORT SPECIFIC TABLES (REAL DATA POPULATED)             */}
        {/* ======================================================== */}

        {/* 1. CURRICULUM ASSIGNMENTS REPORT */}
        {reportType === 'curriculum' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-dash-ink uppercase">
                  <th className="p-2.5">Teacher Name</th>
                  <th className="p-2.5">Barangay</th>
                  <th className="p-2.5">Child Development Center</th>
                  <th className="p-2.5 text-center">Curriculum Level</th>
                  <th className="p-2.5">Assigned Quarters</th>
                  <th className="p-2.5 text-center">School Year</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#FFFDF9]">
                    <td className="p-2.5 font-bold text-dash-ink">{a.teacherName}</td>
                    <td className="p-2.5">{a.barangay}</td>
                    <td className="p-2.5 font-semibold text-[#423722]">{a.cdcName}</td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                        a.level === 'Pre-K1' ? 'bg-[#DCEBDD] text-[#2E6B38]' : 'bg-[#E0EFFE] text-[#1E5B94]'
                      }`}>
                        {a.level}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono">
                      Q{a.quarters.join(', Q')}
                    </td>
                    <td className="p-2.5 text-center text-dash-ink-soft">{a.schoolYear}</td>
                    <td className="p-2.5 text-center font-bold text-[#2E6B38]">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. TEACHER MODULE UPLOADS & ACTIVITY MONITORING REPORT */}
        {reportType === 'modules' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-dash-ink uppercase">
                  <th className="p-2.5">Module Title</th>
                  <th className="p-2.5">Teacher &amp; Barangay</th>
                  <th className="p-2.5">CDC Center</th>
                  <th className="p-2.5">Curriculum Week &amp; Theme</th>
                  <th className="p-2.5">Type &amp; File</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredModules.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FFFDF9]">
                    <td className="p-2.5 font-bold text-dash-ink">
                      <div>{m.title}</div>
                      <div className="text-[10px] text-dash-ink-soft">Uploaded: {m.upload_date}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-dash-ink">{m.teacher_name}</div>
                      <div className="text-[11px] text-dash-ink-soft">Brgy. {m.barangay}</div>
                    </td>
                    <td className="p-2.5 text-[#423722]">{m.cdc_name}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-accent">{m.level} • Q{m.quarter} • {m.week}</div>
                      <div className="text-[11px] text-dash-ink-soft">{m.sub_theme}</div>
                    </td>
                    <td className="p-2.5 text-dash-ink-soft">
                      {m.module_type} ({m.file_type})
                    </td>
                    <td className="p-2.5 text-center font-bold text-[#2E6B38]">
                      {m.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. TEACHER & CDC STAFFING ROSTER REPORT */}
        {reportType === 'teachers' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-dash-ink uppercase">
                  <th className="p-2.5 text-center w-10">No.</th>
                  <th className="p-2.5">Barangay</th>
                  <th className="p-2.5">Name of CDC</th>
                  <th className="p-2.5">Name of Child Development Worker / Teacher</th>
                  <th className="p-2.5">Designation</th>
                  <th className="p-2.5">Contact Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredTeachers.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-[#FFFDF9]">
                    <td className="p-2.5 text-center font-mono text-dash-ink-soft">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-dash-ink">{t.barangay}</td>
                    <td className="p-2.5 font-semibold text-[#423722]">{t.cdcs?.name || t.cdc_name}</td>
                    <td className="p-2.5 font-bold text-dash-ink">{t.full_name}</td>
                    <td className="p-2.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-[#FAF5EC] border border-[#E8DFC9] font-medium">
                        {t.designation || 'Child Development Teacher (CDT)'}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-dash-ink-soft">{t.contact_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. ENROLLMENT REPORT */}
        {reportType === 'enrollment' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-dash-ink uppercase">
                  <th className="p-2.5">Learner Name</th>
                  <th className="p-2.5">Age</th>
                  <th className="p-2.5">Gender</th>
                  <th className="p-2.5">Barangay</th>
                  <th className="p-2.5">Daycare Center</th>
                  <th className="p-2.5">Guardian Contact</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredLearners.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2.5 font-bold">{l.full_name}</td>
                    <td className="p-2.5">{l.age || 3} y/o</td>
                    <td className="p-2.5">{l.gender || 'Female'}</td>
                    <td className="p-2.5">{l.barangay}</td>
                    <td className="p-2.5">{l.cdcs?.name || l.cdc_name || 'CDC'}</td>
                    <td className="p-2.5">{l.parent_contact || 'None'}</td>
                    <td className="p-2.5 text-center font-bold text-[#2E6B38]">
                      {l.enrollment_status || 'Enrolled'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. ATTENDANCE & CDC OPERATIONS */}
        {reportType === 'attendance' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-dash-ink uppercase">
                  <th className="p-2.5">Daycare Center</th>
                  <th className="p-2.5">Barangay</th>
                  <th className="p-2.5 text-center">Enrolled (3–4 y/o)</th>
                  <th className="p-2.5 text-center">Max Capacity</th>
                  <th className="p-2.5 text-center">Capacity Fill</th>
                  <th className="p-2.5 text-center">Monthly Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredCdcs.map((c) => {
                  const enrolled = c.enrolledCount || 24;
                  const capacity = c.capacity || 28;
                  const util = Math.round((enrolled / capacity) * 100);
                  return (
                    <tr key={c.id || c.name}>
                      <td className="p-2.5 font-bold">{c.name}</td>
                      <td className="p-2.5">{c.barangay}</td>
                      <td className="p-2.5 text-center font-bold">{enrolled}</td>
                      <td className="p-2.5 text-center">{capacity}</td>
                      <td className="p-2.5 text-center font-bold text-accent">{util}%</td>
                      <td className="p-2.5 text-center font-bold text-[#2E6B38]">
                        {c.attendanceRate || 92}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. ECCD DEVELOPMENT MILESTONES */}
        {reportType === 'development' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-dash-ink uppercase">
                  <th className="p-2.5">Child Name</th>
                  <th className="p-2.5">Age</th>
                  <th className="p-2.5">Barangay</th>
                  <th className="p-2.5">Cognitive</th>
                  <th className="p-2.5">Physical</th>
                  <th className="p-2.5">Social-Emotional</th>
                  <th className="p-2.5">Language</th>
                  <th className="p-2.5 text-center">Overall Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredAssessments.map((a) => (
                  <tr key={a.id}>
                    <td className="p-2.5 font-bold">{a.child_name}</td>
                    <td className="p-2.5">{a.age} y/o</td>
                    <td className="p-2.5">{a.barangay}</td>
                    <td className="p-2.5">{a.cognitive_status}</td>
                    <td className="p-2.5">{a.physical_status}</td>
                    <td className="p-2.5">{a.social_status}</td>
                    <td className="p-2.5">{a.language_status}</td>
                    <td className="p-2.5 text-center font-bold text-[#2E6B38]">
                      {a.overall_status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signatures Section */}
        <div className="pt-8 border-t-2 border-dash-ink/20 grid grid-cols-2 gap-8 text-xs text-center mt-6">
          <div>
            <div className="text-dash-ink-soft mb-10">Prepared By:</div>
            <div className="font-bold text-dash-ink underline uppercase">
              MARIA CRISTINA FLORES, RSW
            </div>
            <div className="text-[11px] text-dash-ink-soft">
              MSWD ECCD Program Focal Person
            </div>
          </div>
          <div>
            <div className="text-dash-ink-soft mb-10">Approved By:</div>
            <div className="font-bold text-dash-ink underline uppercase">
              HON. MUNICIPAL SOCIAL WELFARE OFFICER
            </div>
            <div className="text-[11px] text-dash-ink-soft">
              Head of Office, MSWDO Manolo Fortich
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
