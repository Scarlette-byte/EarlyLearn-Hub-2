import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * Wraps a dashboard page and guarantees:
 *  1. The visitor is logged in (else -> /login)
 *  2. The visitor's profile.role is one of `allowedRoles` (else -> /login)
 *
 * Mirrors the checkAdminAccess() / checkTeacherAccess() / checkStudentAccess()
 * functions from the original static pages.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | denied | anon
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setStatus('anon');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (!prof || !allowedRoles.includes(prof.role)) {
        setStatus('denied');
        return;
      }

      setProfile({ ...prof, id: user.id });
      setStatus('ok');
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashbg text-dash-ink-soft font-nunito text-sm">
        Loading...
      </div>
    );
  }

  if (status === 'anon') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'denied') {
    alert('You do not have access to this page. Redirecting to login.');
    return <Navigate to="/login" replace />;
  }

  return children(profile);
}
