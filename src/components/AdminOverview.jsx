import { useState } from 'react';
import { barangays } from '../lib/supabaseClient';

export default function AdminOverview({
  profile,
  profiles = [],
  teachers = [],
  learners = [],
  cdcs = [],
  categories = [],
  materials = [],
  approvals = [],
  onTabChange,
  decideApproval,
}) {
  const [barangaySearch, setBarangaySearch] = useState('');

  // 1. Calculations & Metrics
  const totalUsers = profiles.length;
  const adminCount = profiles.filter((p) => p.role === 'admin').length;
  const teacherCount = teachers.length || profiles.filter((p) => p.role === 'teacher').length;
  const learnerCount = learners.length || profiles.filter((p) => p.role === 'student').length;
  const pendingApprovalsCount = approvals.length;
  const approvedMaterialsCount = materials.filter((m) => m.status === 'approved').length;

  // Active Barangays
  const activeBarangaySet = new Set(
    [
      ...profiles.map((p) => p.barangay),
      ...learners.map((l) => l.barangay),
      ...teachers.map((t) => t.barangay),
    ].filter(Boolean)
  );
  const activeBarangayCount = activeBarangaySet.size;
  const coveragePercent = Math.min(100, Math.round((activeBarangayCount / 22) * 100));

  // Barangay user/learner counts map
  const barangayCounts = {};
  barangays.forEach((b) => {
    barangayCounts[b] = 0;
  });
  profiles.forEach((p) => {
    if (p.barangay && barangayCounts[p.barangay] !== undefined) {
      barangayCounts[p.barangay]++;
    }
  });
  learners.forEach((l) => {
    if (l.barangay && barangayCounts[l.barangay] !== undefined) {
      barangayCounts[l.barangay]++;
    }
  });

  // Media type counts
  const mediaCounts = {
    video: materials.filter((m) => m.type === 'video').length,
    pdf: materials.filter((m) => m.type === 'pdf').length,
    flashcard: materials.filter((m) => m.type === 'flashcard').length,
    audio: materials.filter((m) => m.type === 'audio').length,
    game: materials.filter((m) => m.type === 'game' || m.type === 'interactive').length,
  };
  const totalMedia = materials.length || 1;

  // Category counts
  const categoryCounts = {};
  categories.forEach((c) => {
    categoryCounts[c.id] = materials.filter(
      (m) => m.category_id === c.id || m.categories?.name === c.name
    ).length;
  });

  // Greeting by hour
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Maayong Buntag' : hour < 18 ? 'Maayong Hapon' : 'Maayong Gabii';

  // Filtered barangay list for search
  const filteredBarangays = barangays.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  // Recent 4 users
  const recentUsers = [...profiles]
    .filter((p) => p.full_name)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. MUNICIPAL WELCOME & SYSTEM STATUS HERO BANNER          */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#FFF9EE] via-[#FDF2DC] to-[#F5E5C4] border border-[#EADBBD] rounded-3xl p-6 sm:p-7 shadow-card">
        {/* Floating background decorative badge */}
        <div className="absolute -right-6 -bottom-8 text-8xl opacity-15 select-none pointer-events-none">
          🌻
        </div>
        <div className="absolute right-24 -top-8 text-7xl opacity-10 select-none pointer-events-none">
          ✨
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sun/30 border border-sun/60 text-xs font-bold text-[#6B5313] mb-3">
              <span>🏛️ Municipality of Manolo Fortich</span>
              <span>•</span>
              <span>ECCD Early Childhood Care & Development</span>
            </div>

            <h2 className="font-fraunces text-2xl sm:text-3xl font-extrabold text-dash-ink tracking-tight m-0">
              {greeting}, {profile?.full_name || 'Super Admin'}! 👋
            </h2>

            <p className="font-nunito text-sm sm:text-[15px] text-dash-ink-soft mt-2 leading-relaxed m-0">
              Welcome to the <strong>EarlyLearn Hub Central Administration</strong>. Supervising
              quality early learning, curriculum materials, and child development workers across all{' '}
              <strong>22 Barangays</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 mt-4 text-xs font-semibold text-dash-ink">
              <span className="inline-flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-lg border border-[#E8DFC8]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                System Active & Live Synced
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-lg border border-[#E8DFC8]">
                <span>📅</span>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-lg border border-[#E8DFC8]">
                <span>📍</span>
                Manolo Fortich, Bukidnon
              </span>
            </div>
          </div>

          {/* Header Action Shortcuts */}
          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
            <button
              onClick={() => onTabChange('users')}
              className="px-4 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-baloo font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>👥</span>
              <span>Manage Users ({totalUsers})</span>
            </button>

            <button
              onClick={() => onTabChange('approvals')}
              className={`px-4 py-2.5 rounded-xl font-baloo font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                pendingApprovalsCount > 0
                  ? 'bg-danger text-white hover:bg-danger/90 animate-bounce'
                  : 'bg-white hover:bg-[#FAF4E8] text-dash-ink border border-[#E5DAC4]'
              }`}
            >
              <span>{pendingApprovalsCount > 0 ? '⚡' : '✅'}</span>
              <span>
                {pendingApprovalsCount > 0
                  ? `${pendingApprovalsCount} Pending Review!`
                  : 'Approvals Queue (0)'}
              </span>
            </button>

            <button
              onClick={() => onTabChange('learners')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF4E8] text-dash-ink font-baloo font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 border border-[#E5DAC4] cursor-pointer"
            >
              <span>🧒</span>
              <span>Enrolled Learners ({learnerCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. DYNAMIC 6-CARD MULTI-METRIC KPI GRID                   */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-fraunces text-base font-bold text-dash-ink m-0">
            📊 Executive Summary Metrics
          </h3>
          <span className="text-xs text-dash-ink-soft">Click any card to inspect & manage</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CARD 1: TOTAL USERS */}
          <div
            onClick={() => onTabChange('users')}
            className="group relative bg-white hover:bg-[#FFFDF9] rounded-2xl p-5 border border-card-border shadow-card hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sun via-gold to-accent" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#8A6420] uppercase tracking-wider block">
                  Total Users
                </span>
                <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-dash-ink block mt-1">
                  {totalUsers}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFF5DE] text-[#8A6420] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                👥
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#F7F2E7] flex items-center justify-between text-xs">
              <span className="text-dash-ink-soft font-semibold">
                {adminCount} Admins • {teacherCount} Teachers • {learnerCount} Students
              </span>
              <span className="text-accent font-bold group-hover:translate-x-1 transition-transform">
                Manage →
              </span>
            </div>
          </div>

          {/* CARD 2: TEACHERS */}
          <div
            onClick={() => onTabChange('teachers')}
            className="group relative bg-white hover:bg-[#FDFEFC] rounded-2xl p-5 border border-[#DCEADF] shadow-card hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-leaf to-[#3D7048]" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#3D7048] uppercase tracking-wider block">
                  Day Care Teachers (CDWs)
                </span>
                <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#2F5938] block mt-1">
                  {teacherCount}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#DCEBDD] text-[#3D7048] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                🍎
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#EDF4EE] flex items-center justify-between text-xs">
              <span className="text-dash-ink-soft font-semibold">
                {cdcs.length > 0 ? `${cdcs.length} CDC Centers Active` : 'Accredited Teachers'}
              </span>
              <span className="text-[#3D7048] font-bold group-hover:translate-x-1 transition-transform">
                Directory →
              </span>
            </div>
          </div>

          {/* CARD 3: LEARNERS */}
          <div
            onClick={() => onTabChange('learners')}
            className="group relative bg-white hover:bg-[#FAFDFE] rounded-2xl p-5 border border-[#D4E7F4] shadow-card hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky to-[#386B93]" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#386B93] uppercase tracking-wider block">
                  Enrolled Learners
                </span>
                <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#234C6B] block mt-1">
                  {learnerCount}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#DCE8F2] text-[#386B93] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                🧒
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#EEF5FA] flex items-center justify-between text-xs">
              <span className="text-dash-ink-soft font-semibold">
                Aged 3–4 with Parent Profiles
              </span>
              <span className="text-[#386B93] font-bold group-hover:translate-x-1 transition-transform">
                Registry →
              </span>
            </div>
          </div>

          {/* CARD 4: APPROVED MATERIALS */}
          <div
            onClick={() => onTabChange('materials')}
            className="group relative bg-white hover:bg-[#FFFDFB] rounded-2xl p-5 border border-[#F6E1D2] shadow-card hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E88F5D] to-accent" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-accent uppercase tracking-wider block">
                  Learning Materials
                </span>
                <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#944D25] block mt-1">
                  {approvedMaterialsCount}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FDEEE4] text-accent text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                📚
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#F8EFE8] flex items-center justify-between text-xs">
              <span className="text-dash-ink-soft font-semibold">
                {materials.length} total uploads across {categories.length} categories
              </span>
              <span className="text-accent font-bold group-hover:translate-x-1 transition-transform">
                Library →
              </span>
            </div>
          </div>

          {/* CARD 5: PENDING APPROVALS */}
          <div
            onClick={() => onTabChange('approvals')}
            className={`group relative bg-white rounded-2xl p-5 border shadow-card hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden ${
              pendingApprovalsCount > 0
                ? 'border-danger/30 hover:bg-[#FFF8F7]'
                : 'border-card-border hover:bg-[#FFFDF9]'
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                pendingApprovalsCount > 0
                  ? 'bg-gradient-to-r from-coral to-danger animate-pulse'
                  : 'bg-[#DCEBDD]'
              }`}
            />
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider block ${
                    pendingApprovalsCount > 0 ? 'text-danger' : 'text-[#3D7048]'
                  }`}
                >
                  Pending Approvals
                </span>
                <span
                  className={`font-baloo text-3xl sm:text-4xl font-extrabold block mt-1 ${
                    pendingApprovalsCount > 0 ? 'text-danger' : 'text-[#3D7048]'
                  }`}
                >
                  {pendingApprovalsCount}
                </span>
              </div>
              <div
                className={`w-12 h-12 rounded-2xl text-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                  pendingApprovalsCount > 0
                    ? 'bg-danger/10 text-danger'
                    : 'bg-[#DCEBDD] text-[#3D7048]'
                }`}
              >
                {pendingApprovalsCount > 0 ? '⏳' : '✅'}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#F7F2E7] flex items-center justify-between text-xs">
              <span className="text-dash-ink-soft font-semibold">
                {pendingApprovalsCount > 0 ? 'Teacher submissions need review' : 'All caught up!'}
              </span>
              <span
                className={`font-bold group-hover:translate-x-1 transition-transform ${
                  pendingApprovalsCount > 0 ? 'text-danger' : 'text-[#3D7048]'
                }`}
              >
                {pendingApprovalsCount > 0 ? 'Review Now →' : 'View Queue →'}
              </span>
            </div>
          </div>

          {/* CARD 6: BARANGAYS COVERAGE */}
          <div
            onClick={() => onTabChange('users')}
            className="group relative bg-white hover:bg-[#FAF9FD] rounded-2xl p-5 border border-[#E7DEF5] shadow-card hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple to-[#6B4BB0]" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-purple uppercase tracking-wider block">
                  Municipal Coverage
                </span>
                <span className="font-baloo text-3xl sm:text-4xl font-extrabold text-[#55369A] block mt-1">
                  {activeBarangayCount} <span className="text-lg font-bold text-dash-ink-soft">/ 22</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#EDE4FF] text-purple text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                📍
              </div>
            </div>

            <div className="mt-2.5">
              <div className="w-full bg-[#EFE8FA] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple h-full rounded-full transition-all duration-700"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#F3EBFD] flex items-center justify-between text-xs">
              <span className="text-dash-ink-soft font-semibold">{coveragePercent}% of Barangays</span>
              <span className="text-purple font-bold group-hover:translate-x-1 transition-transform">
                Explore →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. PENDING APPROVAL SPOTLIGHT (IF ITEMS PENDING)          */}
      {/* ========================================================= */}
      {pendingApprovalsCount > 0 && (
        <div className="bg-white rounded-3xl p-6 border-2 border-coral/30 shadow-card relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-card-border mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger text-xl flex items-center justify-center shrink-0">
                ⚡
              </div>
              <div>
                <h4 className="font-fraunces text-lg font-bold text-dash-ink m-0">
                  Priority Review: Materials Awaiting Admin Approval ({pendingApprovalsCount})
                </h4>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  Teachers submitted new lessons that require verification before becoming visible
                  to students.
                </p>
              </div>
            </div>

            <button
              onClick={() => onTabChange('approvals')}
              className="text-xs font-bold text-danger hover:underline bg-transparent border-none cursor-pointer self-start sm:self-center"
            >
              Open Full Approvals Tab →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {approvals.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-[#FFFDF9] rounded-2xl p-4 border border-[#EFE7D8] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF0DC] text-[#8A6420]">
                      {item.categories?.name || 'Curriculum'}
                    </span>
                    <span className="text-xs font-mono text-dash-ink-soft uppercase font-bold">
                      {item.type}
                    </span>
                  </div>
                  <h5 className="font-bold text-sm text-dash-ink m-0 line-clamp-1">{item.title}</h5>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-[#F2EBDE]">
                  <button
                    onClick={() => decideApproval && decideApproval(item.id, 'approved')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => decideApproval && decideApproval(item.id, 'rejected')}
                    className="py-1.5 px-3 rounded-lg bg-[#FAF0EE] hover:bg-danger/20 text-danger font-bold text-xs cursor-pointer transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SUPER ADMIN COMMAND TOOLS (QUICK ACTIONS)              */}
      {/* ========================================================= */}
      <div>
        <h3 className="font-fraunces text-base font-bold text-dash-ink mb-3 px-1">
          ⚡ Quick Management Actions
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => onTabChange('users')}
            className="bg-white hover:bg-[#FFFDF7] p-4 rounded-2xl border border-card-border shadow-card hover:shadow-md transition-all text-center cursor-pointer group"
          >
            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#FFF5DE] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
              👥
            </div>
            <div className="font-bold text-xs text-dash-ink">Manage Users</div>
            <div className="text-[10px] text-dash-ink-soft mt-0.5">Edit & Passwords</div>
          </div>

          <div
            onClick={() => onTabChange('teachers')}
            className="bg-white hover:bg-[#FDFEFC] p-4 rounded-2xl border border-card-border shadow-card hover:shadow-md transition-all text-center cursor-pointer group"
          >
            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#DCEBDD] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
              🍎
            </div>
            <div className="font-bold text-xs text-dash-ink">Teachers & CDCs</div>
            <div className="text-[10px] text-dash-ink-soft mt-0.5">Accredited Workers</div>
          </div>

          <div
            onClick={() => onTabChange('learners')}
            className="bg-white hover:bg-[#FAFDFE] p-4 rounded-2xl border border-card-border shadow-card hover:shadow-md transition-all text-center cursor-pointer group"
          >
            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#DCE8F2] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
              🧒
            </div>
            <div className="font-bold text-xs text-dash-ink">Learners & Parents</div>
            <div className="text-[10px] text-dash-ink-soft mt-0.5">Enrollment records</div>
          </div>

          <div
            onClick={() => onTabChange('categories')}
            className="bg-white hover:bg-[#FFFDFB] p-4 rounded-2xl border border-card-border shadow-card hover:shadow-md transition-all text-center cursor-pointer group"
          >
            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#FDEEE4] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
              🗂️
            </div>
            <div className="font-bold text-xs text-dash-ink">Categories</div>
            <div className="text-[10px] text-dash-ink-soft mt-0.5">Subjects & Topics</div>
          </div>

          <div
            onClick={() => onTabChange('materials')}
            className="bg-white hover:bg-[#FFFDFB] p-4 rounded-2xl border border-card-border shadow-card hover:shadow-md transition-all text-center cursor-pointer group"
          >
            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#F9DFD2] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
              📚
            </div>
            <div className="font-bold text-xs text-dash-ink">All Materials</div>
            <div className="text-[10px] text-dash-ink-soft mt-0.5">Repository</div>
          </div>

          <div
            onClick={() => onTabChange('approvals')}
            className="bg-white hover:bg-[#FFF9F9] p-4 rounded-2xl border border-card-border shadow-card hover:shadow-md transition-all text-center cursor-pointer group"
          >
            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#FFE4E4] text-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
              ✅
            </div>
            <div className="font-bold text-xs text-dash-ink">Approvals Queue</div>
            <div className="text-[10px] text-dash-ink-soft mt-0.5">
              {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Waiting` : 'Verified'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. TWO-COLUMN ANALYTICS & DISTRIBUTION HUB               */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMN 1: MANOLO FORTICH 22 BARANGAYS MATRIX */}
        <div className="bg-white rounded-3xl p-6 border border-card-border shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-card-border mb-3">
              <div>
                <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                  📍 Manolo Fortich Barangay Coverage
                </h4>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  {activeBarangayCount} of 22 Barangays currently connected ({coveragePercent}%)
                </p>
              </div>

              <input
                type="text"
                placeholder="🔍 Find barangay..."
                value={barangaySearch}
                onChange={(e) => setBarangaySearch(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent w-36"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredBarangays.map((b) => {
                const count = barangayCounts[b] || 0;
                const isActive = count > 0;

                return (
                  <div
                    key={b}
                    onClick={() => onTabChange('users')}
                    className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-[#F4F9F5] border-[#D4EAD7] text-[#2C5E35] font-bold hover:shadow-xs'
                        : 'bg-[#FAF7F0] border-[#EFE7D8] text-dash-ink-soft hover:bg-white'
                    }`}
                    title={`${b}: ${count} registered users/learners`}
                  >
                    <span className="truncate mr-1 text-[11px]">{b}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                        isActive ? 'bg-[#3D7048] text-white' : 'bg-[#E5DAC4] text-dash-ink'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-card-border flex items-center justify-between text-xs text-dash-ink-soft">
            <span>🟢 Green indicates active barangays with verified accounts</span>
            <button
              onClick={() => onTabChange('users')}
              className="text-accent font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              Filter in Users Tab →
            </button>
          </div>
        </div>

        {/* COLUMN 2: MEDIA FORMATS & CURRICULUM CLOUD */}
        <div className="bg-white rounded-3xl p-6 border border-card-border shadow-card flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-card-border mb-3">
              <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                📚 Curriculum & Media Formats
              </h4>
              <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                Distribution of educational resources accessible by parents and teachers
              </p>
            </div>

            {/* Media Formats Bar breakdown */}
            <div className="space-y-2.5 mb-5">
              <div>
                <div className="flex justify-between text-xs font-bold text-dash-ink mb-1">
                  <span className="flex items-center gap-1">🎬 Videos & Interactive Animations</span>
                  <span>
                    {mediaCounts.video} ({Math.round((mediaCounts.video / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-coral h-full rounded-full transition-all"
                    style={{ width: `${(mediaCounts.video / totalMedia) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-dash-ink mb-1">
                  <span className="flex items-center gap-1">📖 Storybooks & PDF Worksheets</span>
                  <span>
                    {mediaCounts.pdf} ({Math.round((mediaCounts.pdf / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all"
                    style={{ width: `${(mediaCounts.pdf / totalMedia) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-dash-ink mb-1">
                  <span className="flex items-center gap-1">🗂️ Interactive Flashcards</span>
                  <span>
                    {mediaCounts.flashcard} (
                    {Math.round((mediaCounts.flashcard / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gold h-full rounded-full transition-all"
                    style={{ width: `${(mediaCounts.flashcard / totalMedia) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-dash-ink mb-1">
                  <span className="flex items-center gap-1">🎵 Songs & Audio Stories</span>
                  <span>
                    {mediaCounts.audio} ({Math.round((mediaCounts.audio / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-leaf h-full rounded-full transition-all"
                    style={{ width: `${(mediaCounts.audio / totalMedia) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Curriculum Subject Badges */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider block mb-2">
                Active Learning Subjects ({categories.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onTabChange('categories')}
                    className="px-2.5 py-1 rounded-xl bg-[#FAF5EB] hover:bg-[#F2E7D3] border border-[#E8DEC9] text-xs font-bold text-dash-ink transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{c.icon || '📁'}</span>
                    <span>{c.name}</span>
                    <span className="text-[10px] bg-white px-1.5 py-0.2 rounded-full text-dash-ink-soft">
                      {categoryCounts[c.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-card-border flex items-center justify-between text-xs">
            <span className="text-dash-ink-soft">Browse and manage content assets</span>
            <button
              onClick={() => onTabChange('materials')}
              className="text-accent font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              Open Materials →
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. ECCD GUIDELINES & MUNICIPAL CARE BULLETIN              */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-[#FFFDF7] to-[#FAF4E6] rounded-2xl p-4 sm:p-5 border border-[#EDE1C7] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="text-3xl">🌱</div>
          <div>
            <div className="font-fraunces font-bold text-sm text-dash-ink">
              ECCD Early Childhood Care & Development Principle
            </div>
            <p className="text-xs text-dash-ink-soft m-0 mt-0.5 leading-relaxed">
              "Children aged 3–4 learn best through responsive play, colorful visual storytelling,
              and guided parent-teacher partnership."
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] font-bold text-[#8A6420] bg-sun/40 px-3 py-1 rounded-full border border-sun/60 inline-block">
            EarlyLearn Hub • Manolo Fortich
          </span>
        </div>
      </div>
    </div>
  );
}
