import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, supabaseSecondaryAuth, normalizeAuthIdentifier } from '../lib/supabaseClient';
import { getEffectiveRole } from '../lib/roles.js';
import { syncStudentLogin, getStudentApprovalStatus } from '../lib/learnersService.js';
import { resolveTeacherForLogin, getTeacherSyncedCredential } from '../lib/teacherAuthService.js';
import PineappleLogo from '../components/PineappleLogo.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

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

    // Resolve teacher candidate emails (e.g. TCH-81, ANDRESA.ALLOSO, 0939-430-5411 -> andresa.alloso@earlylearn.ph)
    const teacherMatch = await resolveTeacherForLogin(trimmedInput);
    const candidateEmails = Array.from(
      new Set(
        [
          teacherMatch?.email,
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

    // Auto-heal with admin-set temporary password if sign in failed
    if (!authSuccessData) {
      const syncedCred =
        (await getTeacherSyncedCredential(trimmedInput)) ||
        (teacherMatch?.email ? await getTeacherSyncedCredential(teacherMatch.email) : null) ||
        (await getTeacherSyncedCredential(authEmail));

      if (syncedCred && syncedCred.temporary_password === password) {
        // Teacher entered the exact temporary password set by Admin!
        // Auto-register/heal their Supabase Auth user:
        const primaryEmail = syncedCred.email || teacherMatch?.email || authEmail;
        const teacherName = syncedCred.full_name || teacherMatch?.full_name || 'Teacher';

        await supabaseSecondaryAuth.auth.signUp({
          email: primaryEmail,
          password: password,
          options: {
            data: {
              role: 'teacher',
              full_name: teacherName,
              teacher_id: syncedCred.teacher_id || teacherMatch?.id,
              barangay: syncedCred.barangay || teacherMatch?.barangay,
              cdc_name: syncedCred.cdc_name || teacherMatch?.cdc_name,
              contact_number: syncedCred.contact_number || teacherMatch?.contact_number,
              must_change_password: true,
            },
          },
        });

        // Now sign in with the freshly initialized auth user
        const { data: retryData, error: retryErr } = await supabase.auth.signInWithPassword({
          email: primaryEmail,
          password,
        });

        if (!retryErr && retryData?.user) {
          authSuccessData = retryData;
        } else {
          // If the user already existed in auth.users with an earlier password, sign in with previous password and auto-update
          const candidateOldPasswords = Array.isArray(syncedCred.previous_passwords)
            ? syncedCred.previous_passwords
            : [];
          for (const oldPass of candidateOldPasswords) {
            const { data: oldData, error: oldErr } = await supabase.auth.signInWithPassword({
              email: primaryEmail,
              password: oldPass,
            });
            if (!oldErr && oldData?.user) {
              // Successfully signed in with previous password! Auto-update to the new active password:
              try {
                await supabase.auth.updateUser({ password });
              } catch {}
              authSuccessData = oldData;
              break;
            }
          }
          if (!authSuccessData) {
            lastError = retryErr || lastError;
          }
        }
      }
    }

    if (!authSuccessData) {
      setMsg({ text: '❌ ' + (lastError?.message || 'Invalid login credentials. Please check your username/ID and password.'), type: 'error' });
      setLoading(false);
      return;
    }

    const user = authSuccessData.user;
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Auto-heal missing profile row using metadata (only existing profiles columns)
      const metaRole = user.user_metadata?.role || 'student';
      const metaName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      const metaBarangay = user.user_metadata?.barangay || null;
      const metaCdc = user.user_metadata?.cdc_name || null;
      const metaContact = user.user_metadata?.contact_number || null;
      const dbRole =
        metaRole === 'teacher'
          ? 'teacher'
          : metaRole === 'admin' || metaRole === 'superadmin'
            ? 'admin'
            : 'student';

      const { data: createdProf } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: metaName,
          role: dbRole,
          barangay: metaBarangay,
          cdc_name: metaCdc,
          contact_number: metaContact,
        })
        .select('*')
        .single();

      profile = createdProf || {
        id: user.id,
        role: dbRole,
        full_name: metaName,
        barangay: metaBarangay,
        cdc_name: metaCdc,
        contact_number: metaContact,
      };
    }

    const effectiveRole = getEffectiveRole({
      ...(profile || {}),
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    });

    // Enforce Teacher Approval for Parent/Student accounts before allowing access
    if (effectiveRole === 'student' || (!effectiveRole && profile?.role === 'student')) {
      try {
        const approvalInfo = await getStudentApprovalStatus(user, profile);
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

        await syncStudentLogin(user, profile);
      } catch (err) {
        console.warn('Could not sync student login to teacher dashboard:', err);
      }
    }

    const roleTag = effectiveRole === 'superadmin' ? ' • Superadmin' : '';
    setMsg({ text: `✅ Welcome, ${profile.full_name || user.email}!${roleTag}`, type: 'ok' });

    setTimeout(() => {
      if (effectiveRole === 'superadmin' || effectiveRole === 'admin') {
        navigate('/admin-dashboard');
      } else if (effectiveRole === 'teacher') {
        navigate('/teacher-dashboard');
      } else {
        navigate('/student-dashboard');
      }
    }, 700);
  }

  const [showPassword, setShowPassword] = useState(false);

  return (
        <div className="min-h-screen min-h-[100dvh] flex items-center justify-center overflow-x-hidden relative bg-[#FFFBEA]/60 font-nunito">
          {/* Soft pastel ambient background shapes matching brand reference */}
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Soft yellow pastel curve top-left */}
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#FFD34E]/25 blur-3xl" />
            {/* Soft green pastel curve bottom-right */}
            <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#78BD58]/20 blur-3xl" />
            {/* Little decorative stars & shapes */}
            <span className="absolute top-[12%] left-[10%] text-amber-300 text-3xl select-none opacity-70">⭐</span>
            <span className="absolute top-[24%] right-[12%] text-amber-300 text-2xl select-none opacity-60">✨</span>
            <span className="absolute bottom-[16%] left-[8%] text-emerald-400 text-3xl select-none opacity-50">🌱</span>
            <span className="absolute bottom-[20%] right-[10%] text-rose-300 text-2xl select-none opacity-50">🎈</span>
          </div>

              <div className="animate-pop safe-x relative z-10 bg-white w-full max-w-[400px] my-6 p-7 sm:p-9 rounded-[32px] shadow-[0_16px_50px_rgba(43,36,28,0.08)] border border-[#F4EEDF] text-center">
                {/* Official Pineapple Logo */}
                <div className="mb-3 flex justify-center">
                  <PineappleLogo variant="vertical" size="lg" />
                </div>

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
              className={`mt-3 text-xs font-bold text-center min-h-[18px] leading-snug p-2.5 rounded-xl ${msg.type === 'error'
                                    ? 'bg-rose-50 text-[#F46D70] border border-rose-200'
                                    : 'bg-emerald-50 text-[#78BD58] border border-emerald-200'
                                  }`}
                              >
                                {msg.text}
                              </p>
                            )}
                          </form>

                          <div className="mt-5 pt-4 border-t border-[#F0EBE0] space-y-2">
                            <Link
                              to="/signup"
                              className="block text-xs text-[#F46D70] no-underline font-extrabold hover:underline"
                            >
                              Don't have an account? Sign Up here
                            </Link>
                            <Link
                              to="/"
                              className="block text-[11.5px] text-[#7A6B52] no-underline font-bold hover:text-[#2B241C] hover:underline"
                            >
                              ← Back to EarlyLearn Hub
                            </Link>
                          </div>
                        </div>
                      </div>
                      );
}
