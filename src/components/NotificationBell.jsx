import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

/**
 * NotificationBell: displays unread count badge, dropdown panel,
 * mark-read / mark-all-read actions, and Realtime updates filtered by user_id.
 */
export default function NotificationBell({ userId }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-2 rounded-xl bg-white/80 hover:bg-white border border-[#E5DCC9] text-slate-700 cursor-pointer"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-white border border-[#E5DCC9] shadow-xl z-50 p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0EBE0]">
            <span className="font-bold text-xs text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-semibold text-sky-700 hover:underline bg-transparent border-none cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center m-0">No notifications yet.</p>
          ) : (
            <ul className="space-y-1.5 m-0 p-0 list-none">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => markRead(n)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      n.read_at
                        ? 'bg-white border-transparent hover:bg-slate-50'
                        : 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-800">{n.title}</div>
                    {n.body && <div className="text-[11px] text-slate-600 mt-0.5">{n.body}</div>}
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
