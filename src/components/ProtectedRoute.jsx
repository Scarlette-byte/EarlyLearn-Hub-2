import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getEffectiveRole, isSuperAdminUser } from '../lib/roles.js';
import { getStudentApprovalStatus } from '../lib/learnersService.js';

/**
 * Wraps a dashboard page and guarantees:
 *  1. The visitor is logged in (else -> /login)
 *  2. The visitor's effective role is one of `allowedRoles` (else -> /login)
 *     Superadmins automatically inherit administrative access.
 *  3. If the visitor is a Parent/Student ('student'), verifies that their assigned
 *     teacher has approved their registration before allowing access to the child's dashboard.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | ok | pending_approval | rejected_approval | denied | anon
  const [profile, setProfile] = useState(null);
  const [approvalInfo, setApprovalInfo] = useState(null);
  const [rechecking, setRechecking] = useState(false);

  const checkAccess = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus('anon');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const userProfilePayload = {
      ...(prof || {}),
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    };

    const effectiveRole = getEffectiveRole(userProfilePayload);
    const isSuperAdmin = isSuperAdminUser(userProfilePayload);

    const isAuthorized =
      allowedRoles.includes(effectiveRole) ||
      (isSuperAdmin && (allowedRoles.includes('admin') || allowedRoles.includes('superadmin')));

    if (!prof && !isSuperAdmin && !user.user_metadata?.role) {
      setStatus('denied');
      return;
    }

    if (!isAuthorized) {
      setStatus('denied');
      return;
    }

    const resolvedProfile = {
      ...(prof || {
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        barangay: user.user_metadata?.barangay || null,
      }),
      id: user.id,
      email: user.email,
      role: effectiveRole,
      isSuperAdmin,
      adviser_name: user.user_metadata?.adviser_name || prof?.adviser_name || null,
      teacher_name: user.user_metadata?.teacher_name || user.user_metadata?.adviser_name || null,
      cdc_name: user.user_metadata?.cdc_name || prof?.cdc_name || null,
      child_name: user.user_metadata?.child_name || null,
      parent_name: user.user_metadata?.parent_name || null,
      user_metadata: user.user_metadata,
    };

    // Enforce Teacher Approval for Parent/Student accounts and enrich profile from Supabase
    if (effectiveRole === 'student' && allowedRoles.includes('student')) {
      const check = await getStudentApprovalStatus(user, resolvedProfile);
      setApprovalInfo(check);
      if (check.adviser_name) {
        resolvedProfile.adviser_name = check.adviser_name;
        resolvedProfile.teacher_name = check.adviser_name;
      }
      if (check.cdc_name) resolvedProfile.cdc_name = check.cdc_name;
      if (check.barangay) resolvedProfile.barangay = check.barangay;

      if (check.approval_status === 'pending') {
        setProfile(resolvedProfile);
        setStatus('pending_approval');
        return;
      }
      if (check.approval_status === 'rejected') {
        setProfile(resolvedProfile);
        setStatus('rejected_approval');
        return;
      }
    }

    setProfile(resolvedProfile);
    setStatus('ok');
  }, [allowedRoles]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

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

  if (status === 'pending_approval' || status === 'rejected_approval') {
    const isRejected = status === 'rejected_approval';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FFF3C4] via-[#FFF9E6] to-[#E8F6FF] p-5 font-nunito">
        <div className="bg-white max-w-md w-full rounded-3xl p-7 shadow-lg border-2 border-amber-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 text-3xl flex items-center justify-center mx-auto">
            {isRejected ? '❌' : '⏳'}
          </div>
          <h2 className="font-baloo text-2xl text-slate-900 m-0">
            {isRejected ? 'Registration Not Approved' : 'Waiting for Teacher Approval'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed m-0">
            {isRejected
              ? 'Your parent account registration was declined by the assigned teacher. Please coordinate directly with your Day Care Center.'
              : 'Your parent account has been registered, but must be approved by your assigned teacher before you can open your child’s dashboard.'}
          </p>

          <div className="p-3.5 rounded-2xl bg-[#FAF5EC] border border-[#E5DAC4] text-left text-xs space-y-1.5">
            <div>
              <span className="text-slate-500">Child / Learner:</span>{' '}
              <strong className="text-slate-900">{profile?.full_name}</strong>
            </div>
            <div>
              <span className="text-slate-500">Assigned Teacher:</span>{' '}
              <strong className="text-emerald-800">
                {approvalInfo?.adviser_name || profile?.adviser_name || 'Assigned Day Care Teacher'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Center &amp; Barangay:</span>{' '}
              <strong className="text-slate-800">
                {approvalInfo?.cdc_name || profile?.cdc_name || 'Child Development Center'} (Brgy.{' '}
                {approvalInfo?.barangay || profile?.barangay || 'Manolo Fortich'})
              </strong>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {!isRejected && (
              <button
                type="button"
                disabled={rechecking}
                onClick={async () => {
                  setRechecking(true);
                  await checkAccess();
                  setRechecking(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-60"
              >
                {rechecking ? 'Checking Supabase...' : '🔄 Check Approval Status'}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login');
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    alert('You do not have access to this page. Redirecting to login.');
    return <Navigate to="/login" replace />;
  }

  return children(profile);
}
