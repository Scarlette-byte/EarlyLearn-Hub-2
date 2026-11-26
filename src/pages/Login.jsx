import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase, supabaseSecondaryAuth, normalizeAuthIdentifier } from '../lib/supabaseClient';
import {
  getEffectiveRole,
  getDbRole,
  getRoleDashboardPath,
} from '../lib/roles.js';
import { syncStudentLogin, getStudentApprovalStatus } from '../lib/learnersService.js';
import {
  resolveTeacherForLogin,
  resolveParentForLogin,
} from '../lib/teacherAuthService.js';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../lib/passwordPolicy.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import PineappleLogo from '../components/PineappleLogo.jsx';
import Icon from '../components/Icons.jsx';

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

const TRUST_HIGHLIGHTS = [
  {
    icon: 'landmark',
    title: 'MSWDO Supervised Program',
    desc: 'Municipality of Manolo Fortich Early Childhood Care & Development.',
  },
  {
    icon: 'book',
    title: 'Unified CDC & Parent Access',
    desc: 'Curriculum modules, bilingual flashcards, and child progress records.',
  },
  {
    icon: 'shield',
    title: 'Role-Verified Security',
    desc: 'Protected access for MSWDO staff, CDC teachers, and approved parents.',
  },
];

function detectAlertVariant(msg) {
  if (!msg?.text) return 'info';
  if (msg.type === 'ok') return 'ok';
  const lower = msg.text.toLowerCase();
  if (lower.includes('pending approval') || lower.includes('temporary password')) {
    return 'warn';
  }
  return 'error';
}

export default function Login() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Purely visual UX & accessibility state (inline touch validation, Caps Lock hint, error shake)
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [touched, setTouched] = useState({
    identifier: false,
    password: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [shakeCount, setShakeCount] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  function handleKeyCapCheck(e) {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  }

  function triggerAlert(nextMsg) {
    setMsg(nextMsg);
    if (nextMsg?.type === 'error') {
      setShakeCount((c) => c + 1);
    }
  }

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
                    ? 'Your registration was declined by the assigned teacher. Please coordinate with your Child Development Center.'
                    : `Your parent account is pending approval from ${teacherLabel}. Please wait for your teacher to approve your registration.`,
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
    setTouched((prev) => ({ ...prev, identifier: true, password: true }));
    setMsg({ text: '', type: '' });

    const trimmedInput = (identifier || '').trim();
    const { authEmail } = normalizeAuthIdentifier(trimmedInput);
    if (!authEmail && !trimmedInput) {
      triggerAlert({
        text: 'Please enter your Teacher ID, mobile phone number, or email address.',
        type: 'error',
      });
      return;
    }

    if (!password) {
      triggerAlert({
        text: 'Please enter your password to sign in.',
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

    if (!authSuccessData) {
      triggerAlert({
        text: lastError?.message || 'Invalid login credentials. Please check your username/ID and password.',
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
      triggerAlert({
        text: 'Account role claim (app_metadata.role) is not configured on the server. Please contact the MSWDO administrator.',
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
      setTouched({ identifier: false, password: false, newPassword: false, confirmPassword: false });
      setMsg({
        text: 'Temporary password detected. Please set a new password to continue.',
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
          triggerAlert({
            text: `Your parent account is pending approval from ${teacherLabel}. Please wait for your teacher to approve your registration.`,
            type: 'error',
          });
          return;
        }
        if (approvalInfo.approval_status === 'rejected') {
          await supabase.auth.signOut();
          setLoading(false);
          triggerAlert({
            text: 'Your registration was declined by the assigned teacher. Please coordinate with your Child Development Center.',
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
    setMsg({ text: `Welcome, ${profile.full_name || activeUser.email}!${roleTag}`, type: 'ok' });

    setTimeout(() => {
      navigate(getRoleDashboardPath(effectiveRole), { replace: true });
    }, 500);
  }

  async function handlePasswordChangeSubmit(e) {
    e.preventDefault();
    if (!passwordChangeState?.user) return;

    setTouched((prev) => ({ ...prev, newPassword: true, confirmPassword: true }));

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
      triggerAlert({ text: pwCheck.errors[0], type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      triggerAlert({ text: 'New password and confirmation do not match.', type: 'error' });
      return;
    }

    if (passwordChangeState.currentPassword && newPassword === passwordChangeState.currentPassword) {
      triggerAlert({
        text: 'Please choose a new password different from your temporary password.',
        type: 'error',
      });
      return;
    }

    setChangingPassword(true);
    setMsg({ text: '', type: '' });

    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      triggerAlert({ text: 'Failed to update password: ' + updateErr.message, type: 'error' });
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
    setMsg({ text: 'Password updated! Redirecting to your dashboard...', type: 'ok' });

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
    setShowPassword(false);
    setShowConfirmPassword(false);
    setTouched({ identifier: false, password: false, newPassword: false, confirmPassword: false });
    setMsg({ text: '', type: '' });
  }

  // Inline validation messages
  const identifierError =
    touched.identifier && !identifier.trim()
      ? 'Enter your Teacher ID, mobile number, or email address.'
      : '';

  const passwordError =
    touched.password && !password
      ? 'Enter your account password.'
      : '';

  const confirmMismatchError =
    touched.confirmPassword && confirmPassword && newPassword !== confirmPassword
      ? 'Passwords do not match yet.'
      : '';

  const sameAsTempError =
    touched.newPassword &&
    newPassword &&
    passwordChangeState?.currentPassword &&
    newPassword === passwordChangeState.currentPassword
      ? 'New password must be different from your temporary password.'
      : '';

  const isSuccess = msg.type === 'ok';
  const alertVariant = detectAlertVariant(msg);

  // Motion presets honoring prefers-reduced-motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { duration: 0.01 }
        : { duration: 0.28, staggerChildren: 0.055, delayChildren: 0.04 },
    },
  };

  const itemVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0.01 }
        : { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
    },
  };

  if (checkingSession) {
    return (
      <div
        className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-ui-bg text-ui-ink font-nunito px-4"
        role="status"
        aria-live="polite"
      >
        <div className="bg-ui-surface border border-ui-border rounded-auth-card shadow-auth-card px-8 py-7 flex flex-col items-center gap-3.5 max-w-xs w-full text-center">
          <PineappleLogo variant="icon" size={44} />
          <div className="flex items-center gap-2 text-sm font-bold text-ui-ink">
            <Icon name="loader" size={17} className="animate-spin text-brand-leaf-deep" />
            <span>Verifying session...</span>
          </div>
          <p className="text-xs text-ui-ink-muted m-0">
            Connecting to MSWDO EarlyLearn Hub
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-ui-panel bg-gradient-to-br from-[#0D2B1E] via-[#123B29] to-[#1B5139] text-ui-ink font-nunito flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-x-hidden selection:bg-brand-yellow/40 selection:text-ui-ink">
      {/* Subtle ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-leaf/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-yellow/10 blur-3xl" />
      </div>

      {/* Centered Wide Rounded Card */}
      <motion.div
        key={passwordChangeState ? 'forced-password-card' : 'signin-card'}
        variants={containerVariants}
        initial="hidden"
        animate={
          shakeCount > 0 && !prefersReducedMotion
            ? {
                opacity: 1,
                x: [0, -7, 7, -5, 5, -2, 2, 0],
                transition: { duration: 0.36 },
              }
            : 'visible'
        }
        className="relative z-10 w-full max-w-4xl bg-ui-surface rounded-3xl shadow-2xl border border-white/15 overflow-hidden grid grid-cols-1 lg:grid-cols-12"
      >
        {/* ================================================================= */}
        {/* LEFT HALF: BRAND-GRADIENT PANEL WITH OVERLAPPING SPHERES           */}
        {/* ================================================================= */}
        <aside
          aria-label="Program information"
          className="lg:col-span-6 relative overflow-hidden bg-ui-panel bg-gradient-to-br from-[#1B5139] via-[#123B29] to-[#0D2B1E] text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 min-h-[210px] lg:min-h-[560px]"
        >
          {/* Overlapping Gradient Circles / Spheres */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            {/* Big circle forming a curved edge into the white half */}
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, -10, 0], scale: [1, 1.02, 1] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
              className="hidden lg:block absolute -right-28 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-br from-brand-leaf/45 to-brand-forest-deep/80 shadow-inner"
            />
            {/* Glossy sphere lower center */}
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, 12, 0], x: [0, -6, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-brand-forest-deep via-brand-leaf/60 to-brand-yellow/35 opacity-80 shadow-lg"
            />
            {/* Partial circle bottom-left */}
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, -8, 0], x: [0, 6, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-16 -left-16 w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-brand-yellow/25 to-brand-leaf/35"
            />
          </div>

          {/* Brand Content */}
          <div className="relative z-10 space-y-4">
            <PineappleLogo variant="horizontal" size={42} theme="dark" />
          </div>

          <div className="relative z-10 space-y-2.5 my-4 lg:my-auto">
            <h2 className="font-baloo text-3xl sm:text-4xl font-black uppercase tracking-wider text-white m-0 leading-none">
              WELCOME
            </h2>
            <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.18em] text-brand-yellow m-0">
              EarlyLearn Hub
            </p>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed m-0 max-w-sm pt-1">
              Official digital platform for Child Development Centers, Day Care Teachers, and Parents under the MSWDO Manolo Fortich ECCD program.
            </p>
          </div>

          <div className="relative z-10 hidden lg:flex items-center gap-2 text-[11px] text-white/75 font-semibold pt-4 border-t border-white/15">
            <Icon name="shield" size={14} className="text-brand-yellow shrink-0" />
            <span>Municipality of Manolo Fortich • MSWDO ECCD</span>
          </div>
        </aside>

        {/* ================================================================= */}
        {/* RIGHT HALF: WHITE FORM PANEL                                       */}
        {/* ================================================================= */}
        <main className="lg:col-span-6 bg-ui-surface p-6 sm:p-9 lg:p-10 relative overflow-hidden flex flex-col justify-center">
          {/* Partial brand-colored circle in the bottom-right corner */}
          <div
            aria-hidden="true"
            className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-tl from-brand-forest/20 via-brand-leaf/15 to-transparent pointer-events-none"
          />

          <div className="relative z-10 w-full">
            <AnimatePresence mode="wait">
              {passwordChangeState ? (
                /* ========================================================= */
                /* STEP 2: FORCED PASSWORD CHANGE VIEW                       */
                /* ========================================================= */
                <motion.div
                  key="password-change-step"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                >
                  <motion.div variants={itemVariants} className="mb-6">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-warn-bg border border-status-warn-border text-status-warn text-xs font-extrabold mb-3">
                      <Icon name="key" size={14} />
                      <span>Security Step Required</span>
                    </div>
                    <h1 className="font-baloo font-extrabold text-2xl sm:text-[26px] text-ui-ink m-0 leading-tight">
                      Set Your Personal Password
                    </h1>
                    <p className="text-sm text-ui-ink-secondary m-0 mt-1.5 leading-relaxed">
                      You signed in with a temporary password. Choose a strong personal password before entering your dashboard.
                    </p>
                  </motion.div>

                  {/* Status / Error / Success Alert Banner */}
                  <AnimatePresence>
                    {msg.text && (
                      <motion.div
                        key={msg.text}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        role={msg.type === 'error' ? 'alert' : 'status'}
                        aria-live={msg.type === 'error' ? 'assertive' : 'polite'}
                        className={`mb-5 p-3.5 rounded-ui-input border text-xs sm:text-[13px] font-bold leading-snug flex items-start gap-2.5 ${
                          alertVariant === 'ok'
                            ? 'bg-status-ok-bg border-status-ok-border text-status-ok'
                            : alertVariant === 'warn'
                              ? 'bg-status-warn-bg border-status-warn-border text-status-warn'
                              : 'bg-status-error-bg border-status-error-border text-status-error'
                        }`}
                      >
                        <Icon
                          name={
                            alertVariant === 'ok'
                              ? 'check-circle'
                              : alertVariant === 'warn'
                                ? 'clock'
                                : 'alert-circle'
                          }
                          size={17}
                          className="shrink-0 mt-0.5"
                        />
                        <span>{msg.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handlePasswordChangeSubmit} noValidate className="space-y-4 text-left">
                    {/* New Password */}
                    <motion.div variants={itemVariants}>
                      <label
                        htmlFor="new-password"
                        className="block font-bold text-xs sm:text-[13px] text-ui-ink mb-1.5"
                      >
                        New Password <span className="text-ui-ink-muted font-semibold">(min. {PASSWORD_MIN_LENGTH} characters)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ui-ink-muted">
                          <Icon name="lock" size={17} />
                        </span>
                        <input
                          id="new-password"
                          name="new-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          minLength={PASSWORD_MIN_LENGTH}
                          disabled={changingPassword || isSuccess}
                          placeholder="Create a strong password"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (msg.type === 'error') setMsg({ text: '', type: '' });
                          }}
                          onBlur={() => setTouched((p) => ({ ...p, newPassword: true }))}
                          onKeyUp={handleKeyCapCheck}
                          onKeyDown={handleKeyCapCheck}
                          aria-invalid={Boolean(sameAsTempError)}
                          aria-describedby="new-password-Feedback"
                          className={`w-full pl-10 pr-11 py-3 rounded-ui-input border bg-ui-surface-subtle font-nunito text-sm text-ui-ink placeholder:text-ui-ink-muted/75 transition-all outline-none focus:bg-ui-surface focus-visible:border-ui-focus focus-visible:shadow-focus-ring disabled:opacity-60 ${
                            sameAsTempError
                              ? 'border-status-error shadow-error-ring'
                              : 'border-ui-border hover:border-ui-border-strong'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          disabled={changingPassword}
                          className="absolute inset-y-0 right-0 px-3.5 flex items-center text-ui-ink-muted hover:text-ui-ink rounded-r-ui-input focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus cursor-pointer bg-transparent border-none"
                          aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                          title={showPassword ? 'Hide new password' : 'Show new password'}
                        >
                          <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
                        </button>
                      </div>

                      {sameAsTempError && (
                        <p className="mt-1.5 mb-0 text-xs font-bold text-status-error flex items-center gap-1.5" role="alert">
                          <Icon name="alert-circle" size={13} />
                          <span>{sameAsTempError}</span>
                        </p>
                      )}

                      <div id="new-password-Feedback">
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
                    </motion.div>

                    {/* Confirm New Password */}
                    <motion.div variants={itemVariants}>
                      <label
                        htmlFor="confirm-password"
                        className="block font-bold text-xs sm:text-[13px] text-ui-ink mb-1.5"
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ui-ink-muted">
                          <Icon name="shield" size={17} />
                        </span>
                        <input
                          id="confirm-password"
                          name="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          minLength={PASSWORD_MIN_LENGTH}
                          disabled={changingPassword || isSuccess}
                          placeholder="Re-enter your new password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (msg.type === 'error') setMsg({ text: '', type: '' });
                          }}
                          onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                          onKeyUp={handleKeyCapCheck}
                          onKeyDown={handleKeyCapCheck}
                          aria-invalid={Boolean(confirmMismatchError)}
                          aria-describedby={confirmMismatchError ? 'confirm-password-error' : undefined}
                          className={`w-full pl-10 pr-11 py-3 rounded-ui-input border bg-ui-surface-subtle font-nunito text-sm text-ui-ink placeholder:text-ui-ink-muted/75 transition-all outline-none focus:bg-ui-surface focus-visible:border-ui-focus focus-visible:shadow-focus-ring disabled:opacity-60 ${
                            confirmMismatchError
                              ? 'border-status-error shadow-error-ring'
                              : confirmPassword && confirmPassword === newPassword
                                ? 'border-brand-leaf-deep'
                                : 'border-ui-border hover:border-ui-border-strong'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          disabled={changingPassword}
                          className="absolute inset-y-0 right-0 px-3.5 flex items-center text-ui-ink-muted hover:text-ui-ink rounded-r-ui-input focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus cursor-pointer bg-transparent border-none"
                          aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                          title={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                        >
                          <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={17} />
                        </button>
                      </div>

                      {confirmMismatchError && (
                        <p
                          id="confirm-password-error"
                          className="mt-1.5 mb-0 text-xs font-bold text-status-error flex items-center gap-1.5"
                          role="alert"
                        >
                          <Icon name="alert-circle" size={13} />
                          <span>{confirmMismatchError}</span>
                        </p>
                      )}
                    </motion.div>

                    {/* Caps Lock Hint */}
                    <AnimatePresence>
                      {capsLockOn && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          role="status"
                          aria-live="polite"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-status-warn-bg border border-status-warn-border text-status-warn text-xs font-bold"
                        >
                          <Icon name="arrow-big-up" size={15} className="shrink-0" />
                          <span>Caps Lock is ON — passwords are case-sensitive.</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Primary Submit & Cancel Actions */}
                    <motion.div variants={itemVariants} className="pt-2 space-y-2.5">
                      <button
                        type="submit"
                        disabled={changingPassword || isSuccess}
                        className="w-full py-3.5 px-5 min-h-12 rounded-ui-btn border-none bg-brand-leaf-deep hover:bg-brand-leaf-hover active:scale-[0.99] text-white font-baloo text-base font-bold tracking-wide cursor-pointer transition-all shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus focus-visible:ring-offset-2 disabled:opacity-65 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {changingPassword ? (
                          <>
                            <Icon name="loader" size={18} className="animate-spin" />
                            <span>Saving New Password...</span>
                          </>
                        ) : isSuccess ? (
                          <>
                            <Icon name="check-circle" size={18} />
                            <span>Password Saved — Redirecting...</span>
                          </>
                        ) : (
                          <>
                            <Icon name="shield" size={18} />
                            <span>Save Password &amp; Continue</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelPasswordChange}
                        disabled={changingPassword}
                        className="w-full py-2.5 px-4 rounded-ui-btn border border-ui-border hover:border-ui-border-strong bg-ui-surface hover:bg-ui-surface-subtle text-ui-ink-secondary font-nunito text-xs font-bold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus disabled:opacity-50"
                      >
                        Cancel &amp; Sign Out
                      </button>
                    </motion.div>
                  </form>
                </motion.div>
              ) : (
                /* ========================================================= */
                /* STEP 1: STANDARD SIGN-IN VIEW                             */
                /* ========================================================= */
                <motion.div
                  key="signin-step"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                >
                  {/* Card Heading */}
                  <motion.div variants={itemVariants} className="mb-6">
                    <h1 className="font-baloo font-extrabold text-2xl sm:text-[28px] text-ui-ink m-0 leading-tight">
                      Sign in
                    </h1>
                    <p className="text-xs sm:text-sm text-ui-ink-secondary m-0 mt-1 leading-relaxed">
                      Enter your MSWDO, CDC Teacher, or Parent credentials.
                    </p>
                  </motion.div>

                  {/* Accessible Alert Banner (Errors, Pending Approval, Declined, or Welcome Success) */}
                  <AnimatePresence>
                    {msg.text && (
                      <motion.div
                        key={msg.text}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        role={msg.type === 'error' ? 'alert' : 'status'}
                        aria-live={msg.type === 'error' ? 'assertive' : 'polite'}
                        className={`mb-5 p-3.5 rounded-ui-input border text-xs sm:text-[13px] font-bold leading-relaxed flex items-start gap-2.5 ${
                          alertVariant === 'ok'
                            ? 'bg-status-ok-bg border-status-ok-border text-status-ok'
                            : alertVariant === 'warn'
                              ? 'bg-status-warn-bg border-status-warn-border text-status-warn'
                              : 'bg-status-error-bg border-status-error-border text-status-error'
                        }`}
                      >
                        <Icon
                          name={
                            alertVariant === 'ok'
                              ? 'check-circle'
                              : alertVariant === 'warn'
                                ? 'clock'
                                : 'alert-circle'
                          }
                          size={18}
                          className="shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div>{msg.text}</div>
                          {alertVariant === 'warn' && (
                            <div className="text-[11px] font-semibold opacity-90 mt-0.5">
                              Once your assigned CDC teacher approves your registration, you can sign in right away.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Sign-In Form */}
                  <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
                    {/* Identifier Field */}
                    <motion.div variants={itemVariants}>
                      <label
                        htmlFor="identifier"
                        className="block font-bold text-xs sm:text-[13px] text-ui-ink mb-1.5"
                      >
                        Teacher ID, Mobile Number, or Email
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ui-ink-muted">
                          <Icon name="user" size={17} />
                        </span>
                        <input
                          id="identifier"
                          name="identifier"
                          type="text"
                          autoComplete="username"
                          required
                          disabled={loading || isSuccess}
                          placeholder="e.g. TCH-01, 09171234567, or name@email.com"
                          value={identifier}
                          onChange={(e) => {
                            setIdentifier(e.target.value);
                            if (msg.type === 'error') setMsg({ text: '', type: '' });
                          }}
                          onBlur={() => setTouched((prev) => ({ ...prev, identifier: true }))}
                          aria-invalid={Boolean(identifierError)}
                          aria-describedby={identifierError ? 'identifier-error identifier-hint' : 'identifier-hint'}
                          className={`w-full pl-10 pr-4 py-3 rounded-ui-input border bg-ui-surface-subtle font-nunito text-sm text-ui-ink placeholder:text-ui-ink-muted/75 transition-all outline-none focus:bg-ui-surface focus-visible:border-ui-focus focus-visible:shadow-focus-ring disabled:opacity-60 ${
                            identifierError
                              ? 'border-status-error shadow-error-ring'
                              : 'border-ui-border hover:border-ui-border-strong'
                          }`}
                        />
                      </div>

                      {identifierError ? (
                        <p
                          id="identifier-error"
                          className="mt-1.5 mb-0 text-xs font-bold text-status-error flex items-center gap-1.5"
                          role="alert"
                        >
                          <Icon name="alert-circle" size={13} />
                          <span>{identifierError}</span>
                        </p>
                      ) : null}

                      <p
                        id="identifier-hint"
                        className="text-[11.5px] text-ui-ink-muted mt-1.5 mb-0 flex items-start gap-1.5 leading-snug"
                      >
                        <Icon name="info" size={13} className="text-brand-leaf-deep shrink-0 mt-0.5" />
                        <span>
                          Teachers: enter your Teacher ID. Parents: enter your registered mobile number or email.
                        </span>
                      </p>
                    </motion.div>

                    {/* Password Field */}
                    <motion.div variants={itemVariants}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label
                          htmlFor="password"
                          className="block font-bold text-xs sm:text-[13px] text-ui-ink"
                        >
                          Password
                        </label>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ui-ink-muted">
                          <Icon name="lock" size={17} />
                        </span>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          disabled={loading || isSuccess}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (msg.type === 'error') setMsg({ text: '', type: '' });
                          }}
                          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                          onKeyUp={handleKeyCapCheck}
                          onKeyDown={handleKeyCapCheck}
                          aria-invalid={Boolean(passwordError)}
                          aria-describedby={passwordError ? 'password-error' : undefined}
                          className={`w-full pl-10 pr-11 py-3 rounded-ui-input border bg-ui-surface-subtle font-nunito text-sm text-ui-ink placeholder:text-ui-ink-muted/75 transition-all outline-none focus:bg-ui-surface focus-visible:border-ui-focus focus-visible:shadow-focus-ring disabled:opacity-60 ${
                            passwordError
                              ? 'border-status-error shadow-error-ring'
                              : 'border-ui-border hover:border-ui-border-strong'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          disabled={loading}
                          className="absolute inset-y-0 right-0 px-3.5 flex items-center text-[11px] font-extrabold uppercase tracking-wider text-brand-forest hover:text-brand-forest-deep rounded-r-ui-input focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus cursor-pointer bg-transparent border-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? 'HIDE' : 'SHOW'}
                        </button>
                      </div>

                      {passwordError && (
                        <p
                          id="password-error"
                          className="mt-1.5 mb-0 text-xs font-bold text-status-error flex items-center gap-1.5"
                          role="alert"
                        >
                          <Icon name="alert-circle" size={13} />
                          <span>{passwordError}</span>
                        </p>
                      )}

                      {/* Caps Lock Indicator */}
                      <AnimatePresence>
                        {capsLockOn && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            role="status"
                            aria-live="polite"
                            className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-status-warn-bg border border-status-warn-border text-status-warn text-xs font-bold"
                          >
                            <Icon name="arrow-big-up" size={15} className="shrink-0" />
                            <span>Caps Lock is ON — passwords are case-sensitive.</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Remember me + Forgot password */}
                    <motion.div variants={itemVariants} className="flex items-center justify-between gap-2 text-xs pt-0.5">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none text-ui-ink-secondary font-semibold">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded border-ui-border text-brand-forest focus:ring-brand-forest cursor-pointer"
                        />
                        <span>Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotHelp((v) => !v)}
                        className="font-bold text-brand-forest hover:text-brand-forest-deep hover:underline bg-transparent border-none p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus rounded"
                      >
                        Forgot password?
                      </button>
                    </motion.div>

                    <AnimatePresence>
                      {showForgotHelp && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3 rounded-xl bg-ui-surface-subtle border border-ui-border text-xs text-ui-ink-secondary leading-relaxed"
                        >
                          Parents may request a password reset from their assigned{' '}
                          <span className="font-bold text-ui-ink">Day Care Teacher</span>; teachers and staff may contact the{' '}
                          <span className="font-bold text-ui-ink">MSWDO Administrator</span>.
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit Button */}
                    <motion.div variants={itemVariants} className="pt-1">
                      <button
                        type="submit"
                        disabled={loading || isSuccess}
                        className={`w-full py-3.5 px-5 min-h-12 rounded-xl border-none font-baloo text-base font-bold tracking-wide text-white cursor-pointer transition-all active:scale-[0.99] shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus focus-visible:ring-offset-2 disabled:opacity-65 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                          isSuccess
                            ? 'bg-status-ok'
                            : 'bg-brand-forest hover:bg-brand-forest-deep'
                        }`}
                      >
                        {loading ? (
                          <>
                            <Icon name="loader" size={18} className="animate-spin" />
                            <span>Signing in...</span>
                          </>
                        ) : isSuccess ? (
                          <>
                            <Icon name="check-circle" size={18} />
                            <span>Signed In — Opening Dashboard...</span>
                          </>
                        ) : (
                          <span>Sign in</span>
                        )}
                      </button>
                    </motion.div>

                    {/* Or Divider */}
                    <motion.div variants={itemVariants} className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-ui-border" />
                      <span className="text-xs font-bold text-ui-ink-muted uppercase">Or</span>
                      <div className="h-px flex-1 bg-ui-border" />
                    </motion.div>

                    {/* Outlined Secondary Button: Register as a parent */}
                    <motion.div variants={itemVariants}>
                      <Link
                        to="/signup"
                        className="w-full py-3 px-5 rounded-xl border border-ui-border bg-white hover:bg-ui-surface-subtle text-ui-ink font-baloo text-sm font-bold flex items-center justify-center gap-2 no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
                      >
                        <span>Register as a parent</span>
                      </Link>
                    </motion.div>
                  </form>

                  {/* Don't have an account? Sign Up */}
                  <motion.div
                    variants={itemVariants}
                    className="mt-5 text-center text-xs text-ui-ink-secondary font-semibold"
                  >
                    Don&apos;t have an account?{' '}
                    <Link
                      to="/signup"
                      className="font-extrabold text-brand-forest hover:text-brand-forest-deep no-underline hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
                    >
                      Sign Up
                    </Link>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </motion.div>
    </div>
  );
}
