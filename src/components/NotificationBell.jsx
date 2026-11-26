import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icons.jsx';

/**
 * NotificationBell: displays unread count badge, dropdown panel,
 * mark-read / mark-all-read actions, and Realtime updates filtered by user_id.
 * Styled to match the unified MSWDO EarlyLearn Hub design system.
 */
export default function NotificationBell({ userId, dark = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, link, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (active && Array.isArray(data)) setItems(data);
    }

    load();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new) {
            setItems((prev) => [payload.new, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  async function markRead(n) {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, read_at: now } : item)));
      await supabase.from('notifications').update({ read_at: now }).eq('id', n.id);
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => (item.read_at ? item : { ...item, read_at: now })));
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
          dark
            ? 'bg-white/10 hover:bg-white/15 border border-white/15 text-white'
            : 'bg-ui-surface-subtle hover:bg-ui-surface-warm border border-ui-border text-ui-ink'
        }`}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-coral-deep text-white text-[10px] font-extrabold flex items-center justify-center shadow-2xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-96 overflow-y-auto rounded-2xl bg-ui-surface border border-ui-border shadow-auth-card z-50 p-3 text-ui-ink animate-ui-fade-up">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-ui-border">
            <div className="flex items-center gap-1.5">
              <Icon name="bell" size={15} className="text-brand-leaf-deep" />
              <span className="font-baloo font-extrabold text-sm text-ui-ink">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-extrabold text-brand-leaf-deep hover:underline bg-transparent border-none cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <div className="w-9 h-9 rounded-xl bg-ui-surface-warm text-ui-ink-muted flex items-center justify-center mx-auto">
                <Icon name="inbox" size={18} />
              </div>
              <p className="text-xs font-semibold text-ui-ink-muted m-0">No notifications yet.</p>
            </div>
          ) : (
            <ul className="space-y-1.5 m-0 p-0 list-none">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => markRead(n)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer min-w-0 ${
                      n.read_at
                        ? 'bg-ui-surface border-transparent hover:bg-ui-surface-subtle'
                        : 'bg-brand-yellow-tint/70 border-brand-yellow/50 hover:bg-brand-yellow-tint'
                    }`}
                  >
                    <div className="font-bold text-xs text-ui-ink break-words">{n.title}</div>
                    {n.body && (
                      <div className="text-[11px] text-ui-ink-secondary mt-0.5 break-words leading-snug">
                        {n.body}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
