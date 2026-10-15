import { useState, useMemo } from 'react';
import { barangays } from '../../lib/supabaseClient';
import {
  initialTeacherModules,
  realTeachersList,
  realCdcsList,
} from '../../lib/curriculumData.js';
import {
  cardBox,
  cardBoxTitle,
  table,
  th,
  td,
} from '../../lib/ui.js';
import {
  IconSearch,
  IconCheck,
  IconClose,
  IconBuilding,
  IconPin,
  IconMaterials,
  IconTeachers,
  IconOverview,
  IconPlus,
} from '../Icons.jsx';

export default function ProgramMonitoring({
  cdcs = [],
  onVerifyReport,
}) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'compliance'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [inspectingModule, setInspectingModule] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Stored uploaded modules state (persisted to localStorage)
  const [modules, setModules] = useState(() => {
    try {
      const saved = localStorage.getItem('earlylearn_teacher_modules');
      return saved ? JSON.parse(saved) : initialTeacherModules;
    } catch {
      return initialTeacherModules;
    }
  });

  // New module upload form state
  const [newTitle, setNewTitle] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newLevel, setNewLevel] = useState('Pre-K1');
  const [newQuarter, setNewQuarter] = useState('1');
  const [newWeek, setNewWeek] = useState('Week 1');
  const [newSubTheme, setNewSubTheme] = useState('I HAVE A NAME');
  const [newModuleType, setNewModuleType] = useState('Activity Worksheet');
  const [newDescription, setNewDescription] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Handle Verify / Approve Module
  const handleApproveModule = (moduleId) => {
    const updated = modules.map((m) =>
      m.id === moduleId
        ? { ...m, status: 'Approved', verified_by_mswd: true }
        : m
    );
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
    } catch {
      // Ignored
    }
  };

  // Handle Reject / Request Revision
  const handleRejectModule = (moduleId) => {
    const reason = prompt('Please enter a note / revision request for the teacher:', 'Please align with ECCD sensory play guidelines.');
    if (!reason) return;

    const updated = modules.map((m) =>
      m.id === moduleId
        ? { ...m, status: 'Needs Revision', verified_by_mswd: false, revision_notes: reason }
        : m
    );
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
    } catch {
      // Ignored
    }
  };

  // Handle Add Module
  const handleCreateModule = (e) => {
    e.preventDefault();
    const teacher = realTeachersList.find((t) => t.id === newTeacherId);
    if (!teacher) {
      alert('Please select a teacher.');
      return;
    }

    const newModuleObj = {
      id: 'mod-' + Date.now(),
      title: newTitle.trim(),
      teacher_name: teacher.full_name,
      teacher_id: teacher.id,
      cdc_name: teacher.cdc_name,
      barangay: teacher.barangay,
      level: newLevel,
      quarter: parseInt(newQuarter, 10),
      week: newWeek,
      sub_theme: newSubTheme,
      theme: newLevel === 'Pre-K1' ? 'TELL ME ABOUT YOURSELF' : 'MORE ABOUT MYSELF AND MY SCHOOL',
      module_type: newModuleType,
      file_type: 'PDF',
      file_size: '2.5 MB',
      upload_date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Approved',
      verified_by_mswd: true,
      description: newDescription.trim() || 'Teacher-prepared early childhood module for daycare learners.',
      downloads_count: 0,
    };

    const updated = [newModuleObj, ...modules];
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
    } catch {
      // Ignored
    }

    setUploadSuccess('✅ Module successfully recorded and verified!');
    setTimeout(() => {
      setUploadModalOpen(false);
      setUploadSuccess('');
      setNewTitle('');
      setNewDescription('');
    }, 1200);
  };

  // Filtered Modules Feed
  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cdc_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sub_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.barangay.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBarangay = !selectedBarangay || m.barangay.toLowerCase() === selectedBarangay.toLowerCase();
      const matchesLevel = selectedLevel === 'all' || m.level.toLowerCase() === selectedLevel.toLowerCase();
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'approved' && m.verified_by_mswd) ||
        (selectedStatus === 'pending' && !m.verified_by_mswd);

      return matchesSearch && matchesBarangay && matchesLevel && matchesStatus;
    });
  }, [modules, searchTerm, selectedBarangay, selectedLevel, selectedStatus]);

  // Aggregate stats
  const totalModules = modules.length;
  const approvedModules = modules.filter((m) => m.verified_by_mswd).length;
  const pendingModules = modules.filter((m) => !m.verified_by_mswd).length;
  const activeTeachersCount = new Set(modules.map((m) => m.teacher_name)).size;

  // Center Upload Compliance calculation
  const cdcComplianceData = useMemo(() => {
    const list = cdcs.length > 0 ? cdcs : realCdcsList;
    return list.map((cdc) => {
      const cdcModules = modules.filter(
        (m) => m.cdc_name === cdc.name || m.barangay === cdc.barangay
      );
      const count = cdcModules.length;
      // Expectation: 2 modules per center per month
      const target = 2;
      const rate = Math.min(100, Math.round((count / target) * 100));

      let complianceStatus = 'Compliant';
      if (count === 0) complianceStatus = 'No Uploads';
      else if (rate < 100) complianceStatus = 'Partial';

      return {
        ...cdc,
        moduleCount: count,
        complianceRate: rate,
        complianceStatus,
        recentModule: cdcModules[0] || null,
      };
    });
  }, [cdcs, modules]);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Modules Uploaded
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {totalModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">By Assigned Teachers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Approved &amp; Verified
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {approvedModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {Math.round((approvedModules / (totalModules || 1)) * 100)}% verified
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
            Pending Verification
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {pendingModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Awaiting MSWD review</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-accent uppercase tracking-wider">
            Contributing Teachers
          </div>
          <div className="font-fraunces text-2xl font-bold text-accent mt-1">
            {activeTeachersCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Across 46 CDCs</div>
        </div>
      </div>

      {/* Main Monitoring Card */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#F0E6D2]">
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-[#FFF5EE] px-2 py-0.5 rounded-full mb-1">
              <span>📋</span>
              <span>Activity Monitoring Based on Teacher Modules</span>
            </div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Teacher Learning Module Submissions &amp; Activity Tracker
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Review and verify teaching activity guides, lesson plans, sensory crafts, and worksheets submitted by Child Development Teachers against the curriculum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-[#FAF5EC] p-1 border border-card-border">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'feed'
                    ? 'bg-white text-dash-ink shadow-xs'
                    : 'text-dash-ink-soft hover:text-dash-ink'
                }`}
              >
                📚 Uploaded Modules ({filteredModules.length})
              </button>
              <button
                onClick={() => setActiveTab('compliance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'compliance'
                    ? 'bg-white text-dash-ink shadow-xs'
                    : 'text-dash-ink-soft hover:text-dash-ink'
                }`}
              >
                📊 Center Compliance Tracker
              </button>
            </div>

            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Record Module Upload</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="relative">
            <IconSearch className="w-4 h-4 text-[#A89F91] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search module title, teacher, CDC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-semibold text-dash-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All 13 Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="all">All Curriculum Levels</option>
              <option value="pre-k1">Pre-K1 (Ages 3–4)</option>
              <option value="pre-k2">Pre-K2 (Ages 4–5)</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="all">All Verification Statuses</option>
              <option value="approved">Approved &amp; Verified</option>
              <option value="pending">Pending MSWD Review</option>
            </select>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: MODULES UPLOADED FEED & VERIFICATION TABLE        */}
        {/* ======================================================== */}
        {activeTab === 'feed' && (
          <div className="space-y-3.5 pt-2">
            {filteredModules.map((module) => (
              <div
                key={module.id}
                className="p-4 rounded-2xl bg-[#FFFDF9] border border-card-border hover:border-accent transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        module.level === 'Pre-K1'
                          ? 'bg-[#DCEBDD] text-[#2E6B38]'
                          : 'bg-[#E0EFFE] text-[#1E5B94]'
                      }`}
                    >
                      {module.level} • Q{module.quarter}
                    </span>

                    <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2.5 py-0.5 rounded-md">
                      {module.week}: {module.sub_theme}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        module.verified_by_mswd
                          ? 'bg-[#DCEBDD] text-[#2E6B38]'
                          : module.status === 'Needs Revision'
                          ? 'bg-[#FDE2E2] text-danger'
                          : 'bg-[#FFF3D6] text-[#8C6200]'
                      }`}
                    >
                      {module.verified_by_mswd ? 'Verified by MSWDO ✓' : module.status || 'Pending Review'}
                    </span>
                  </div>

                  <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                    {module.title}
                  </h4>

                  <div className="text-xs text-dash-ink-soft flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Teacher: <b className="text-dash-ink font-semibold">{module.teacher_name}</b>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <IconBuilding className="w-3.5 h-3.5 text-accent" />
                      <span>{module.cdc_name}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <IconPin className="w-3 h-3 text-[#A89F91]" />
                      <span>Brgy. {module.barangay}</span>
                    </span>
                    <span>•</span>
                    <span>Uploaded: {module.upload_date}</span>
                  </div>

                  <p className="text-xs text-[#5A4C3C] m-0 leading-relaxed pt-0.5">
                    {module.description}
                  </p>

                  <div className="text-[11px] text-dash-ink-soft flex items-center gap-3 pt-1">
                    <span className="bg-[#FAF5EC] px-2 py-0.5 rounded border border-[#EBE1CF] font-mono">
                      📄 {module.module_type} ({module.file_type} • {module.file_size})
                    </span>
                    <span>📥 {module.downloads_count || 0} Teacher Downloads</span>
                  </div>
                </div>

                <div className="flex sm:flex-row md:flex-col items-end justify-center gap-2 shrink-0">
                  {!module.verified_by_mswd && (
                    <button
                      onClick={() => handleApproveModule(module.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Approve Module ✓
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setInspectingModule(module)}
                      className="px-3 py-1.5 rounded-xl bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-xs transition-colors cursor-pointer border border-[#E5DAC4]"
                    >
                      Inspect Module
                    </button>

                    {!module.verified_by_mswd && (
                      <button
                        onClick={() => handleRejectModule(module.id)}
                        className="px-2.5 py-1.5 rounded-xl hover:bg-danger/10 text-danger font-bold text-xs transition-colors cursor-pointer"
                      >
                        Revision
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredModules.length === 0 && (
              <div className="text-center py-10 text-dash-ink-soft text-xs">
                No uploaded modules found matching your search or filters.
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: DAYCARE CENTER MODULE COMPLIANCE TRACKER          */}
        {/* ======================================================== */}
        {activeTab === 'compliance' && (
          <div className="space-y-4 pt-2">
            <div className="overflow-x-auto rounded-xl border border-card-border">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                    <th className="px-4 py-3">Daycare Center &amp; Barangay</th>
                    <th className="px-4 py-3 text-center">Modules Uploaded</th>
                    <th className="px-4 py-3">Monthly Target Progress</th>
                    <th className="px-4 py-3">Latest Module Title</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6F1E7]">
                  {cdcComplianceData.map((c) => (
                    <tr key={c.id || c.name} className="hover:bg-[#FFFDF9] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-dash-ink">{c.name}</div>
                        <div className="text-[11px] text-dash-ink-soft">
                          Brgy. {c.barangay}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-dash-ink">
                        <span className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] border border-[#E8DFC9]">
                          {c.moduleCount} Uploaded
                        </span>
                      </td>

                      <td className="px-4 py-3.5 min-w-[140px]">
                        <div className="flex justify-between font-bold text-[11px] mb-1">
                          <span>{c.complianceRate}%</span>
                          <span className="text-dash-ink-soft">{c.moduleCount}/2 Target</span>
                        </div>
                        <div className="w-full bg-[#EAE0CF] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.complianceRate >= 100
                                ? 'bg-[#2E6B38]'
                                : c.complianceRate > 0
                                ? 'bg-[#E5A823]'
                                : 'bg-[#D1C7B7]'
                            }`}
                            style={{ width: `${c.complianceRate}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-dash-ink font-semibold max-w-[200px] truncate">
                        {c.recentModule ? (
                          <div>
                            <div className="truncate">{c.recentModule.title}</div>
                            <div className="text-[10px] text-dash-ink-soft">{c.recentModule.teacher_name}</div>
                          </div>
                        ) : (
                          <span className="text-dash-ink-soft italic">No upload this cycle</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold ${
                            c.complianceStatus === 'Compliant'
                              ? 'bg-[#DCEBDD] text-[#2E6B38]'
                              : c.complianceStatus === 'Partial'
                              ? 'bg-[#FFF3D6] text-[#8C6200]'
                              : 'bg-[#FDE2E2] text-[#9E2A2B]'
                          }`}
                        >
                          {c.complianceStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* INSPECT MODULE DOSSIER MODAL */}
      {inspectingModule && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-card-border space-y-4 animate-pop">
            <div className="flex items-start justify-between border-b border-card-border pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FAF5EC] text-accent tracking-wider">
                  Module Inspection Dossier
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {inspectingModule.title}
                </h3>
              </div>
              <button
                onClick={() => setInspectingModule(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#FAF5EC] rounded-xl">
                  <span className="text-dash-ink-soft text-[11px] block font-bold">Submitting Teacher</span>
                  <b className="text-dash-ink text-sm">{inspectingModule.teacher_name}</b>
                  <div className="text-[11px] text-dash-ink-soft mt-0.5">Brgy. {inspectingModule.barangay}</div>
                </div>
                <div className="p-3 bg-[#FAF5EC] rounded-xl">
                  <span className="text-dash-ink-soft text-[11px] block font-bold">Daycare Center</span>
                  <b className="text-dash-ink text-sm">{inspectingModule.cdc_name}</b>
                </div>
              </div>

              <div className="p-3 bg-[#FAF5EC] rounded-xl space-y-1">
                <span className="text-dash-ink-soft text-[11px] block font-bold">Curriculum Alignment:</span>
                <div className="font-bold text-dash-ink">
                  {inspectingModule.level} • Quarter {inspectingModule.quarter} • {inspectingModule.week}
                </div>
                <div className="text-xs text-accent font-semibold">
                  Theme: {inspectingModule.theme}
                </div>
                <div className="text-xs text-[#4A3B00] bg-[#FFF9CC] px-2 py-1 rounded inline-block font-bold mt-1">
                  Sub-theme: {inspectingModule.sub_theme}
                </div>
              </div>

              <div className="p-3 bg-[#FFFDF9] border border-card-border rounded-xl space-y-1">
                <span className="text-dash-ink-soft text-[11px] block font-bold">Module Overview &amp; Learning Objectives:</span>
                <p className="text-dash-ink m-0 leading-relaxed">
                  {inspectingModule.description}
                </p>
              </div>

              <div className="p-3 bg-[#FAF5EC] rounded-xl flex items-center justify-between">
                <span>Verification Status:</span>
                <b className={inspectingModule.verified_by_mswd ? 'text-[#2E6B38]' : 'text-[#8C6200]'}>
                  {inspectingModule.verified_by_mswd ? 'Verified & Approved by MSWDO ✓' : 'Under Review'}
                </b>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
              {!inspectingModule.verified_by_mswd && (
                <button
                  onClick={() => {
                    handleApproveModule(inspectingModule.id);
                    setInspectingModule(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Approve Module ✓
                </button>
              )}
              <button
                onClick={() => setInspectingModule(null)}
                className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD MODULE UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-card-border space-y-4 animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-card-border pb-3">
              <div>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink m-0">
                  Record Teacher Module Upload
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5">
                  Log newly received learning materials uploaded by Child Development Teachers.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-dash-ink block mb-1">Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-K1 W1: Name Tracing & Action Song Activity"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">Submitting Teacher</label>
                <select
                  required
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                >
                  <option value="">-- Choose Submitting Teacher --</option>
                  {realTeachersList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} — Brgy. {t.barangay} ({t.cdc_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-dash-ink block mb-1">Curriculum Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="Pre-K1">Pre-K1 (Ages 3–4)</option>
                    <option value="Pre-K2">Pre-K2 (Ages 4–5)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-dash-ink block mb-1">Quarter</label>
                  <select
                    value={newQuarter}
                    onChange={(e) => setNewQuarter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  >
                    <option value="1">Quarter 1</option>
                    <option value="2">Quarter 2</option>
                    <option value="3">Quarter 3</option>
                    <option value="4">Quarter 4</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-dash-ink block mb-1">Week</label>
                  <input
                    type="text"
                    value={newWeek}
                    onChange={(e) => setNewWeek(e.target.value)}
                    placeholder="e.g. Week 1 or Week 2 & 3"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-bold text-dash-ink block mb-1">Sub-Theme</label>
                  <input
                    type="text"
                    value={newSubTheme}
                    onChange={(e) => setNewSubTheme(e.target.value)}
                    placeholder="e.g. I HAVE A NAME"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">Resource Type</label>
                <select
                  value={newModuleType}
                  onChange={(e) => setNewModuleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                >
                  <option value="Activity Worksheet">Activity Worksheet</option>
                  <option value="Lesson Plan & Practice Sheet">Lesson Plan &amp; Practice Sheet</option>
                  <option value="Cut-out Sorting Activity">Cut-out Sorting Activity</option>
                  <option value="Printable Emotion Flashcards">Printable Emotion Flashcards</option>
                  <option value="Interactive Visual Board">Interactive Visual Board</option>
                  <option value="Sensory Art & Parent Guide">Sensory Art &amp; Parent Guide</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-dash-ink block mb-1">Description &amp; Activity Instructions</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline toddler engagement steps and materials needed..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-semibold text-dash-ink outline-none focus:border-accent resize-none"
                />
              </div>

              {uploadSuccess && (
                <div className="p-3 rounded-xl bg-[#DCEBDD] text-[#2E6B38] font-bold text-center">
                  {uploadSuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Record &amp; Verify Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
