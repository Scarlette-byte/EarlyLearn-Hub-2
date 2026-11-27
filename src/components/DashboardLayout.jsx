import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PineappleLogo from './PineappleLogo.jsx';
import Icon from './Icons.jsx';

const PIN_STORAGE_KEY = 'earlylearn_sidebar_pinned';

/**
 * Shared Supabase-style hover-expand sage sidebar shell for Admin, Superadmin & Teacher dashboards.
 * - Default desktop state: 68px icon rail, expands smoothly to 240px on hover/focus (overlays content).
 * - Optional pin toggle at bottom, persisted in localStorage.
 * - Mobile (<768px): hidden by default; hamburger opens slide-in drawer with backdrop & Esc support.
 */
export default function DashboardLayout({
  logoSubtitle,
  tabs = [], // [{ key, label, icon, group?, badge? }]
  title,
  subtitle,
  avatar,
  roleBadge,
  userName,
  userEmail,
  notificationSlot,
  headerActions,
  isSuperAdmin,
  stats, // [{ label, value }]
  activeTab,
  onTabChange,
  children,
}) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(PIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const collapseTimerRef = useRef(null);

  const isExpanded = pinned || hovered;

  function handleMouseEnter() {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setHovered(true);
  }

  function handleMouseLeave() {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setHovered(false);
    }, 150);
  }

  function togglePin() {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PIN_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const displayInitials =
    typeof avatar === 'string' && avatar.length <= 2
      ? avatar
      : isSuperAdmin
        ? 'SA'
        : 'AD';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-ui-bg font-nunito text-ui-ink">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between bg-ui-panel text-[#1E3F2B] px-4 py-3 border-b border-[#1E3F2B]/15 gap-2 min-w-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <PineappleLogo
            variant="horizontal"
            theme="light"
            size={28}
            subtitle={logoSubtitle ? `${logoSubtitle} • LGU Manolo Fortich` : 'LGU Manolo Fortich'}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {notificationSlot}
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="text-[#1E3F2B] hover:bg-white/40 rounded-full p-2 shrink-0 cursor-pointer border-none bg-transparent"
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <Icon name="close" size={20} /> : <Icon name="menu" size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
          aria-hidden="true"
        />
      )}

      {/* Desktop Hover-Expand Sidebar + Mobile Slide-In Drawer */}
      <aside
        aria-label="Primary navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-ui-panel text-[#1E3F2B] border-r border-[#1E3F2B]/10 shadow-sm transition-[width,transform] duration-200 ease-out motion-reduce:transition-none overflow-hidden ${
          mobileNavOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full md:translate-x-0'
        } ${isExpanded ? 'md:w-[240px] md:shadow-xl' : 'md:w-[68px]'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3.5 py-4 border-b border-[#1E3F2B]/15 min-h-[68px] shrink-0">
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <PineappleLogo variant="icon" size={34} />
          </div>
          <div
            className={`min-w-0 transition-opacity duration-150 ${
              isExpanded || mobileNavOpen ? 'opacity-100' : 'md:opacity-0 md:pointer-events-none'
            }`}
          >
            <div className="font-extrabold text-sm text-[#1E3F2B] truncate leading-tight">
              EarlyLearn Hub
            </div>
            <div className="text-[11px] font-semibold text-[#1E3F2B]/70 truncate">
              {logoSubtitle || 'LGU Manolo Fortich'}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                title={!isExpanded ? tab.label : undefined}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onTabChange(tab.key);
                  setMobileNavOpen(false);
                }}
                className={`relative w-full flex items-center gap-3 px-2.5 py-2.5 rounded-full text-xs font-semibold cursor-pointer border-none text-left transition-colors ${
                  isActive
                    ? 'bg-[#FAF5EC] text-[#1E3F2B] font-extrabold shadow-xs'
                    : 'bg-transparent text-[#1E3F2B]/80 hover:bg-white/45 hover:text-[#1E3F2B]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#1E3F2B]"
                  />
                )}
                <span className="w-7 h-7 flex items-center justify-center shrink-0 text-[#1E3F2B]">
                  {tab.icon}
                </span>
                <span
                  className={`truncate transition-opacity duration-150 ${
                    isExpanded || mobileNavOpen ? 'opacity-100' : 'md:opacity-0 md:w-0'
                  }`}
                >
                  {tab.label}
                </span>
                {tab.badge ? (
                  <span
                    className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D96B3B] text-white ${
                      isExpanded || mobileNavOpen ? 'opacity-100' : 'md:hidden'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Card + Pin & Sign Out */}
        <div className="mt-auto p-2.5 border-t border-[#1E3F2B]/15 space-y-2 shrink-0">
          {/* Pin / Unpin Toggle (Desktop only) */}
          <button
            type="button"
            onClick={togglePin}
            title={pinned ? 'Unpin sidebar (hover to expand)' : 'Pin sidebar open'}
            aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
            className="hidden md:flex w-full items-center gap-3 px-2.5 py-2 rounded-full text-xs font-semibold text-[#1E3F2B]/75 hover:bg-white/40 hover:text-[#1E3F2B] cursor-pointer border-none bg-transparent transition-colors"
          >
            <span className="w-7 h-7 flex items-center justify-center shrink-0">
              <Icon name={pinned ? 'chevron-left' : 'chevron-right'} size={15} />
            </span>
            <span
              className={`truncate transition-opacity duration-150 ${
                isExpanded ? 'opacity-100' : 'opacity-0 w-0'
              }`}
            >
              {pinned ? 'Collapse sidebar' : 'Pin sidebar'}
            </span>
          </button>

          {/* User Info Row */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-2xl bg-white/35">
            <div className="w-8 h-8 rounded-full bg-[#1E3F2B] text-white flex items-center justify-center text-xs font-extrabold shrink-0">
              {displayInitials}
            </div>
            <div
              className={`min-w-0 flex-1 transition-opacity duration-150 ${
                isExpanded || mobileNavOpen ? 'opacity-100' : 'md:opacity-0 md:w-0 md:hidden'
              }`}
            >
              <div className="text-xs font-bold text-[#1E3F2B] truncate">
                {userName || roleBadge || 'Account'}
              </div>
              {userEmail && (
                <div className="text-[10px] text-[#1E3F2B]/70 truncate">{userEmail}</div>
              )}
            </div>
          </div>

          {/* Sign Out */}
          <button
            type="button"
            onClick={handleLogout}
            title={!isExpanded ? 'Sign Out' : undefined}
            aria-label="Sign Out"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-[#1E3F2B] hover:bg-[#163020] border-none text-white cursor-pointer text-xs font-bold transition-colors shadow-xs"
          >
            <Icon name="logout" size={15} className="shrink-0" />
            <span
              className={`truncate transition-opacity duration-150 ${
                isExpanded || mobileNavOpen ? 'opacity-100' : 'md:hidden'
              }`}
            >
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (Fixed left offset on desktop so hover-expand overlays without layout shift) */}
      <div
        className={`flex-1 min-w-0 bg-ui-bg p-4 sm:p-6 md:p-8 overflow-y-auto transition-[padding-left] duration-200 ease-out motion-reduce:transition-none ${
          pinned ? 'md:pl-[264px]' : 'md:pl-[92px]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-ui-border gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-ui-ink tracking-tight truncate">
                {title}
              </h1>
              {roleBadge && (
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-dash-sage text-[#1E3F2B] border border-[#1E3F2B]/15">
                  {roleBadge}
                </span>
              )}
            </div>
            <p className="text-ui-ink-muted text-xs sm:text-sm mt-1 m-0">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {headerActions}
            <div className="hidden md:flex items-center">{notificationSlot}</div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-ui-ink">MSWDO Manolo Fortich</div>
              <div className="text-[11px] text-ui-ink-muted">Bukidnon, Region X</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#1E3F2B] text-white flex items-center justify-center text-xs font-extrabold shrink-0">
              {displayInitials}
            </div>
          </div>
        </div>

        {/* Stat Cards Row */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-ui-surface rounded-3xl p-5 border border-ui-border shadow-ui-card min-w-0"
              >
                <div className="text-xs font-bold text-ui-ink-muted uppercase tracking-wider truncate">
                  {s.label}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-ui-ink mt-1 truncate">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
