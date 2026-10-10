import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getEffectiveRole, isSuperAdminUser } from '../lib/roles.js';

/**
 * Wraps a dashboard page and guarantees:
 *  1. The visitor is logged in (else -> /login)
 *  2. The visitor's effective role is one of `allowedRoles` (else -> /login)
 *     Superadmins automatically inherit administrative access.
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
        .select('role, full_name, barangay')
        .eq('id', user.id)
        .single();

      if (!active) return;

      const userProfilePayload = {
        ...(prof || {}),
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      };

      const effectiveRole = getEffectiveRole(userProfilePayload);
      const isSuperAdmin = isSuperAdminUser(userProfilePayload);

      // Superadmins are authorized if 'superadmin' is explicitly allowed,
      // or if 'admin' is in allowedRoles (inherits admin access).
      const isAuthorized =
        allowedRoles.includes(effectiveRole) ||
        (isSuperAdmin && (allowedRoles.includes('admin') || allowedRoles.includes('superadmin')));

      if (!prof && !isSuperAdmin) {
        setStatus('denied');
        return;
      }

      if (!isAuthorized) {
        setStatus('denied');
        return;
      }

      setProfile({
        ...(prof || {
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrator',
          barangay: user.user_metadata?.barangay || null,
        }),
        id: user.id,
        email: user.email,
        role: effectiveRole,
        isSuperAdmin,
      });
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
