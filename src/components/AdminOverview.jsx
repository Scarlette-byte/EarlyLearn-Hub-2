import { useState } from 'react';
import { barangays } from '../lib/supabaseClient';
import {
  IconUsers,
  IconTeachers,
  IconLearners,
  IconMaterials,
  IconApprovals,
  IconSearch,
  IconPlus,
  IconPin,
  IconCalendar,
  IconCheck,
  IconClose,
  IconArrowRight,
  IconVideo,
  IconBook,
  IconMusic,
  IconLayers,
  IconCategories,
} from './Icons.jsx';

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

  // Calculations
  const totalUsers = profiles.length;
  const adminCount = profiles.filter((p) => p.role === 'admin' || p.role === 'superadmin').length;
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

  // Barangay counts
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

  // Media counts
  const mediaCounts = {
    video: materials.filter((m) => m.type === 'video').length,
    pdf: materials.filter((m) => m.type === 'pdf').length,
    flashcard: materials.filter((m) => m.type === 'flashcard').length,
    audio: materials.filter((m) => m.type === 'audio').length,
  };
  const totalMedia = materials.length || 1;

  // Category counts
  const categoryCounts = {};
  categories.forEach((c) => {
    categoryCounts[c.id] = materials.filter(
      (m) => m.category_id === c.id || m.categories?.name === c.name
    ).length;
  });

  // Filtered barangays
  const filteredBarangays = barangays.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------- */}
      {/* 1. CLEAN EXECUTIVE HERO BANNER                            */}
      {/* --------------------------------------------------------- */}
      <div className="bg-white border border-[#E8DFD1] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAF5EC] border border-[#E5DAC4] text-[11px] font-semibold text-[#6E5D43] mb-2.5">
              <span>Municipality of Manolo Fortich</span>
              <span className="text-[#BDB099]">•</span>
              <span>Early Childhood Care & Development (ECCD)</span>
            </div>

            <h2 className="font-fraunces text-2xl font-bold text-dash-ink tracking-tight m-0">
              Welcome back, {profile?.full_name || 'Administrator'}
            </h2>

            <p className="text-xs text-dash-ink-soft mt-1.5 max-w-2xl leading-relaxed m-0">
              Centralized administrative dashboard for supervising daycare educators, early learners,
              and educational curriculum materials across the 22 barangays.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-medium text-dash-ink-soft">
              <span className="inline-flex items-center gap-1.5 bg-[#FAF7F0] px-2.5 py-1 rounded-md border border-[#ECE3D2]">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                System Operational
              </span>
              <span className="inline-flex items-center gap-1.5 bg-[#FAF7F0] px-2.5 py-1 rounded-md border border-[#ECE3D2]">
                <IconCalendar className="w-3.5 h-3.5 text-dash-ink-soft" />
                {formattedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-[#FAF7F0] px-2.5 py-1 rounded-md border border-[#ECE3D2]">
                <IconPin className="w-3.5 h-3.5 text-dash-ink-soft" />
                Manolo Fortich, Bukidnon
              </span>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
            <button
              onClick={() => onTabChange('users')}
              className="px-3.5 py-2 rounded-xl bg-accent hover:opacity-90 text-white font-nunito font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <IconUsers className="w-4 h-4" />
              <span>Manage Users ({totalUsers})</span>
            </button>

            <button
              onClick={() => onTabChange('approvals')}
              className={`px-3.5 py-2 rounded-xl font-nunito font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                pendingApprovalsCount > 0
                  ? 'bg-danger text-white hover:bg-danger/90 shadow-xs'
                  : 'bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink border border-[#E5DAC4]'
              }`}
            >
              <IconApprovals className="w-4 h-4" />
              <span>
                {pendingApprovalsCount > 0
                  ? `${pendingApprovalsCount} Pending Review`
                  : 'Approvals Queue (0)'}
              </span>
            </button>

            <button
              onClick={() => onTabChange('learners')}
              className="px-3.5 py-2 rounded-xl bg-[#FAF5EC] hover:bg-[#F2E8D5] text-dash-ink font-nunito font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-[#E5DAC4] cursor-pointer"
            >
              <IconLearners className="w-4 h-4" />
              <span>Learners Registry ({learnerCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- */}
      {/* 2. REFINED 6-CARD METRICS GRID                            */}
      {/* --------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-fraunces text-base font-bold text-dash-ink m-0">
            Overview Metrics
          </h3>
          <span className="text-xs text-dash-ink-soft">Live system metrics</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Total Users */}
          <div
            onClick={() => onTabChange('users')}
            className="bg-white rounded-xl p-5 border border-card-border shadow-xs hover:border-[#D9CDB7] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#8A6420] uppercase tracking-wider block">
                  Total Accounts
                </span>
                <span className="font-fraunces text-3xl font-bold text-dash-ink block mt-1">
                  {totalUsers}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#FAF3E6] text-[#8A6420] flex items-center justify-center">
                <IconUsers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#F5EDE0] flex items-center justify-between text-xs text-dash-ink-soft">
              <span>{adminCount} Admins • {teacherCount} Teachers • {learnerCount} Learners</span>
              <span className="text-accent font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View <IconArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 2: Teachers */}
          <div
            onClick={() => onTabChange('teachers')}
            className="bg-white rounded-xl p-5 border border-card-border shadow-xs hover:border-[#C8DEC9] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#2E6B39] uppercase tracking-wider block">
                  Child Dev Workers
                </span>
                <span className="font-fraunces text-3xl font-bold text-dash-ink block mt-1">
                  {teacherCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#EDF6EE] text-[#2E6B39] flex items-center justify-center">
                <IconTeachers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#EDF6EE] flex items-center justify-between text-xs text-dash-ink-soft">
              <span>{cdcs.length > 0 ? `${cdcs.length} CDC Centers Assigned` : 'Accredited Teachers'}</span>
              <span className="text-[#2E6B39] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View <IconArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 3: Learners */}
          <div
            onClick={() => onTabChange('learners')}
            className="bg-white rounded-xl p-5 border border-card-border shadow-xs hover:border-[#CADFF0] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#2A5E85] uppercase tracking-wider block">
                  Enrolled Learners
                </span>
                <span className="font-fraunces text-3xl font-bold text-dash-ink block mt-1">
                  {learnerCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#EBF4FA] text-[#2A5E85] flex items-center justify-center">
                <IconLearners className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#EBF4FA] flex items-center justify-between text-xs text-dash-ink-soft">
              <span>Ages 3–4 with Parent Profiles</span>
              <span className="text-[#2A5E85] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View <IconArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 4: Materials */}
          <div
            onClick={() => onTabChange('materials')}
            className="bg-white rounded-xl p-5 border border-card-border shadow-xs hover:border-[#E8CEBE] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider block">
                  Learning Content
                </span>
                <span className="font-fraunces text-3xl font-bold text-dash-ink block mt-1">
                  {approvedMaterialsCount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#FAF0E8] text-accent flex items-center justify-center">
                <IconMaterials className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#FAF0E8] flex items-center justify-between text-xs text-dash-ink-soft">
              <span>{materials.length} Total Uploads • {categories.length} Categories</span>
              <span className="text-accent font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View <IconArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 5: Approvals Queue */}
          <div
            onClick={() => onTabChange('approvals')}
            className={`bg-white rounded-xl p-5 border shadow-xs transition-all cursor-pointer group ${
              pendingApprovalsCount > 0
                ? 'border-danger/30 hover:border-danger/50'
                : 'border-card-border hover:border-[#D9CDB7]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block ${
                    pendingApprovalsCount > 0 ? 'text-danger' : 'text-[#2E6B39]'
                  }`}
                >
                  Pending Approvals
                </span>
                <span
                  className={`font-fraunces text-3xl font-bold block mt-1 ${
                    pendingApprovalsCount > 0 ? 'text-danger' : 'text-dash-ink'
                  }`}
                >
                  {pendingApprovalsCount}
                </span>
              </div>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  pendingApprovalsCount > 0
                    ? 'bg-danger/10 text-danger'
                    : 'bg-[#EDF6EE] text-[#2E6B39]'
                }`}
              >
                <IconApprovals className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#F5EDE0] flex items-center justify-between text-xs text-dash-ink-soft">
              <span>
                {pendingApprovalsCount > 0 ? 'Teacher submissions need review' : 'All submissions verified'}
              </span>
              <span
                className={`font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 ${
                  pendingApprovalsCount > 0 ? 'text-danger' : 'text-[#2E6B39]'
                }`}
              >
                Review <IconArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 6: Municipal Coverage */}
          <div
            onClick={() => onTabChange('users')}
            className="bg-white rounded-xl p-5 border border-card-border shadow-xs hover:border-[#D5CBE5] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#55369A] uppercase tracking-wider block">
                  Barangay Coverage
                </span>
                <span className="font-fraunces text-3xl font-bold text-dash-ink block mt-1">
                  {activeBarangayCount} <span className="text-base font-normal text-dash-ink-soft">/ 22</span>
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#F3EEFA] text-[#55369A] flex items-center justify-center">
                <IconPin className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="w-full bg-[#F3EEFA] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#55369A] h-full rounded-full transition-all duration-500"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-[#F3EEFA] flex items-center justify-between text-xs text-dash-ink-soft">
              <span>{coveragePercent}% of Municipality</span>
              <span className="text-[#55369A] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View <IconArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- */}
      {/* 3. PENDING REVIEW ALERT BLOCK (IF ITEMS EXIST)            */}
      {/* --------------------------------------------------------- */}
      {pendingApprovalsCount > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-danger/25 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F5EDE0] mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <IconApprovals className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                  Submissions Requiring Verification ({pendingApprovalsCount})
                </h4>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  New teacher uploads must be approved before appearing in the student curriculum catalog.
                </p>
              </div>
            </div>

            <button
              onClick={() => onTabChange('approvals')}
              className="text-xs font-bold text-danger hover:underline bg-transparent border-none cursor-pointer self-start sm:self-center"
            >
              Open Approvals Queue →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {approvals.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-[#FAF8F5] rounded-xl p-4 border border-[#EFE7D8] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-[#E8DFC9] text-[#6E5D43]">
                      {item.categories?.name || 'Curriculum'}
                    </span>
                    <span className="text-[11px] font-mono text-dash-ink-soft uppercase font-semibold">
                      {item.type}
                    </span>
                  </div>
                  <h5 className="font-bold text-sm text-dash-ink m-0 line-clamp-1">{item.title}</h5>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-[#ECE3D2]">
                  <button
                    onClick={() => decideApproval && decideApproval(item.id, 'approved')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decideApproval && decideApproval(item.id, 'rejected')}
                    className="py-1.5 px-3 rounded-lg bg-white hover:bg-danger/10 text-danger border border-danger/20 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 4. MANAGEMENT MODULE QUICK ACCESS                         */}
      {/* --------------------------------------------------------- */}
      <div>
        <h3 className="font-fraunces text-base font-bold text-dash-ink mb-3 px-1">
          Administration Modules
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => onTabChange('users')}
            className="bg-white hover:bg-[#FAF7F0] p-4 rounded-xl border border-card-border shadow-xs transition-colors text-center cursor-pointer group"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#FAF3E6] text-[#8A6420] flex items-center justify-center mb-2.5">
              <IconUsers className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-dash-ink">Users</div>
            <div className="text-[11px] text-dash-ink-soft mt-0.5">Accounts & Roles</div>
          </div>

          <div
            onClick={() => onTabChange('teachers')}
            className="bg-white hover:bg-[#FAF7F0] p-4 rounded-xl border border-card-border shadow-xs transition-colors text-center cursor-pointer group"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#EDF6EE] text-[#2E6B39] flex items-center justify-center mb-2.5">
              <IconTeachers className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-dash-ink">Teachers</div>
            <div className="text-[11px] text-dash-ink-soft mt-0.5">Centers & CDWs</div>
          </div>

          <div
            onClick={() => onTabChange('learners')}
            className="bg-white hover:bg-[#FAF7F0] p-4 rounded-xl border border-card-border shadow-xs transition-colors text-center cursor-pointer group"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#EBF4FA] text-[#2A5E85] flex items-center justify-center mb-2.5">
              <IconLearners className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-dash-ink">Learners</div>
            <div className="text-[11px] text-dash-ink-soft mt-0.5">Enrollment records</div>
          </div>

          <div
            onClick={() => onTabChange('categories')}
            className="bg-white hover:bg-[#FAF7F0] p-4 rounded-xl border border-card-border shadow-xs transition-colors text-center cursor-pointer group"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#FAF0E8] text-accent flex items-center justify-center mb-2.5">
              <IconCategories className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-dash-ink">Categories</div>
            <div className="text-[11px] text-dash-ink-soft mt-0.5">Curriculum subjects</div>
          </div>

          <div
            onClick={() => onTabChange('materials')}
            className="bg-white hover:bg-[#FAF7F0] p-4 rounded-xl border border-card-border shadow-xs transition-colors text-center cursor-pointer group"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#FAF0E8] text-accent flex items-center justify-center mb-2.5">
              <IconMaterials className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-dash-ink">Materials</div>
            <div className="text-[11px] text-dash-ink-soft mt-0.5">Content repository</div>
          </div>

          <div
            onClick={() => onTabChange('approvals')}
            className="bg-white hover:bg-[#FAF7F0] p-4 rounded-xl border border-card-border shadow-xs transition-colors text-center cursor-pointer group"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#F3EEFA] text-[#55369A] flex items-center justify-center mb-2.5">
              <IconApprovals className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-dash-ink">Approvals</div>
            <div className="text-[11px] text-dash-ink-soft mt-0.5">
              {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Pending` : 'Verified'}
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- */}
      {/* 5. TWO-COLUMN ANALYTICS HUB                               */}
      {/* --------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Municipal Barangay Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-card-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE0] mb-3">
              <div>
                <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                  Municipal Barangay Distribution
                </h4>
                <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                  {activeBarangayCount} of 22 Barangays connected ({coveragePercent}%)
                </p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter barangay..."
                  value={barangaySearch}
                  onChange={(e) => setBarangaySearch(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E5DCC9] font-nunito text-xs text-dash-ink bg-[#FFFDF8] outline-none focus:border-accent w-40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredBarangays.map((b) => {
                const count = barangayCounts[b] || 0;
                const isActive = count > 0;

                return (
                  <div
                    key={b}
                    onClick={() => onTabChange('users')}
                    className={`p-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-[#F4F8F4] border-[#D1E5D3] text-[#22572C] font-semibold'
                        : 'bg-[#FAF8F5] border-[#EFE7D8] text-dash-ink-soft hover:bg-white'
                    }`}
                  >
                    <span className="truncate mr-1 text-[11px]">{b}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                        isActive ? 'bg-[#2E6B39] text-white' : 'bg-[#E5DAC4] text-dash-ink'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F5EDE0] flex items-center justify-between text-xs text-dash-ink-soft">
            <span>Indicator shows accounts registered per barangay</span>
            <button
              onClick={() => onTabChange('users')}
              className="text-accent font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              Manage Accounts →
            </button>
          </div>
        </div>

        {/* Column 2: Curriculum & Media Formats */}
        <div className="bg-white rounded-2xl p-6 border border-card-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#F5EDE0] mb-3">
              <h4 className="font-fraunces text-base font-bold text-dash-ink m-0">
                Curriculum Media Formats
              </h4>
              <p className="text-xs text-dash-ink-soft mt-0.5 m-0">
                Resource format distribution across learning levels
              </p>
            </div>

            {/* Media Formats Bar Breakdown */}
            <div className="space-y-3 mb-5">
              <div>
                <div className="flex justify-between text-xs font-semibold text-dash-ink mb-1">
                  <span className="flex items-center gap-1.5">
                    <IconVideo className="w-3.5 h-3.5 text-coral" /> Videos & Animations
                  </span>
                  <span>
                    {mediaCounts.video} ({Math.round((mediaCounts.video / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-coral h-full rounded-full"
                    style={{ width: `${(mediaCounts.video / totalMedia) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-dash-ink mb-1">
                  <span className="flex items-center gap-1.5">
                    <IconBook className="w-3.5 h-3.5 text-accent" /> Storybooks & Worksheets
                  </span>
                  <span>
                    {mediaCounts.pdf} ({Math.round((mediaCounts.pdf / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full"
                    style={{ width: `${(mediaCounts.pdf / totalMedia) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-dash-ink mb-1">
                  <span className="flex items-center gap-1.5">
                    <IconLayers className="w-3.5 h-3.5 text-gold" /> Flashcards & Activities
                  </span>
                  <span>
                    {mediaCounts.flashcard} ({Math.round((mediaCounts.flashcard / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gold h-full rounded-full"
                    style={{ width: `${(mediaCounts.flashcard / totalMedia) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-dash-ink mb-1">
                  <span className="flex items-center gap-1.5">
                    <IconMusic className="w-3.5 h-3.5 text-leaf" /> Nursery Songs & Audio
                  </span>
                  <span>
                    {mediaCounts.audio} ({Math.round((mediaCounts.audio / totalMedia) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#F6F1E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-leaf h-full rounded-full"
                    style={{ width: `${(mediaCounts.audio / totalMedia) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Subject Categories */}
            <div>
              <span className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider block mb-2">
                Active Learning Subjects ({categories.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onTabChange('categories')}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF5EB] hover:bg-[#F2E7D3] border border-[#E8DEC9] text-xs font-semibold text-dash-ink transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] bg-white px-1.5 py-0.2 rounded-full text-dash-ink-soft">
                      {categoryCounts[c.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F5EDE0] flex items-center justify-between text-xs text-dash-ink-soft">
            <span>Manage content files and learning topics</span>
            <button
              onClick={() => onTabChange('materials')}
              className="text-accent font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              Open Materials →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
