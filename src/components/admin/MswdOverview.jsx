export default function MswdOverview({
  profile,
  learnersCount = 0,
  cdcsCount = 0,
  teachersCount = 0,
  pendingVerificationCount = 0,
  assessmentsCount = 0,
  onNavigateTab,
}) {
  const isSuperAdmin = profile?.role === 'superadmin' || profile?.isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#FAF5EC] via-[#FFFDF8] to-[#FFF8EE] p-6 sm:p-7 rounded-3xl border border-card-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE4D6] text-accent text-xs font-bold">
            <span>🏛️</span>
            <span>
              {isSuperAdmin
                ? 'Municipal System Administration & Governance • Manolo Fortich, Bukidnon'
                : 'Municipal Social Welfare and Development Office • Manolo Fortich, Bukidnon'}
            </span>
          </div>
          <h2 className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink m-0">
            {isSuperAdmin
              ? `Welcome, ${profile?.full_name || 'Municipal Super Administrator'}`
              : `Welcome, ${profile?.full_name || 'MSWD ECCD Administrator'}`}
          </h2>
          <p className="text-xs sm:text-sm text-dash-ink-soft leading-relaxed m-0">
            {isSuperAdmin
              ? 'Comprehensive governance authority over Early Childhood Care & Development (ECCD), Daycare Center monitoring, educator accreditation, and municipal user access control.'
              : 'Managing early childhood care, daycare center operations, and developmental milestones for children aged 3 to 4 years old across all 22 barangays of our municipality.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {isSuperAdmin && (
            <button
              onClick={() => onNavigateTab('users')}
              className="px-4 py-2.5 rounded-xl bg-[#5A2E9E] hover:bg-[#472280] text-white font-bold text-xs shadow-xs transition-colors"
            >
              Manage Users
            </button>
          )}
          <button
            onClick={() => onNavigateTab('children')}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors"
          >
            Verify Child Records
          </button>
          <button
            onClick={() => onNavigateTab('reports')}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#D5C7B0] hover:bg-[#FAF5EC] text-dash-ink font-bold text-xs shadow-xs transition-colors"
          >
            Generate Report
          </button>
        </div>
      </div>

      {/* 5 Core MSWD Functions Navigation Grid */}
      <div className="space-y-3">
        <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
          Specific Core Functions of MSWD in EarlyLearnHub
        </h3>
        <p className="text-xs text-dash-ink-soft m-0">
          Select any core operational module below to manage municipal day care services and compliance:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {/* Function 1 */}
          <div
            onClick={() => onNavigateTab('children')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FFE4D6] text-accent flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🧒
              </span>
              <span className="text-[11px] font-bold text-accent bg-[#FFF5EE] px-2 py-0.5 rounded-full">
                Core Function 1
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-accent transition-colors">
              Child Records Management
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              View, verify, and update children's profiles (Pre-K 1: 3.11 y/o &amp; Pre-K 2: 4.11 y/o), guardian details, enrollment status, and daycare center matching.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-accent">
              <span>{learnersCount} Total Records ({pendingVerificationCount} Pending)</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 2 */}
          <div
            onClick={() => onNavigateTab('centers')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#E0EFFE] text-[#1E5B94] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🏫
              </span>
              <span className="text-[11px] font-bold text-[#1E5B94] bg-[#F0F7FF] px-2 py-0.5 rounded-full">
                Core Function 2
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#1E5B94] transition-colors">
              Daycare Center Monitoring
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              View each daycare center’s registered toddlers, daycare workers, capacity limits, and monthly attendance summaries.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#1E5B94]">
              <span>{cdcsCount} Centers Across 22 Barangays</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 3 */}
          <div
            onClick={() => onNavigateTab('development')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#DCEBDD] text-[#2E6B38] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                📈
              </span>
              <span className="text-[11px] font-bold text-[#2E6B38] bg-[#F2F8F3] px-2 py-0.5 rounded-full">
                Core Function 3
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#2E6B38] transition-colors">
              Child Development Monitoring
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Review toddler assessments across cognitive, physical, social-emotional, and language developmental domains submitted by workers.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#2E6B38]">
              <span>{assessmentsCount} Assessments Recorded</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 4 */}
          <div
            onClick={() => onNavigateTab('reports')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FFF3D6] text-[#8C6200] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                📄
              </span>
              <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFFBF0] px-2 py-0.5 rounded-full">
                Core Function 4
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#8C6200] transition-colors">
              Reports Generation
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Generate and download monthly or yearly reports on child enrollment, attendance, developmental progress, and performance in CSV/PDF.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#8C6200]">
              <span>4 Exportable Formats</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Function 5 */}
          <div
            onClick={() => onNavigateTab('programs')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#E8DEF8] text-[#553C9A] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                📋
              </span>
              <span className="text-[11px] font-bold text-[#553C9A] bg-[#F7F4FD] px-2 py-0.5 rounded-full">
                Core Function 5
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-[#553C9A] transition-colors">
              Activity &amp; Module Monitoring
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Monitor learning modules uploaded by Child Development Teachers, verify weekly curriculum activity submissions, and review CDC compliance.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#553C9A]">
              <span>Active Teacher Uploads</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Curriculum Guides Quick Link */}
          <div
            onClick={() => onNavigateTab('curriculum')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FFF9CC] text-[#8C6200] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🌱
              </span>
              <span className="text-[11px] font-bold text-[#8C6200] bg-[#FFFBF0] px-2 py-0.5 rounded-full">
                Curriculum
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-accent transition-colors">
              Curriculum Guides
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Official DepEd/ECCD Pre-K1 &amp; Pre-K2 themes and sub-themes that can be assigned directly to teachers across CDCs.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-accent">
              <span>Pre-K1 &amp; Pre-K2 Matrices</span>
              <span>Open →</span>
            </div>
          </div>

          {/* Teacher Roster Quick Link */}
          <div
            onClick={() => onNavigateTab('teachers')}
            className="bg-white p-5 rounded-2xl border border-card-border shadow-xs hover:border-accent hover:shadow-card transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-[#FAF5EC] text-dash-ink flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                👩‍🏫
              </span>
              <span className="text-[11px] font-bold text-dash-ink bg-[#FAF5EC] px-2 py-0.5 rounded-full">
                Personnel
              </span>
            </div>
            <h4 className="font-fraunces text-base font-bold text-dash-ink group-hover:text-accent transition-colors">
              Manage Teachers
            </h4>
            <p className="text-xs text-dash-ink-soft leading-relaxed">
              Manage Child Development Teachers (CDTs and Aides), view their assigned Barangay and CDC center, and manage credentials.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-accent">
              <span>{teachersCount} Registered Teachers</span>
              <span>Open →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
