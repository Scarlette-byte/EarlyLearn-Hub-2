import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, normalizeAuthIdentifier } from '../lib/supabaseClient';
import { getEffectiveRole } from '../lib/roles.js';
import { syncStudentLogin, getStudentApprovalStatus } from '../lib/learnersService.js';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    const { authEmail } = normalizeAuthIdentifier(identifier);
    if (!authEmail) {
      setMsg({
        text: '⚠️ Please enter your Teacher ID, mobile phone number, or email address.',
        type: 'error',
      });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      setMsg({ text: '❌ ' + error.message, type: 'error' });
      setLoading(false);
      return;
    }

    const user = data.user;
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

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center overflow-x-hidden relative bg-gradient-to-b from-sky-deep via-sky to-[#BEE7FF] font-nunito">
      {/* Signature illustration: sun rising over Bukidnon hills */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="cloud cloud-1" />
        <div className="cloud cloud-2" />
        <div
          className="animate-rise absolute top-[8%] left-1/2 -translate-x-1/2 w-40 h-40 sm:w-[120px] sm:h-[120px] rounded-full shadow-[0_0_60px_20px_rgba(255,217,61,0.5)]"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, #FFF3B0, #FFD93D 60%, #FFC93D 100%)',
          }}
        />
        <div className="absolute bottom-0 left-0 w-full h-[42%] max-[560px]:hidden">
          <div className="absolute -bottom-2.5 w-[130%] -left-[15%] h-full bg-[#5BB86A] opacity-55 rounded-t-[50%]" />
          <div className="absolute -bottom-5 w-[140%] -left-[20%] h-[80%] bg-leaf rounded-t-[50%]" />
        </div>
      </div>

      <div className="animate-pop safe-x relative z-10 bg-cream w-full max-w-[390px] my-6 p-8 sm:p-10 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-14 sm:h-14 rounded-[20px] bg-gradient-to-br from-sun to-coral text-3xl mb-3.5">
          🌻
        </div>
        <h1 className="font-baloo text-2xl sm:text-[21px] text-ink m-0 mb-0.5">
          EarlyLearn Hub
        </h1>
        <p className="text-[13px] sm:text-xs text-ink-soft m-0 mb-6 sm:mb-5">
          Manolo Fortich, Bukidnon
        </p>

        <form onSubmit={handleSubmit} className="text-left">
          <label
            htmlFor="identifier"
            className="block font-bold text-[13px] sm:text-xs text-ink mt-3.5 mb-1.5"
          >
            Teacher ID, Mobile Number, or Email
          </label>
          <div className="relative">
            <input
              id="identifier"
              type="text"
              required
              placeholder="TCH-2026-001, 09123456789, or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3.5 py-3 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-base outline-none transition-colors focus:border-sky-deep pr-10"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-ink-soft text-sm">
              🔑
            </div>
          </div>
          <p className="text-[11px] text-ink-soft mt-1">
            💡 Teachers: use your Teacher ID &amp; temporary password. Parents: use your registered mobile number or email.
          </p>

          <label
            htmlFor="password"
            className="block font-bold text-[13px] sm:text-xs text-ink mt-3.5 mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-3 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-base outline-none transition-colors focus:border-sky-deep"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-[13px] min-h-12 border-none rounded-2xl bg-coral text-white font-baloo text-[17px] sm:text-base font-bold cursor-pointer transition-all hover:bg-coral-deep active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          {msg.text && (
            <p
              className={`mt-3.5 text-[13px] font-semibold text-center min-h-[18px] leading-snug ${
                msg.type === 'error' ? 'text-coral-deep' : 'text-[#2f9e44]'
              }`}
            >
              {msg.text}
            </p>
          )}
        </form>

        <Link
          to="/signup"
          className="block mt-4.5 text-[13px] text-sky-deep no-underline font-bold hover:underline"
        >
          Parent with a Teacher Code? Sign Up here
        </Link>
        <Link
          to="/"
          className="block mt-2.5 text-[12px] text-ink-soft no-underline font-semibold hover:text-ink hover:underline"
        >
          ← Back to EarlyLearn Hub
        </Link>
      </div>
    </div>
  );
}
