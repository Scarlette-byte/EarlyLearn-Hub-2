import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * Shared shell for the earthy-tone Admin & Teacher dashboards:
 * dark sidebar with tab nav + logout, topline with title/avatar, stat cards row.
 */
export default function DashboardLayout({
  logoSubtitle,
  tabs, // [{ key, label, icon }]
  title,
  subtitle,
  avatar,
  roleBadge,
  isSuperAdmin,
  stats, // [{ label, value }]
  activeTab,
  onTabChange,
  children,
}) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] font-nunito text-slate-900">
      {/* Mobile top bar with menu toggle */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
            {isSuperAdmin ? 'SA' : 'MF'}
          </span>
          <span>MSWDO EarlyLearn</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">({logoSubtitle})</span>
        </div>
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          className="text-slate-300 hover:text-white text-xl p-1"
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`${
          mobileNavOpen ? 'flex' : 'hidden'
        } md:flex w-full md:w-[240px] bg-[#0F172A] text-slate-300 p-5 flex-col gap-1 flex-shrink-0 border-r border-slate-800`}
      >
        <div className="hidden md:flex items-center gap-3 mb-6 px-1 border-b border-slate-800/80 pb-5">
          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
            {isSuperAdmin ? 'SA' : 'MF'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white uppercase tracking-wider truncate">MSWDO PORTAL</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">LGU Manolo Fortich</div>
          </div>
        </div>

        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
          Navigation
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              onTabChange(tab.key);
              setMobileNavOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer border-none text-left transition-colors ${
              activeTab === tab.key
                ? 'bg-slate-800 text-white font-semibold border-l-3 border-amber-400 shadow-2xs'
                : 'bg-transparent text-slate-300 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <span className="shrink-0 text-slate-400">{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
          </button>
        ))}

        <div className="mt-auto pt-6 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white cursor-pointer text-xs font-medium transition-colors text-center"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-5 sm:p-7 md:p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold m-0 text-slate-900 tracking-tight">{title}</h1>
              {roleBadge && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {roleBadge}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">MSWDO Manolo Fortich</div>
              <div className="text-[11px] text-slate-500">Bukidnon, Region X</div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
              {typeof avatar === 'string' && avatar.length <= 2 ? avatar : (isSuperAdmin ? 'SA' : 'AD')}
            </div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs"
              >
                <div className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
