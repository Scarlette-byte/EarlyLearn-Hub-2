import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  getTrustedAppMetadata,
  getEffectiveRole,
  isSuperAdminUser,
  getRoleDashboardPath,
} from '../lib/roles.js';
import { getStudentApprovalStatus } from '../lib/learnersService.js';
import Icon from './Icons.jsx';

/**
 * Wraps a dashboard page and guarantees:
 *  1. The visitor has a valid Supabase session (else -> /login).
 *  2. Authorization uses ONLY the server-trusted JWT `app_metadata` claim (`roles.js`).
 *     - Missing trusted role claim -> denied -> /login.
 *     - Authenticated with a different valid role -> redirected to that role's dashboard.
 *  3. Teachers (or any account) flagged with `must_change_password` are redirected to /login
 *     to complete forced password change before accessing the dashboard.
 *  4. Parent/Student ('student') accounts must be approved by their assigned teacher.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | ok | must_change_password | wrong_role | pending_approval | rejected_approval | denied | anon
  const [redirectPath, setRedirectPath] = useState('/login');
  const [profile, setProfile] = useState(null);
  const [approvalInfo, setApprovalInfo] = useState(null);
  const [rechecking, setRechecking] = useState(false);

  const checkAccess = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setStatus('anon');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus('anon');
      return;
    }

    const authSubject = {
      user,
      app_metadata: user.app_metadata,
      access_token: session.access_token,
    };

    const effectiveRole = getEffectiveRole(authSubject);
    const isSuperAdmin = isSuperAdminUser(authSubject);

    if (!effectiveRole) {
      setStatus('denied');
      return;
    }

    const isAuthorized =
      allowedRoles.includes(effectiveRole) ||
      (isSuperAdmin && (allowedRoles.includes('admin') || allowedRoles.includes('superadmin')));

    if (!isAuthorized) {
      setRedirectPath(getRoleDashboardPath(effectiveRole));
      setStatus('wrong_role');
      return;
    }

    // Enforce forced password change before allowing dashboard access
    let mustChangePassword = Boolean(user.app_metadata?.must_change_password);
    if (!mustChangePassword && effectiveRole === 'teacher') {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('must_change_password')
        .eq('id', user.id)
        .maybeSingle();
      if (teacherRow?.must_change_password === true) {
        mustChangePassword = true;
      }
    }

    if (mustChangePassword) {
      setStatus('must_change_password');
      return;
    }

    // Load display profile fields (never used to override server-trusted role)
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const trustedAppMeta = getTrustedAppMetadata(authSubject);
    const resolvedProfile = {
      ...(prof || {
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        barangay: user.user_metadata?.barangay || null,
      }),
      id: user.id,
      email: user.email,
      role: effectiveRole,
      isSuperAdmin,
      app_metadata: trustedAppMeta,
      adviser_name: prof?.adviser_name || user.user_metadata?.adviser_name || null,
      teacher_name: user.user_metadata?.teacher_name || user.user_metadata?.adviser_name || null,
      cdc_name: prof?.cdc_name || user.user_metadata?.cdc_name || null,
      child_name: user.user_metadata?.child_name || null,
      parent_name: user.user_metadata?.parent_name || null,
    };

    // Enforce Teacher Approval for Parent/Student accounts
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
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-ui-bg text-ui-ink font-nunito px-4"
      >
        <div className="bg-ui-surface border border-ui-border rounded-auth-card shadow-auth-card px-8 py-7 flex flex-col items-center gap-3 max-w-xs w-full text-center">
          <div className="w-11 h-11 rounded-2xl bg-brand-leaf-tint border border-brand-leaf/30 text-brand-leaf-deep flex items-center justify-center">
            <Icon name="loader" size={20} className="animate-spin" />
          </div>
          <div className="font-baloo font-extrabold text-base text-ui-ink">
            Loading Workspace...
          </div>
          <p className="text-xs text-ui-ink-muted m-0">
            Verifying MSWDO EarlyLearn Hub credentials
          </p>
        </div>
      </div>
    );
  }

  if (status === 'anon' || status === 'must_change_password' || status === 'denied') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'wrong_role') {
    return <Navigate to={redirectPath} replace />;
  }

  if (status === 'pending_approval' || status === 'rejected_approval') {
    const isRejected = status === 'rejected_approval';
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-ui-bg p-5 font-nunito">
        <div className="relative overflow-hidden bg-ui-surface max-w-md w-full rounded-auth-card p-7 sm:p-8 shadow-auth-card border border-ui-border text-center space-y-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-leaf-deep via-brand-yellow to-brand-coral"
          />
          <div
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto ${
              isRejected
                ? 'bg-status-error-bg border-status-error-border text-status-error'
                : 'bg-status-warn-bg border-status-warn-border text-status-warn'
            }`}
          >
            <Icon
              name={isRejected ? 'x-circle' : 'clock'}
              size={30}
              label={isRejected ? 'Registration declined' : 'Pending approval'}
            />
          </div>
          <h2 className="font-baloo text-2xl font-extrabold text-ui-ink m-0">
            {isRejected ? 'Registration Not Approved' : 'Waiting for Teacher Approval'}
          </h2>
          <p className="text-xs sm:text-sm text-ui-ink-secondary leading-relaxed m-0">
            {isRejected
              ? 'Your parent account registration was declined by the assigned teacher. Please coordinate directly with your Day Care Center.'
              : 'Your parent account has been registered, but must be approved by your assigned teacher before you can open your child’s dashboard.'}
          </p>

          <div className="p-4 rounded-ui-card bg-ui-surface-subtle border border-ui-border text-left text-xs space-y-2">
            <div className="min-w-0 break-words">
              <span className="text-ui-ink-muted font-semibold">Child / Learner:</span>{' '}
              <strong className="text-ui-ink">{profile?.full_name}</strong>
            </div>
            <div className="min-w-0 break-words">
              <span className="text-ui-ink-muted font-semibold">Assigned Teacher:</span>{' '}
              <strong className="text-brand-leaf-deep">
                {approvalInfo?.adviser_name || profile?.adviser_name || 'Assigned Day Care Teacher'}
              </strong>
            </div>
            <div className="min-w-0 break-words">
              <span className="text-ui-ink-muted font-semibold">Center &amp; Barangay:</span>{' '}
              <strong className="text-ui-ink">
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
                className="flex-1 py-2.5 px-4 rounded-ui-btn bg-brand-leaf-deep hover:bg-brand-leaf-hover text-white font-bold text-xs cursor-pointer transition-all disabled:opacity-60 inline-flex items-center justify-center gap-1.5 border-none shadow-xs"
              >
                <Icon name="refresh" size={14} className={rechecking ? 'animate-spin' : ''} />
                <span>{rechecking ? 'Checking Status...' : 'Check Approval Status'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login');
              }}
              className="flex-1 py-2.5 px-4 rounded-ui-btn bg-ui-surface hover:bg-ui-surface-warm border border-ui-border text-ui-ink font-bold text-xs cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children(profile);
}
