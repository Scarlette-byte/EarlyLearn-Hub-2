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
    <div className="min-h-screen flex flex-col md:flex-row bg-dashbg font-nunito text-dash-ink">
      {/* Mobile top bar with menu toggle */}
      <div className="md:hidden flex items-center justify-between bg-sidebar text-gold px-4 py-3">
        <div className="flex items-center gap-2 font-fraunces font-bold text-[15px]">
          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
            isSuperAdmin ? 'bg-purple-500/20 border border-purple-400/40 text-[#E0C6FF]' : 'bg-gold/20 border border-gold/40 text-gold'
          }`}>
            {isSuperAdmin ? 'S' : 'E'}
          </span>
          EarlyLearn <span className="text-sidebar-text font-nunito text-[10px] uppercase tracking-wider">{logoSubtitle}</span>
        </div>
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          className="text-sidebar-text text-2xl leading-none px-2"
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`${
          mobileNavOpen ? 'flex' : 'hidden'
        } md:flex w-full md:w-[220px] bg-sidebar text-sidebar-text p-[26px_18px] flex-col gap-1.5 flex-shrink-0 relative overflow-hidden`}
      >
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background: isSuperAdmin
              ? 'radial-gradient(circle, rgba(147,51,234,0.3), transparent 70%)'
              : 'radial-gradient(circle, rgba(201,120,74,0.33), transparent 70%)',
          }}
        />
        <div className="hidden md:flex items-center gap-2.5 mb-6 px-1.5 relative z-10">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-fraunces ${
            isSuperAdmin ? 'bg-purple-500/20 border border-purple-400/40 text-[#E0C6FF]' : 'bg-gold/20 border border-gold/40 text-gold'
          }`}>
            {isSuperAdmin ? 'SA' : 'EL'}
          </div>
          <div>
            <div className="font-fraunces text-[17px] font-bold text-gold leading-tight">EarlyLearn</div>
            <small className="block font-nunito text-[10px] font-semibold text-[#A99A82] tracking-wider uppercase">
              {logoSubtitle}
            </small>
          </div>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              onTabChange(tab.key);
              setMobileNavOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-[13.5px] font-bold cursor-pointer border-none text-left font-nunito relative z-10 transition-colors ${
              activeTab === tab.key
                ? 'bg-accent text-[#FFF9F0]'
                : 'bg-transparent text-sidebar-text hover:bg-white/[0.06]'
            }`}
          >
            <span className="shrink-0">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="mt-auto md:mt-auto py-2.5 px-3.5 rounded-[10px] bg-transparent border border-[#5A4C3B] text-sidebar-text cursor-pointer text-xs font-bold relative z-10 hover:bg-white/[0.06] transition-colors"
        >
          Log Out
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 p-5 sm:p-8 md:p-[32px_38px] overflow-y-auto">
        <div className="flex justify-between items-start mb-6 gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-fraunces text-xl sm:text-2xl font-bold m-0 text-dash-ink">{title}</h1>
              {roleBadge && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide bg-[#EDE4FF] text-[#5A2E9E] border border-[#D5C2F8] shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7A3EE6] animate-pulse" />
                  {roleBadge}
                </span>
              )}
            </div>
            <p className="text-dash-ink-soft text-xs mt-1 tracking-wide">{subtitle}</p>
          </div>
          <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            isSuperAdmin
              ? 'bg-[#EDE4FF] border border-[#D5C2F8] text-[#5A2E9E]'
              : 'bg-[#FAF3E6] border border-[#E5DAC4] text-[#8A6420]'
          }`}>
            {typeof avatar === 'string' && avatar.length <= 2 ? avatar : (isSuperAdmin ? 'SA' : 'AD')}
          </div>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-3 mb-7">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex-1 min-w-[140px] bg-white rounded-[14px] px-[18px] py-4 shadow-card"
              >
                <b className="font-fraunces text-3xl font-bold text-accent block">{s.value}</b>
                <span className="text-[13px] text-dash-ink-soft font-semibold">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
