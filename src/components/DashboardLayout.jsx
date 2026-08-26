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
        <div className="font-fraunces font-bold text-[15px]">
          🌻 EarlyLearn <span className="text-sidebar-text font-nunito text-[10px] uppercase tracking-wider">{logoSubtitle}</span>
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
            background: 'radial-gradient(circle, rgba(201,120,74,0.33), transparent 70%)',
          }}
        />
        <div className="hidden md:block font-fraunces text-[17px] font-bold text-gold mb-6 px-1.5 relative z-10">
          🌻 EarlyLearn
          <small className="block font-nunito text-[10px] font-semibold text-[#A99A82] tracking-widest uppercase mt-0.5">
            {logoSubtitle}
          </small>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              onTabChange(tab.key);
              setMobileNavOpen(false);
            }}
            className={`px-3.5 py-2.5 rounded-[10px] text-[13.5px] font-bold cursor-pointer border-none text-left font-nunito relative z-10 ${
              activeTab === tab.key
                ? 'bg-accent text-[#FFF9F0]'
                : 'bg-transparent text-sidebar-text hover:bg-white/[0.06]'
            }`}
          >
            {tab.icon} &nbsp;{tab.label}
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="mt-auto md:mt-auto py-2.5 px-3.5 rounded-[10px] bg-transparent border border-[#5A4C3B] text-sidebar-text cursor-pointer text-xs font-bold relative z-10"
        >
          Log Out
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 p-5 sm:p-8 md:p-[32px_38px] overflow-y-auto">
        <div className="flex justify-between items-start mb-6 gap-3">
          <div>
            <h1 className="font-fraunces text-xl sm:text-2xl font-bold m-0 text-dash-ink">{title}</h1>
            <p className="text-dash-ink-soft text-xs mt-1 tracking-wide">{subtitle}</p>
          </div>
          <div className="w-[38px] h-[38px] rounded-full bg-gold flex items-center justify-center text-base flex-shrink-0">
            {avatar}
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
