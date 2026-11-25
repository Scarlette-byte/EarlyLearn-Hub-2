import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, supabaseSecondaryAuth, normalizeAuthIdentifier } from '../lib/supabaseClient';
import {
  getEffectiveRole,
  getDbRole,
  getRoleDashboardPath,
} from '../lib/roles.js';
import { syncStudentLogin, getStudentApprovalStatus } from '../lib/learnersService.js';
import {
  resolveTeacherForLogin,
  getTeacherSyncedCredential,
  resolveParentForLogin,
  getParentSyncedCredential,
} from '../lib/teacherAuthService.js';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../lib/passwordPolicy.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import PineappleLogo from '../components/PineappleLogo.jsx';

async function checkMustChangePassword(user, effectiveRole) {
  if (!user) return false;
  if (user.app_metadata?.must_change_password === true) return true;

  if (effectiveRole === 'teacher') {
    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('must_change_password')
      .eq('id', user.id)
      .maybeSingle();
    if (teacherRow?.must_change_password === true) return true;
  }

  return false;
}

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Forced password change state (for accounts with must_change_password = true)
  const [passwordChangeState, setPasswordChangeState] = useState(null); // { user, effectiveRole, currentPassword }
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Check active session on mount: redirect by trusted role, or enforce password-change / approval gates
  useEffect(() => {
    let active = true;

    async function inspectExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (active) setCheckingSession(false);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) setCheckingSession(false);
          return;
        }

        const effectiveRole = getEffectiveRole({
          user,
          app_metadata: user.app_metadata,
          access_token: session.access_token,
        });

        // Stay on /login if server-trusted app_metadata role is absent
        if (!effectiveRole) {
          if (active) setCheckingSession(false);
          return;
        }

        const mustChange = await checkMustChangePassword(user, effectiveRole);
        if (mustChange) {
          if (active) {
            setPasswordChangeState({ user, effectiveRole, currentPassword: '' });
            setCheckingSession(false);
          }
          return;
        }

        if (effectiveRole === 'student') {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          const approvalInfo = await getStudentApprovalStatus(user, prof);
          if (approvalInfo.approval_status === 'pending' || approvalInfo.approval_status === 'rejected') {
            await supabase.auth.signOut();
            if (active) {
              const teacherLabel = approvalInfo.adviser_name || 'your assigned Day Care Teacher';
              setMsg({
                text:
                  approvalInfo.approval_status === 'rejected'
                    ? '❌ Your registration was declined by the assigned teacher. Please coordinate with your Child Development Center.'
                    : `⏳ Your parent account is pending approval from ${teacherLabel}. Please wait for your teacher to approve your registration.`,
                type: 'error',
              });
              setCheckingSession(false);
            }
            return;
          }
        }

        if (active) {
          navigate(getRoleDashboardPath(effectiveRole), { replace: true });
        }
      } catch {
        if (active) setCheckingSession(false);
      }
    }

    inspectExistingSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    const trimmedInput = (identifier || '').trim();
    const { authEmail } = normalizeAuthIdentifier(trimmedInput);
    if (!authEmail && !trimmedInput) {
      setMsg({
        text: '⚠️ Please enter your Teacher ID, mobile phone number, or email address.',
        type: 'error',
      });
      return;
    }

    setLoading(true);

    // Resolve candidate emails for teachers and parents
    const teacherMatch = await resolveTeacherForLogin(trimmedInput);
    const parentMatch = !teacherMatch ? await resolveParentForLogin(trimmedInput) : null;

    const rawTeacherContact = String(teacherMatch?.contact_number || '').split('||')[0].trim();
    const teacherDigits = rawTeacherContact.replace(/\D/g, '');
    const teacherPhoneEmail = teacherDigits.length >= 7 ? `${teacherDigits}@earlylearn.ph` : null;
    const teacherIdEmail = teacherMatch?.id
      ? `${String(teacherMatch.id).toLowerCase().replace(/[^a-z0-9]/g, '')}@earlylearn.ph`
      : null;

    const candidateEmails = Array.from(
      new Set(
        [
          teacherMatch?.email,
          teacherPhoneEmail,
          teacherIdEmail,
          teacherMatch?.baseline_email,
          parentMatch?.authEmail,
          authEmail,
          trimmedInput.includes('@') ? trimmedInput.toLowerCase() : null,
        ].filter(Boolean)
      )
    );

    let authSuccessData = null;
    let lastError = null;

    // Try signing in with each candidate email
    for (const email of candidateEmails) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error && data?.user) {
        authSuccessData = data;
        break;
      }
      lastError = error;
    }

    // Auto-heal with admin-set or teacher-created temporary password if sign in failed
    if (!authSuccessData) {
      const syncedTeacherCred =
        (await getTeacherSyncedCredential(trimmedInput)) ||
        (teacherMatch?.email ? await getTeacherSyncedCredential(teacherMatch.email) : null) ||
        (teacherDigits ? await getTeacherSyncedCredential(teacherDigits) : null) ||
        (await getTeacherSyncedCredential(authEmail));

      if (syncedTeacherCred && syncedTeacherCred.temporary_password === password) {
        const teacherName = syncedTeacherCred.full_name || teacherMatch?.full_name || 'Teacher';
        const healEmails = Array.from(
          new Set(
            [
              syncedTeacherCred.email,
              teacherPhoneEmail,
              teacherMatch?.email,
              authEmail,
              teacherIdEmail,
            ].filter(Boolean)
          )
        );

        for (const healEmail of healEmails) {
          await supabaseSecondaryAuth.auth.signUp({
            email: healEmail,
            password,
            options: {
              data: {
                full_name: teacherName,
                teacher_id: syncedTeacherCred.teacher_id || teacherMatch?.id,
                barangay: syncedTeacherCred.barangay || teacherMatch?.barangay,
                cdc_name: syncedTeacherCred.cdc_name || teacherMatch?.cdc_name,
                contact_number: syncedTeacherCred.contact_number || teacherMatch?.contact_number,
              },
            },
          });

          const { data: retryData, error: retryErr } = await supabase.auth.signInWithPassword({
            email: healEmail,
            password,
          });

          if (!retryErr && retryData?.user) {
            authSuccessData = retryData;
            break;
          }
        }

        if (!authSuccessData) {
          const candidateOldPasswords = Array.isArray(syncedTeacherCred.previous_passwords)
            ? syncedTeacherCred.previous_passwords
            : [];
          for (const healEmail of healEmails) {
            for (const oldPass of candidateOldPasswords) {
              const { data: oldData, error: oldErr } = await supabase.auth.signInWithPassword({
                email: healEmail,
                password: oldPass,
              });
              if (!oldErr && oldData?.user) {
                try {
                  await supabase.auth.updateUser({ password });
                } catch {}
                authSuccessData = oldData;
                break;
              }
            }
            if (authSuccessData) break;
          }
        }
      }

      if (!authSuccessData) {
        const syncedParentCred =
          (await getParentSyncedCredential(trimmedInput)) ||
          (parentMatch?.authEmail ? await getParentSyncedCredential(parentMatch.authEmail) : null) ||
          (await getParentSyncedCredential(authEmail));

        if (syncedParentCred && syncedParentCred.temporary_password === password) {
          const parentEmail = syncedParentCred.email || parentMatch?.authEmail || authEmail;
          const childName = syncedParentCred.child_name || parentMatch?.childName || 'Child Learner';

          await supabaseSecondaryAuth.auth.signUp({
            email: parentEmail,
            password,
            options: {
              data: {
                full_name: childName,
                child_name: childName,
                parent_name: syncedParentCred.parent_name || '',
                barangay: syncedParentCred.barangay || '',
                cdc_name: syncedParentCred.cdc_name || '',
                contact_number: syncedParentCred.identifier || '',
                approval_status: 'approved',
              },
            },
          });

          const { data: pRetryData, error: pRetryErr } = await supabase.auth.signInWithPassword({
            email: parentEmail,
            password,
          });

          if (!pRetryErr && pRetryData?.user) {
            authSuccessData = pRetryData;
          } else {
            lastError = pRetryErr || lastError;
          }
        }
      }
    }

    if (!authSuccessData) {
      setMsg({
        text: '❌ ' + (lastError?.message || 'Invalid login credentials. Please check your username/ID and password.'),
        type: 'error',
      });
      setLoading(false);
      return;
    }

    let activeUser = authSuccessData.user;
    let activeSession = authSuccessData.session;

    // Resolve role strictly from server-trusted JWT app_metadata (refreshing once if a DB trigger just populated it)
    let effectiveRole = getEffectiveRole({
      user: activeUser,
      app_metadata: activeUser.app_metadata,
      access_token: activeSession?.access_token,
    });

    if (!effectiveRole) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.user) {
        activeUser = refreshed.user;
        activeSession = refreshed.session || activeSession;
        effectiveRole = getEffectiveRole({
          user: activeUser,
          app_metadata: activeUser.app_metadata,
          access_token: activeSession?.access_token,
        });
      }
    }

    if (!effectiveRole) {
      await supabase.auth.signOut();
      setLoading(false);
      setMsg({
        text: '❌ Account role claim (app_metadata.role) is not configured on the server. Please contact the MSWDO administrator.',
        type: 'error',
      });
      return;
    }

    // Load or initialize profile display row (role written from trusted server claim only)
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', activeUser.id)
      .maybeSingle();

    if (profileError || !profile) {
      const metaName = activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'User';
      const metaBarangay = activeUser.user_metadata?.barangay || null;
      const metaCdc = activeUser.user_metadata?.cdc_name || null;
      const metaContact = activeUser.user_metadata?.contact_number || null;
      const dbRole = getDbRole(effectiveRole);

      const { data: createdProf } = await supabase
        .from('profiles')
        .upsert({
          id: activeUser.id,
          full_name: metaName,
          role: dbRole,
          barangay: metaBarangay,
          cdc_name: metaCdc,
          contact_number: metaContact,
        })
        .select('*')
        .maybeSingle();

      profile = createdProf || {
        id: activeUser.id,
        role: dbRole,
        full_name: metaName,
        barangay: metaBarangay,
        cdc_name: metaCdc,
        contact_number: metaContact,
      };
    }

    // Gate 1: Forced Password Change
    const mustChange = await checkMustChangePassword(activeUser, effectiveRole);
    if (mustChange) {
      setPasswordChangeState({
        user: activeUser,
        effectiveRole,
        currentPassword: password,
      });
      setNewPassword('');
      setConfirmPassword('');
      setMsg({
        text: '🔐 Temporary password detected. Please set a new password to continue.',
        type: 'error',
      });
      setLoading(false);
      return;
    }

    // Gate 2: Parent / Student Approval Gate
    if (effectiveRole === 'student') {
      try {
        const approvalInfo = await getStudentApprovalStatus(activeUser, profile);
        if (approvalInfo.approval_status === 'pending') {
          await supabase.auth.signOut();
          setLoading(false);
          const teacherLabel = approvalInfo.adviser_name || 'your assigned Day Care Teacher';
          setMsg({
            text: `⏳ Your parent account is pending approval from ${teacherLabel}. Please wait for your teacher to approve your registration.`,
            type: 'error',
          });
          return;
        }
        if (approvalInfo.approval_status === 'rejected') {
          await supabase.auth.signOut();
          setLoading(false);
          setMsg({
            text: '❌ Your registration was declined by the assigned teacher. Please coordinate with your Child Development Center.',
            type: 'error',
          });
          return;
        }

        await syncStudentLogin(activeUser, profile);
      } catch (err) {
        console.warn('Could not sync student login to teacher dashboard:', err);
      }
    }

    const roleTag = effectiveRole === 'superadmin' ? ' • Superadmin' : '';
    setMsg({ text: `✅ Welcome, ${profile.full_name || activeUser.email}!${roleTag}`, type: 'ok' });

    setTimeout(() => {
      navigate(getRoleDashboardPath(effectiveRole), { replace: true });
    }, 500);
  }

  async function handlePasswordChangeSubmit(e) {
    e.preventDefault();
    if (!passwordChangeState?.user) return;

    const pwCheck = validatePassword(newPassword, {
      identifiers: [
        passwordChangeState.user.email,
        passwordChangeState.user.user_metadata?.username,
        passwordChangeState.user.user_metadata?.contact_number,
        passwordChangeState.user.user_metadata?.full_name,
        passwordChangeState.user.user_metadata?.teacher_id,
      ],
    });
    if (!pwCheck.valid) {
      setMsg({ text: `⚠️ ${pwCheck.errors[0]}`, type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg({ text: '⚠️ New password and confirmation do not match.', type: 'error' });
      return;
    }

    if (passwordChangeState.currentPassword && newPassword === passwordChangeState.currentPassword) {
      setMsg({ text: '⚠️ Please choose a new password different from your temporary password.', type: 'error' });
      return;
    }

    setChangingPassword(true);
    setMsg({ text: '', type: '' });

    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      setMsg({ text: '❌ Failed to update password: ' + updateErr.message, type: 'error' });
      setChangingPassword(false);
      return;
    }

    try {
      await supabase
        .from('teachers')
        .update({ must_change_password: false })
        .eq('id', passwordChangeState.user.id);
    } catch (err) {
      console.warn('Could not clear must_change_password flag on teachers:', err);
    }

    try {
      await supabase.auth.refreshSession();
    } catch {}

    setChangingPassword(false);
    setMsg({ text: '✅ Password updated! Redirecting to your dashboard...', type: 'ok' });

    const dest = getRoleDashboardPath(passwordChangeState.effectiveRole);
    setTimeout(() => {
      navigate(dest, { replace: true });
    }, 500);
  }

  async function handleCancelPasswordChange() {
    await supabase.auth.signOut();
    setPasswordChangeState(null);
    setNewPassword('');
    setConfirmPassword('');
    setPassword('');
    setMsg({ text: '', type: '' });
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBEA]/60 text-[#7A6B52] font-nunito text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center overflow-x-hidden relative bg-[#FFFBEA]/60 font-nunito">
      {/* Soft pastel ambient background shapes */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#FFD34E]/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#78BD58]/20 blur-3xl" />
        <span className="absolute top-[12%] left-[10%] text-amber-300 text-3xl select-none opacity-70">⭐</span>
        <span className="absolute top-[24%] right-[12%] text-amber-300 text-2xl select-none opacity-60">✨</span>
        <span className="absolute bottom-[16%] left-[8%] text-emerald-400 text-3xl select-none opacity-50">🌱</span>
        <span className="absolute bottom-[20%] right-[10%] text-rose-300 text-2xl select-none opacity-50">🎈</span>
      </div>

      <div className="animate-pop safe-x relative z-10 bg-white w-full max-w-[400px] my-6 p-7 sm:p-9 rounded-[32px] shadow-[0_16px_50px_rgba(43,36,28,0.08)] border border-[#F4EEDF] text-center">
        <div className="mb-3 flex justify-center">
          <PineappleLogo variant="vertical" size="lg" />
        </div>

        {passwordChangeState ? (
          <>
            <h1 className="font-baloo font-extrabold text-2xl sm:text-[22px] text-[#2B241C] m-0 mb-1">
              Update Your Password
            </h1>
            <p className="text-xs text-[#7A6B52] m-0 mb-6 font-semibold">
              Please set a new personal password before entering your dashboard
            </p>

            <form onSubmit={handlePasswordChangeSubmit} className="text-left space-y-3.5">
              <div>
                <label
                  htmlFor="new-password"
                  className="block font-bold text-xs text-[#3D3327] mb-1.5"
                >
                  New Password (min. {PASSWORD_MIN_LENGTH} characters)
                </label>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#EBE7DF] bg-[#FFFDF9] font-nunito text-sm outline-none transition-colors focus:border-[#78BD58] focus:bg-white text-slate-800"
                />
                <PasswordStrengthMeter
                  password={newPassword}
                  identifiers={[
                    passwordChangeState.user.email,
                    passwordChangeState.user.user_metadata?.username,
                    passwordChangeState.user.user_metadata?.contact_number,
                    passwordChangeState.user.user_metadata?.full_name,
                    passwordChangeState.user.user_metadata?.teacher_id,
                  ]}
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block font-bold text-xs text-[#3D3327] mb-1.5"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#EBE7DF] bg-[#FFFDF9] font-nunito text-sm outline-none transition-colors focus:border-[#78BD58] focus:bg-white text-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#7A6B52] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>Show passwords</span>
              </label>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full mt-2 py-3 min-h-12 border-none rounded-2xl bg-[#78BD58] hover:bg-[#66A548] text-white font-baloo text-base font-extrabold cursor-pointer transition-all active:scale-[0.98] shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {changingPassword ? 'Saving Password...' : 'Save Password & Continue'}
              </button>

              <button
                type="button"
                onClick={handleCancelPasswordChange}
                className="w-full py-2.5 border border-[#EBE7DF] rounded-2xl bg-white hover:bg-slate-50 text-[#7A6B52] font-nunito text-xs font-bold cursor-pointer transition-colors"
              >
                Sign Out
              </button>

              {msg.text && (
                <p
                  className={`mt-3 text-xs font-bold text-center min-h-[18px] leading-snug p-2.5 rounded-xl ${
                    msg.type === 'error'
                      ? 'bg-rose-50 text-[#F46D70] border border-rose-200'
                      : 'bg-emerald-50 text-[#78BD58] border border-emerald-200'
                  }`}
                >
                  {msg.text}
                </p>
              )}
            </form>
          </>
        ) : (
          <>
            <h1 className="font-baloo font-extrabold text-2xl sm:text-[22px] text-[#2B241C] m-0 mb-1">
              Welcome Back!
            </h1>
            <p className="text-xs text-[#7A6B52] m-0 mb-6 font-semibold">
              Sign in to continue your learning journey
            </p>

            <form onSubmit={handleSubmit} className="text-left space-y-3.5">
              <div>
                <label
                  htmlFor="identifier"
                  className="block font-bold text-xs text-[#3D3327] mb-1.5"
                >
                  Teacher ID, Mobile Number, or Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                    👤
                  </span>
                  <input
                    id="identifier"
                    type="text"
                    required
                    placeholder="Teacher ID, Mobile Number, or Email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-[#EBE7DF] bg-[#FFFDF9] font-nunito text-sm outline-none transition-colors focus:border-[#78BD58] focus:bg-white text-slate-800"
                  />
                </div>
                <p className="text-[11px] text-[#7A6B52] mt-1 m-0">
                  💡 Teachers: use Teacher ID. Parents: use registered mobile or email.
                </p>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-bold text-xs text-[#3D3327] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                    🔒
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl border-2 border-[#EBE7DF] bg-[#FFFDF9] font-nunito text-sm outline-none transition-colors focus:border-[#78BD58] focus:bg-white text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer bg-transparent border-none"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 min-h-12 border-none rounded-2xl bg-[#F46D70] hover:bg-[#E65A5D] text-white font-baloo text-base font-extrabold cursor-pointer transition-all active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Log In'}
              </button>

              {msg.text && (
                <p
                  className={`mt-3 text-xs font-bold text-center min-h-[18px] leading-snug p-2.5 rounded-xl ${
                    msg.type === 'error'
                      ? 'bg-rose-50 text-[#F46D70] border border-rose-200'
                      : 'bg-emerald-50 text-[#78BD58] border border-emerald-200'
                  }`}
                >
                  {msg.text}
                </p>
              )}
            </form>

            <div className="mt-5 pt-4 border-t border-[#F0EBE0]">
              <Link
                to="/signup"
                className="block text-xs text-[#F46D70] no-underline font-extrabold hover:underline"
              >
                Don&apos;t have an account? Sign Up here
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
