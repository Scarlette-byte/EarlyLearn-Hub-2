import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import PineappleLogo from './PineappleLogo.jsx';
import Icon from './Icons.jsx';
import { Badge, StatCard } from './ui/index.js';

const STAT_TONES = ['leaf', 'gold', 'coral', 'info'];
const STAT_ICONS = ['learners', 'school', 'teachers', 'clipboard-check'];

/**
 * Shared shell for Admin & Teacher dashboards matching Login.jsx's Civic Forest + Warm Cream palette:
 * - Deep forest-green sidebar (`bg-ui-panel`) with active brand highlight & subtle pattern
 * - Responsive mobile slide-over drawer with backdrop & Escape support
 * - Topbar with page title, role badge, NotificationBell slot, and interactive User Menu dropdown
 * - KPI StatCards row and subtle reduced-motion-safe tab transition
 */
export default function DashboardLayout({
  logoSubtitle,
  tabs = [], // [{ key, label, icon, badge }]
  title,
  subtitle,
  avatar,
  userName,
  userEmail,
  roleBadge,
  isSuperAdmin,
  notificationSlot,
  headerActions,
  stats, // [{ label, value, sublabel, icon, tone }]
  activeTab,
  onTabChange,
  children,
}) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    function handleEsc(e) {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const resolvedInitials =
    typeof avatar === 'string' && avatar.length <= 3
      ? avatar
      : isSuperAdmin
        ? 'SA'
        : 'AD';

  const renderSidebarContent = () => (
    <>
      {/* Subtle Login-matching dot texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255, 251, 234, 0.85) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-20 w-56 h-56 rounded-full bg-brand-leaf/15 blur-3xl pointer-events-none"
      />

      {/* Brand Header */}
      <div className="relative z-10 flex items-center justify-between gap-2 pb-5 mb-4 border-b border-white/10 min-w-0">
        <PineappleLogo
          variant="horizontal"
          theme="dark"
          size={36}
          subtitle={logoSubtitle ? `${logoSubtitle} • LGU Manolo Fortich` : 'LGU Manolo Fortich'}
        />
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation drawer"
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer bg-transparent border-none shrink-0"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Navigation Section Label */}
      <div className="relative z-10 text-[10.5px] font-extrabold text-ui-panel-muted uppercase tracking-widest px-3 mb-1.5">
        Workspace Modules
      </div>

      {/* Navigation Links */}
      <nav aria-label="Dashboard navigation" className="relative z-10 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                onTabChange(tab.key);
                setMobileNavOpen(false);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`group w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-[13px] cursor-pointer border text-left transition-all min-w-0 ${
                isActive
                  ? 'bg-white/12 text-white font-extrabold border-white/15 shadow-xs'
                  : 'bg-transparent text-white/78 hover:bg-ui-panel-hover hover:text-white font-semibold border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`w-1.5 h-5 rounded-full transition-all shrink-0 ${
                    isActive ? 'bg-brand-yellow' : 'bg-transparent group-hover:bg-white/25'
                  }`}
                />
                <span
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-brand-yellow' : 'text-ui-panel-muted group-hover:text-white'
                  }`}
                >
                  {typeof tab.icon === 'string' ? <Icon name={tab.icon} size={16} /> : tab.icon}
                </span>
                <span className="truncate">{tab.label}</span>
              </div>
              {tab.badge !== undefined && tab.badge !== null && tab.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold shrink-0 ${
                    isActive
                      ? 'bg-brand-yellow text-ui-ink'
                      : 'bg-brand-coral text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Civic Badge & Sign Out */}
      <div className="relative z-10 mt-auto pt-4 border-t border-white/10 space-y-2.5">
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] text-white/80 leading-snug">
          <div className="font-extrabold text-brand-cream flex items-center gap-1.5 truncate">
            <Icon name="landmark" size={13} className="text-brand-yellow shrink-0" />
            <span className="truncate">MSWDO Manolo Fortich</span>
          </div>
          <div className="text-white/65 text-[10.5px] mt-0.5 truncate">
            ECCD Information System • Bukidnon
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2.5 px-3 rounded-xl bg-white/[0.07] hover:bg-brand-coral-deep/90 border border-white/12 hover:border-transparent text-white/90 hover:text-white cursor-pointer text-xs font-extrabold transition-all flex items-center justify-center gap-2"
        >
          <Icon name="logout" size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row bg-ui-bg font-nunito text-ui-ink selection:bg-brand-yellow/40">
      {/* ======================================================= */}
      {/* MOBILE TOP BAR (< md)                                   */}
      {/* ======================================================= */}
      <header className="no-print md:hidden sticky top-0 z-30 flex items-center justify-between bg-ui-panel text-white px-4 py-3 border-b border-ui-panel-deep gap-2 min-w-0 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center shrink-0 cursor-pointer border border-white/10"
          aria-label="Open navigation menu"
        >
          <Icon name="menu" size={19} />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden px-1">
          <PineappleLogo
            variant="horizontal"
            theme="dark"
            size={28}
            subtitle={logoSubtitle || 'LGU Manolo Fortich'}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {notificationSlot}
          <div className="w-8 h-8 rounded-xl bg-brand-yellow text-ui-ink font-baloo font-extrabold text-xs flex items-center justify-center shrink-0">
            {resolvedInitials}
          </div>
        </div>
      </header>

      {/* ======================================================= */}
      {/* MOBILE SLIDE-OVER DRAWER (< md)                         */}
      {/* ======================================================= */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="no-print md:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
              className="fixed inset-0 bg-ui-panel-deep/65 backdrop-blur-[2px]"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={prefersReducedMotion ? { opacity: 0 } : { x: -280 }}
              animate={{ x: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: -280 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-[276px] max-w-[85vw] bg-ui-panel text-white p-5 flex flex-col gap-1 h-full overflow-y-auto shadow-2xl border-r border-white/10"
            >
              {renderSidebarContent()}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================= */}
      {/* DESKTOP FIXED SIDEBAR (md+)                             */}
      {/* ======================================================= */}
      <aside className="no-print hidden md:flex md:w-[248px] lg:w-[264px] shrink-0 bg-ui-panel text-white p-5 flex-col gap-1 border-r border-ui-panel-deep sticky top-0 h-screen overflow-x-hidden">
        {renderSidebarContent()}
      </aside>

      {/* ======================================================= */}
      {/* MAIN CONTENT SHELL                                      */}
      {/* ======================================================= */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar Chrome */}
        <header className="no-print bg-ui-surface/90 backdrop-blur-xs border-b border-ui-border px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-20">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <h1 className="font-baloo text-xl sm:text-2xl font-extrabold m-0 text-ui-ink tracking-tight truncate max-w-full">
                  {title}
                </h1>
                {roleBadge && (
                  <Badge variant={isSuperAdmin ? 'gold' : 'primary'} icon="shield">
                    {roleBadge}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <p className="text-ui-ink-muted text-xs sm:text-[13px] m-0 mt-0.5 truncate max-w-full">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Right Slot: Actions, Notification Bell, and User Menu */}
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              {headerActions}
              <div className="hidden md:block">{notificationSlot}</div>

              {/* User Menu Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-xl bg-ui-surface-subtle hover:bg-ui-surface-warm border border-ui-border transition-colors cursor-pointer"
                >
                  <div className="text-right hidden lg:block min-w-0 max-w-[170px]">
                    <div className="text-xs font-extrabold text-ui-ink truncate">
                      {userName || 'MSWDO Portal'}
                    </div>
                    <div className="text-[10.5px] font-semibold text-ui-ink-muted truncate">
                      {roleBadge || 'Authorized Account'}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-ui-panel text-brand-yellow font-baloo font-extrabold text-xs flex items-center justify-center shrink-0">
                    {resolvedInitials}
                  </div>
                  <Icon
                    name="chevron-down"
                    size={14}
                    className={`text-ui-ink-muted transition-transform ${
                      userMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 rounded-2xl bg-ui-surface border border-ui-border shadow-auth-card z-50 p-2 animate-ui-fade-up"
                  >
                    <div className="px-3 py-2.5 border-b border-ui-border mb-1 min-w-0">
                      <div className="text-xs font-extrabold text-ui-ink truncate">
                        {userName || 'EarlyLearn Hub User'}
                      </div>
                      {userEmail && (
                        <div className="text-[11px] text-ui-ink-muted truncate mt-0.5">
                          {userEmail}
                        </div>
                      )}
                      {roleBadge && (
                        <div className="mt-1.5">
                          <Badge variant={isSuperAdmin ? 'gold' : 'primary'} size="xs">
                            {roleBadge}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold text-status-error hover:bg-status-error-bg transition-colors cursor-pointer bg-transparent border-none text-left"
                    >
                      <Icon name="logout" size={15} />
                      <span>Sign Out of Portal</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {stats && stats.length > 0 && (
            <div
              className={`no-print grid grid-cols-1 sm:grid-cols-2 ${
                stats.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
              } gap-3.5 sm:gap-4 mb-6`}
            >
              {stats.map((s, idx) => (
                <StatCard
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  sublabel={s.sublabel}
                  icon={s.icon || STAT_ICONS[idx % STAT_ICONS.length]}
                  tone={s.tone || STAT_TONES[idx % STAT_TONES.length]}
                  onClick={s.onClick}
                />
              ))}
            </div>
          )}

          <motion.div
            key={activeTab || 'content'}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
