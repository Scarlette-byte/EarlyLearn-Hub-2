import { useState, useMemo, useEffect } from 'react';
import { barangays } from '../../lib/supabaseClient';
import {
  initialTeacherModules,
  realTeachersList,
  realCdcsList,
} from '../../lib/curriculumData.js';
import {
  IconSearch,
  IconCheck,
  IconClose,
  IconBuilding,
  IconPin,
  IconMaterials,
  IconPlus,
} from '../Icons.jsx';

export default function ProgramMonitoring({
  cdcs = [],
  onVerifyReport,
}) {
  const [activeTab, setActiveTab] = useState('all_posts'); // 'all_posts' | 'activities' | 'files' | 'videos' | 'compliance'
  const [viewLayout, setViewLayout] = useState('table'); // 'table' | 'cards'
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

  // Real-time synchronization with Teacher Dashboard posts
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('earlylearn_teacher_modules');
        if (saved) {
          setModules(JSON.parse(saved));
        }
      } catch (err) {
        console.warn('Failed loading teacher modules from storage:', err);
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('earlylearn_modules_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('earlylearn_modules_updated', handleSync);
    };
  }, []);

  // New module upload form state (for admin manual entry)
  const [newTitle, setNewTitle] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newLevel, setNewLevel] = useState('Pre-K1');
  const [newQuarter, setNewQuarter] = useState('1');
  const [newWeek, setNewWeek] = useState('Week 1');
  const [newSubTheme, setNewSubTheme] = useState('I HAVE A NAME');
  const [newModuleType, setNewModuleType] = useState('Activity Worksheet');
  const [newDescription, setNewDescription] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Classify module as activity or file or video
  const getItemCategory = (m) => {
    const typeStr = (m.module_type || m.type || '').toLowerCase();
    const fileStr = (m.file_type || '').toLowerCase();

    if (typeStr.includes('video') || fileStr.includes('mp4')) {
      return 'video';
    }
    if (
      typeStr.includes('file') ||
      typeStr.includes('document') ||
      typeStr.includes('pdf') ||
      typeStr.includes('guide') ||
      fileStr.includes('pdf') ||
      fileStr.includes('doc')
    ) {
      return 'file';
    }
    return 'activity';
  };

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
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }
  };

  // Handle Reject / Request Revision
  const handleRejectModule = (moduleId) => {
    const reason = prompt(
      'Please enter a revision request note for the teacher:',
      'Please align activity steps with DepEd ECCD sensory guidelines.'
    );
    if (!reason) return;

    const updated = modules.map((m) =>
      m.id === moduleId
        ? { ...m, status: 'Needs Revision', verified_by_mswd: false, revision_notes: reason }
        : m
    );
    setModules(updated);
    try {
      localStorage.setItem('earlylearn_teacher_modules', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }
  };

  // Handle Add Module manually
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
      file_type: newModuleType.toLowerCase().includes('video') ? 'MP4' : 'PDF',
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
      window.dispatchEvent(new CustomEvent('earlylearn_modules_updated', { detail: updated }));
    } catch {
      // Ignored
    }

    setUploadSuccess('✅ Post successfully recorded and verified!');
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
      const cat = getItemCategory(m);

      // Tab filtering
      if (activeTab === 'activities' && cat !== 'activity') return false;
      if (activeTab === 'files' && cat !== 'file') return false;
      if (activeTab === 'videos' && cat !== 'video') return false;

      const matchesSearch =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cdc_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.sub_theme || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.barangay || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.module_type || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBarangay = !selectedBarangay || m.barangay?.toLowerCase() === selectedBarangay.toLowerCase();
      const matchesLevel = selectedLevel === 'all' || m.level?.toLowerCase() === selectedLevel.toLowerCase();
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'approved' && m.verified_by_mswd) ||
        (selectedStatus === 'pending' && !m.verified_by_mswd);

      return matchesSearch && matchesBarangay && matchesLevel && matchesStatus;
    });
  }, [modules, activeTab, searchTerm, selectedBarangay, selectedLevel, selectedStatus]);

  // Aggregate counts
  const totalModules = modules.length;
  const activityCount = modules.filter((m) => getItemCategory(m) === 'activity').length;
  const fileCount = modules.filter((m) => getItemCategory(m) === 'file').length;
  const videoCount = modules.filter((m) => getItemCategory(m) === 'video').length;
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
      {/* Metrics Row: Organized summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Total Teacher Posts
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {totalModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5 flex items-center gap-1.5">
            <span className="font-semibold text-amber-700">{activityCount} Activities</span>
            <span>•</span>
            <span className="font-semibold text-sky-700">{fileCount} Files</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Approved &amp; Verified
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {approvedModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {Math.round((approvedModules / (totalModules || 1)) * 100)}% verified by MSWDO
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
            Pending MSWD Review
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {pendingModules}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Awaiting verification</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-accent uppercase tracking-wider">
            Active Teachers
          </div>
          <div className="font-fraunces text-2xl font-bold text-accent mt-1">
            {activeTeachersCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Across 46 CDCs</div>
        </div>
      </div>

      {/* Main Monitoring Card */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        {/* Top Header & Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#F0E6D2]">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent bg-[#FFF5EE] px-2.5 py-0.5 rounded-full mb-1">
              <span>📋</span>
              <span>Activity &amp; File Monitoring</span>
            </div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Teacher Posted Activities &amp; Files Tracker
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Review and verify teaching activity worksheets, lesson guides, sensory crafts, and uploaded files submitted by teachers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewLayout === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Concise Table View"
              >
                📑 Concise Table
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewLayout === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Expanded Cards View"
              >
                🗂️ Cards
              </button>
            </div>

            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Record Post Upload</span>
            </button>
          </div>
        </div>

        {/* Category Tabs: All, Activities, Files, Videos, Compliance */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
          <button
            onClick={() => setActiveTab('all_posts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all_posts'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📚 All Posts</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all_posts' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {totalModules}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'activities'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span>✏️ Activity Worksheets</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'activities' ? 'bg-white/20 text-white' : 'bg-amber-200/60 text-amber-900'}`}>
              {activityCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'files'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 text-sky-900 hover:bg-sky-100'
            }`}
          >
            <span>📁 Files &amp; Documents</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'files' ? 'bg-white/20 text-white' : 'bg-sky-200/60 text-sky-900'}`}>
              {fileCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'videos'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
            }`}
          >
            <span>🎬 Video Lessons</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'videos' ? 'bg-white/20 text-white' : 'bg-purple-200/60 text-purple-900'}`}>
              {videoCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ml-auto ${
              activeTab === 'compliance'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-[#FAF5EC] text-dash-ink hover:bg-[#F0E8D8]'
            }`}
          >
            <span>📊 Center Compliance Tracker</span>
          </button>
        </div>

        {/* Filter Toolbar (Search, Barangay, Level, Status) */}
        {activeTab !== 'compliance' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="relative">
              <IconSearch className="w-4 h-4 text-[#A89F91] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search activity, file, teacher..."
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
                <option value="">All 22 Barangays</option>
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
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
              >
                <option value="all">All Curriculum Levels</option>
                <option value="pre-k1">Pre-K 1 (3.11 years old)</option>
                <option value="pre-k2">Pre-K 2 (4.11 years old)</option>
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
        )}

        {/* ======================================================== */}
        {/* TAB 1: CONCISE TABLE VIEW FOR ACTIVITIES & FILES        */}
        {/* ======================================================== */}
        {activeTab !== 'compliance' && viewLayout === 'table' && (
          <div className="overflow-x-auto rounded-xl border border-card-border mt-2">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase">
                  <th className="px-3.5 py-3 text-center">Type</th>
                  <th className="px-4 py-3">Topic &amp; Posted Title</th>
                  <th className="px-4 py-3">Teacher &amp; Day Care Center</th>
                  <th className="px-3 py-3 text-center">Level / Quarter</th>
                  <th className="px-3 py-3 text-center">File Details</th>
                  <th className="px-3 py-3 text-center">Date Posted</th>
                  <th className="px-3 py-3 text-center">MSWDO Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F1E7]">
                {filteredModules.map((module) => {
                  const cat = getItemCategory(module);

                  return (
                    <tr key={module.id} className="hover:bg-[#FFFDF9] transition-colors">
                      {/* 1. Type Badge */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {cat === 'activity' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span>✏️ Activity</span>
                          </span>
                        )}
                        {cat === 'file' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <span>📁 File/Doc</span>
                          </span>
                        )}
                        {cat === 'video' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            <span>🎬 Video</span>
                          </span>
                        )}
                      </td>

                      {/* 2. Topic & Title */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-bold text-dash-ink text-xs line-clamp-1">
                          {module.title}
                        </div>
                        <div className="text-[11px] text-[#8C6200] font-medium mt-0.5 line-clamp-1">
                          {module.week}: {module.sub_theme || module.theme}
                        </div>
                        {module.description && (
                          <div className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                            {module.description}
                          </div>
                        )}
                      </td>

                      {/* 3. Teacher & CDC */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{module.teacher_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <IconBuilding className="w-3 h-3 text-accent shrink-0" />
                          <span>{module.cdc_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Brgy. {module.barangay}
                        </div>
                      </td>

                      {/* 4. Level & Quarter */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            module.level === 'Pre-K1'
                              ? 'bg-[#DCEBDD] text-[#2E6B38]'
                              : 'bg-[#E0EFFE] text-[#1E5B94]'
                          }`}
                        >
                          {module.level} • Q{module.quarter}
                        </span>
                      </td>

                      {/* 5. File Details */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10.5px]">
                          {module.file_type || 'PDF'} • {module.file_size || '2.4 MB'}
                        </span>
                      </td>

                      {/* 6. Date */}
                      <td className="px-3 py-3 text-center whitespace-nowrap text-slate-600 font-medium">
                        {module.upload_date}
                      </td>

                      {/* 7. Status */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            module.verified_by_mswd
                              ? 'bg-[#DCEBDD] text-[#2E6B38] border border-emerald-200'
                              : module.status === 'Needs Revision'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {module.verified_by_mswd
                            ? 'Approved ✓'
                            : module.status === 'Needs Revision'
                            ? 'Needs Revision'
                            : 'Pending Review'}
                        </span>
                      </td>

                      {/* 8. Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!module.verified_by_mswd && (
                            <button
                              onClick={() => handleApproveModule(module.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                              title="Approve this post"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => setInspectingModule(module)}
                            className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-[11px] transition-colors cursor-pointer border border-[#E5DAC4]"
                          >
                            Inspect
                          </button>
                          {!module.verified_by_mswd && (
                            <button
                              onClick={() => handleRejectModule(module.id)}
                              className="px-2 py-1 rounded-lg hover:bg-rose-50 text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                              title="Request revision"
                            >
                              Revision
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredModules.length === 0 && (
              <div className="text-center py-10 text-dash-ink-soft text-xs">
                No teacher-posted activities or files found matching your search or filters.
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1 (ALTERNATIVE): EXPANDED CARDS VIEW                 */}
        {/* ======================================================== */}
        {activeTab !== 'compliance' && viewLayout === 'cards' && (
          <div className="space-y-3 pt-2">
            {filteredModules.map((module) => {
              const cat = getItemCategory(module);

              return (
                <div
                  key={module.id}
                  className="p-4 rounded-2xl bg-[#FFFDF9] border border-card-border hover:border-accent transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {cat === 'activity' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ✏️ Activity Worksheet
                        </span>
                      ) : cat === 'file' ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-900 border border-sky-300">
                          📁 Document File / PDF
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-900 border border-purple-300">
                          🎬 Video Lesson
                        </span>
                      )}

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
                        {module.week}: {module.sub_theme || module.theme}
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
                        📄 {module.module_type || 'Activity Worksheet'} ({module.file_type || 'PDF'} • {module.file_size || '2.4 MB'})
                      </span>
                      <span>📥 {module.downloads_count || 0} Downloads</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-row md:flex-col items-end justify-center gap-2 shrink-0">
                    {!module.verified_by_mswd && (
                      <button
                        onClick={() => handleApproveModule(module.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Approve Post ✓
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setInspectingModule(module)}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-xs transition-colors cursor-pointer border border-[#E5DAC4]"
                      >
                        Inspect Details
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
              );
            })}

            {filteredModules.length === 0 && (
              <div className="text-center py-10 text-dash-ink-soft text-xs">
                No uploaded activities or files found matching your criteria.
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

                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-xs bg-[#FFF9ED] px-3 py-1 rounded-lg border border-[#F0E4CE]">
                          {c.moduleCount}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="w-full max-w-xs space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span>{c.complianceRate}% of target</span>
                            <span className="text-dash-ink-soft">{c.moduleCount} / 2 uploads</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#EFE8DC] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                c.complianceRate >= 100
                                  ? 'bg-[#2E6B38]'
                                  : c.complianceRate > 0
                                  ? 'bg-accent'
                                  : 'bg-danger'
                              }`}
                              style={{ width: `${c.complianceRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {c.recentModule ? (
                          <div className="max-w-xs">
                            <div className="font-bold text-xs truncate">
                              {c.recentModule.title}
                            </div>
                            <div className="text-[10.5px] text-dash-ink-soft">
                              {c.recentModule.upload_date} • {c.recentModule.teacher_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-dash-ink-soft italic text-[11px]">
                            No modules uploaded yet
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            c.complianceStatus === 'Compliant'
                              ? 'bg-[#DCEBDD] text-[#2E6B38]'
                              : c.complianceStatus === 'Partial'
                              ? 'bg-[#FFF3D6] text-[#8C6200]'
                              : 'bg-[#FDE2E2] text-danger'
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

      {/* ======================================================== */}
      {/* MODAL: INSPECT MODULE DETAILS & VERIFY                   */}
      {/* ======================================================== */}
      {inspectingModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-card-border shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-[#F0E6D2]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      inspectingModule.level === 'Pre-K1'
                        ? 'bg-[#DCEBDD] text-[#2E6B38]'
                        : 'bg-[#E0EFFE] text-[#1E5B94]'
                    }`}
                  >
                    {inspectingModule.level} • Q{inspectingModule.quarter}
                  </span>
                  <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFF3D6] px-2 py-0.5 rounded">
                    {inspectingModule.week}: {inspectingModule.sub_theme || inspectingModule.theme}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      inspectingModule.verified_by_mswd
                        ? 'bg-[#DCEBDD] text-[#2E6B38]'
                        : 'bg-[#FFF3D6] text-[#8C6200]'
                    }`}
                  >
                    {inspectingModule.verified_by_mswd ? 'Verified by MSWDO ✓' : 'Pending Review'}
                  </span>
                </div>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink m-0">
                  {inspectingModule.title}
                </h3>
              </div>
              <button
                onClick={() => setInspectingModule(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] hover:bg-[#F0E6D2] flex items-center justify-center text-dash-ink-soft text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-card-border space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-dash-ink-soft block font-bold">Author / Submitting Teacher</span>
                  <span className="font-bold text-dash-ink text-sm">{inspectingModule.teacher_name}</span>
                </div>
                <div>
                  <span className="text-dash-ink-soft block font-bold">Child Development Center</span>
                  <span className="font-bold text-dash-ink text-sm">
                    {inspectingModule.cdc_name} (Brgy. {inspectingModule.barangay})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F0E6D2]">
                <div>
                  <span className="text-dash-ink-soft block">Post Category</span>
                  <span className="font-bold text-dash-ink">
                    {getItemCategory(inspectingModule) === 'activity' ? '✏️ Activity Worksheet' : '📁 Document File / PDF'}
                  </span>
                </div>
                <div>
                  <span className="text-dash-ink-soft block">Format &amp; Size</span>
                  <span className="font-bold text-dash-ink">
                    {inspectingModule.file_type || 'PDF'} ({inspectingModule.file_size || '2.4 MB'})
                  </span>
                </div>
                <div>
                  <span className="text-dash-ink-soft block">Date Uploaded</span>
                  <span className="font-bold text-dash-ink">{inspectingModule.upload_date}</span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-dash-ink text-xs uppercase mb-1">
                ECCD Pedagogical Description &amp; Instructions
              </h5>
              <div className="p-3.5 rounded-xl bg-[#FAF5EC] border border-[#EBE1CF] text-xs text-[#4F422E] leading-relaxed">
                {inspectingModule.description}
              </div>
            </div>

            {inspectingModule.content_url && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs flex items-center justify-between">
                <span className="font-bold text-sky-900">Attached Resource Link:</span>
                <a
                  href={inspectingModule.content_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline font-bold"
                >
                  Open External File / Media Link ↗
                </a>
              </div>
            )}

            {inspectingModule.revision_notes && (
              <div className="p-3.5 rounded-xl bg-[#FDE2E2] border border-rose-200 text-xs text-danger space-y-1">
                <div className="font-bold">⚠️ Requested Revision Note:</div>
                <div>{inspectingModule.revision_notes}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-card-border">
              <button
                onClick={() => {
                  alert(`Downloading file for "${inspectingModule.title}" (${inspectingModule.file_size || '2.4 MB'})...`);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>📥 Download File / Worksheet</span>
              </button>

              <div className="flex items-center gap-2">
                {!inspectingModule.verified_by_mswd ? (
                  <>
                    <button
                      onClick={() => {
                        handleRejectModule(inspectingModule.id);
                        setInspectingModule(null);
                      }}
                      className="px-3.5 py-2 rounded-xl hover:bg-danger/10 text-danger font-bold text-xs transition-colors cursor-pointer"
                    >
                      Request Revision
                    </button>
                    <button
                      onClick={() => {
                        handleApproveModule(inspectingModule.id);
                        setInspectingModule(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#2E6B38] hover:bg-[#23532B] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Verify &amp; Approve Post ✓
                    </button>
                  </>
                ) : (
                  <span className="text-xs font-bold text-[#2E6B38] bg-[#DCEBDD] px-3 py-1.5 rounded-xl border border-emerald-300">
                    Officially MSWDO Approved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECORD NEW MODULE / POST (ADMIN OVERRIDE)        */}
      {/* ======================================================== */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-card-border shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E6D2]">
              <div>
                <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Record Teacher Post (Activity or File)
                </h3>
                <p className="text-xs text-dash-ink-soft mt-0.5">
                  Record and verify learning activities or files submitted by Day Care Teachers.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] hover:bg-[#F0E6D2] flex items-center justify-center text-dash-ink-soft text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-dash-ink block mb-1">Activity / File Title</label>
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
                    <option value="Pre-K1">Pre-K 1 (3.11 years old)</option>
                    <option value="Pre-K2">Pre-K 2 (4.11 years old)</option>
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
                <label className="font-bold text-dash-ink block mb-1">Post / File Format</label>
                <select
                  value={newModuleType}
                  onChange={(e) => setNewModuleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-bold text-dash-ink outline-none focus:border-accent"
                >
                  <option value="Activity Worksheet">✏️ Activity Worksheet</option>
                  <option value="Lesson Plan & Practice Sheet">📁 Lesson Plan &amp; Practice Sheet (File)</option>
                  <option value="Official PDF Document">📁 Official PDF Document (File)</option>
                  <option value="Cut-out Sorting Activity">✏️ Cut-out Sorting Activity</option>
                  <option value="Printable Emotion Flashcards">✏️ Printable Emotion Flashcards</option>
                  <option value="Video Lesson Guide">🎬 Video Lesson Guide</option>
                  <option value="Sensory Art & Parent Guide">📁 Sensory Art &amp; Parent Guide</option>
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
                  Record &amp; Verify Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
