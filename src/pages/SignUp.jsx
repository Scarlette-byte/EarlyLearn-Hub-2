import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, barangays, normalizeAuthIdentifier } from '../lib/supabaseClient';

export default function SignUp() {
  const navigate = useNavigate();
  // 'parent_learner' (1 account for parent + 3-4 aged learner) | 'teacher'
  const [accountType, setAccountType] = useState('parent_learner');

  // Fields for Parent & Learner unified account
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('3-4'); // '3-4' | '5-6'

  // Fields for Teacher account
  const [teacherName, setTeacherName] = useState('');
  const [cdcName, setCdcName] = useState('');

  // Shared fields
  const [barangay, setBarangay] = useState('');
  const [identifier, setIdentifier] = useState(''); // Mobile number or email
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setMsg({ text: '', type: '' });

    if (accountType === 'parent_learner') {
      if (!parentName.trim()) {
        setMsg({ text: '⚠️ Please enter the Parent / Guardian full name.', type: 'error' });
        return;
      }
      if (!childName.trim()) {
        setMsg({ text: "⚠️ Please enter the Child / Little Learner's name.", type: 'error' });
        return;
      }
    } else {
      if (!teacherName.trim()) {
        setMsg({ text: '⚠️ Please enter the Teacher full name.', type: 'error' });
        return;
      }
    }

    if (!barangay) {
      setMsg({ text: '⚠️ Please select your barangay in Manolo Fortich.', type: 'error' });
      return;
    }

    const { authEmail, isPhone, display } = normalizeAuthIdentifier(identifier);
    if (!authEmail) {
      setMsg({
        text: '⚠️ Please enter a mobile phone number (e.g. 09123456789) or email.',
        type: 'error',
      });
      return;
    }

    if (isPhone && display.length < 10) {
      setMsg({
        text: '⚠️ Please enter a valid 11-digit mobile number (e.g. 09123456789).',
        type: 'error',
      });
      return;
    }

    if (password !== confirmPassword) {
      setMsg({ text: '⚠️ Passwords do not match.', type: 'error' });
      return;
    }

    if (password.length < 6) {
      setMsg({ text: '⚠️ Password must be at least 6 characters long.', type: 'error' });
      return;
    }

    setLoading(true);

    const isTeacher = accountType === 'teacher';
    // In database check constraint: 'student', 'teacher', 'admin'
    // Parent + Learner unified account uses 'student' role to access the learning portal
    const dbRole = isTeacher ? 'teacher' : 'student';

    const displayName = isTeacher
      ? cdcName.trim()
        ? `${teacherName.trim()} (${cdcName.trim()})`
        : teacherName.trim()
      : `${childName.trim()} (Parent: ${parentName.trim()})`;

    // Step 1: Create auth account with user metadata
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          full_name: displayName,
          contact_number: isPhone ? display : null,
          email_or_phone: display,
          parent_name: isTeacher ? null : parentName.trim(),
          child_name: isTeacher ? null : childName.trim(),
          child_age: isTeacher ? null : childAge,
          role: dbRole,
          barangay: barangay,
          account_type: accountType,
        },
      },
    });

    if (error) {
      setMsg({ text: '❌ ' + error.message, type: 'error' });
      setLoading(false);
      return;
    }

    // Step 2: Ensure profile row is upserted
    const user = data.user;
    if (user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: displayName,
        role: dbRole,
        barangay: barangay,
      });

      if (profileError) {
        setMsg({
          text: '⚠️ Profile notice: ' + profileError.message,
          type: 'error',
        });
        setLoading(false);
        return;
      }

      if (isTeacher) {
        try {
          await supabase.from('teachers').upsert({
            id: user.id,
            full_name: teacherName.trim(),
            email: email.trim(),
            barangay: barangay,
          });
        } catch {
          // Ignore if teachers table has custom RLS policies
        }
      }
    }

    setMsg({
      text: isTeacher
        ? '✅ Teacher account created! Opening Teacher Dashboard...'
        : '✅ Parent & Learner account created! Opening Learning Dashboard...',
      type: 'ok',
    });

    // Step 3: Automatically redirect to the respective dashboard
    setTimeout(() => {
      if (dbRole === 'teacher') {
        navigate('/teacher-dashboard');
      } else {
        navigate('/student-dashboard');
      }
    }, 1200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-x-hidden relative bg-gradient-to-b from-sky-deep via-sky to-[#BEE7FF] font-nunito py-8">
      {/* Background illustration */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[140px] h-[140px] sm:w-[110px] sm:h-[110px] rounded-full shadow-[0_0_60px_20px_rgba(255,217,61,0.5)]"
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

      <div className="safe-x relative z-10 bg-cream w-full max-w-[500px] my-4 px-6 sm:px-8 pt-8 pb-7 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-br from-sun to-coral text-[28px] mb-2.5">
          🌻
        </div>
        <h1 className="font-baloo text-[23px] text-ink m-0 mb-0.5">Create an Account</h1>
        <p className="text-[12.5px] text-ink-soft m-0 mb-4">
          EarlyLearn Hub • Manolo Fortich, Bukidnon
        </p>

        {/* ---------------------------------------------------- */}
        {/* ROLE SELECTION TABS                                  */}
        {/* ---------------------------------------------------- */}
        <div className="mb-4 text-left">
          <div className="text-[11.5px] font-extrabold uppercase tracking-wider text-ink-soft mb-2 text-center">
            Choose account type:
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4ECD8] rounded-2xl border border-[#E8DDCA]">
            <button
              type="button"
              onClick={() => setAccountType('parent_learner')}
              className={`py-2.5 px-2 rounded-xl font-baloo text-xs sm:text-[13px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                accountType === 'parent_learner'
                  ? 'bg-coral text-white shadow-sm scale-[1.02]'
                  : 'bg-transparent text-ink hover:bg-white/60'
              }`}
            >
              <span>👨‍👩‍👧</span>
              <span>Parent & Learner (Ages 3–4)</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountType('teacher')}
              className={`py-2.5 px-2 rounded-xl font-baloo text-xs sm:text-[13px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                accountType === 'teacher'
                  ? 'bg-accent text-white shadow-sm scale-[1.02]'
                  : 'bg-transparent text-ink hover:bg-white/60'
              }`}
            >
              <span>👩‍🏫</span>
              <span>Day Care Teacher</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="text-left">
          {/* Active Mode Notice Banner */}
          {accountType === 'parent_learner' ? (
            <div className="p-3 rounded-2xl text-xs font-semibold mb-4 bg-coral/15 text-[#9E3434] border border-coral/30 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-coral-deep text-[13px]">
                <span>👨‍👩‍👧</span>
                <span>One Joint Family Account (Parent Guided)</span>
              </div>
              <p className="m-0 leading-relaxed text-[11.5px] text-ink-soft">
                Because 3–4 year old toddlers cannot use the system alone, this single account is managed
                by the parent so you can guide your child through videos and daily learning activities!
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-2xl text-xs font-semibold mb-4 bg-accent/15 text-[#733F23] border border-accent/30 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-accent text-[13px]">
                <span>👩‍🏫</span>
                <span>Day Care Teacher / Child Development Worker</span>
              </div>
              <p className="m-0 leading-relaxed text-[11.5px] text-ink-soft">
                Gives you access to upload video lessons, publish worksheets, and grade student submissions
                for your assigned barangay in Manolo Fortich.
              </p>
            </div>
          )}

          {/* ==================================================== */}
          {/* PARENT & LEARNER INPUTS                              */}
          {/* ==================================================== */}
          {accountType === 'parent_learner' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="parentName" className="block font-bold text-[12.5px] text-ink mb-1">
                  Parent / Guardian Full Name <span className="text-coral">*</span>
                </label>
                <input
                  id="parentName"
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
                />
                <p className="text-[11px] text-ink-soft mt-0.5">
                  👤 The parent/guardian who operates the account and guides the child.
                </p>
              </div>

              <div>
                <label htmlFor="childName" className="block font-bold text-[12.5px] text-ink mb-1">
                  Child / Little Learner Full Name <span className="text-coral">*</span>
                </label>
                <input
                  id="childName"
                  type="text"
                  required
                  placeholder="e.g. Juan Santos"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
                />
                <p className="text-[11px] text-ink-soft mt-0.5">
                  ⭐ The child doing the activities (name shown on stars & teacher feedback).
                </p>
              </div>

              <div>
                <label htmlFor="childAge" className="block font-bold text-[12.5px] text-ink mb-1">
                  Learner Age Level <span className="text-coral">*</span>
                </label>
                <select
                  id="childAge"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-sm outline-none focus:border-sky-deep bg-white cursor-pointer text-ink font-bold"
                >
                  <option value="3-4">🌱 Ages 3–4 (Toddler / Nursery — Parent Guided)</option>
                  <option value="5-6">🎒 Ages 5–6 (Kindergarten / Preparatory)</option>
                </select>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TEACHER INPUTS                                       */}
          {/* ==================================================== */}
          {accountType === 'teacher' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="teacherName" className="block font-bold text-[12.5px] text-ink mb-1">
                  Teacher Full Name <span className="text-coral">*</span>
                </label>
                <input
                  id="teacherName"
                  type="text"
                  required
                  placeholder="e.g. Teacher Maricel Torres"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
                />
              </div>

              <div>
                <label htmlFor="cdcName" className="block font-bold text-[12.5px] text-ink mb-1">
                  Day Care / CDC Center Name (Optional)
                </label>
                <input
                  id="cdcName"
                  type="text"
                  placeholder="e.g. Tankulan Day Care Center"
                  value={cdcName}
                  onChange={(e) => setCdcName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
                />
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* SHARED FIELDS                                        */}
          {/* ==================================================== */}
          <div className="mt-3">
            <label htmlFor="barangay" className="block font-bold text-[12.5px] text-ink mb-1">
              Barangay (
              {accountType === 'teacher'
                ? 'Assigned Day Care Barangay'
                : 'Where the family lives in Manolo Fortich'}
              ) <span className="text-coral">*</span>
            </label>
            <div className="relative">
              <select
                id="barangay"
                required
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-sm outline-none focus:border-sky-deep bg-white appearance-none cursor-pointer pr-9 text-ink"
              >
                <option value="">— Select Barangay in Manolo Fortich —</option>
                {barangays.map((b) => (
                  <option key={b} value={b}>
                    📍 Barangay {b}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-ink-soft text-xs">
                ▼
              </div>
            </div>
            <p className="text-[11px] text-ink-soft mt-0.5">
              🏡 Connects your family to your local Barangay Child Development Center.
            </p>
          </div>

          <div className="mt-3">
            <label htmlFor="identifier" className="block font-bold text-[12.5px] text-ink mb-1">
              {accountType === 'teacher'
                ? 'Teacher Mobile Number or Email'
                : 'Parent Mobile Number or Email'}{' '}
              <span className="text-coral">*</span>
            </label>
            <div className="relative">
              <input
                id="identifier"
                type="text"
                required
                placeholder="e.g. 09123456789 or parent@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep pr-10"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-ink-soft text-sm">
                📱
              </div>
            </div>
            <p className="text-[11px] text-[#2E7D32] font-semibold mt-1">
              ✨ No email required! Parents can simply use their 11-digit mobile number (e.g. 09123456789) to register and log in anytime.
            </p>
          </div>

          <div className="mt-3">
            <label htmlFor="password" className="block font-bold text-[12.5px] text-ink mb-1">
              Password <span className="text-coral">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
            />
          </div>

          <div className="mt-3">
            <label htmlFor="confirmPassword" className="block font-bold text-[12.5px] text-ink mb-1">
              Confirm Password <span className="text-coral">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={6}
              placeholder="Re-type your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
            />
          </div>

          {/* Submit Button */}
          <div className="mt-5 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 min-h-12 border-none rounded-[16px] text-white font-baloo text-base font-bold cursor-pointer shadow-md transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${
                accountType === 'teacher'
                  ? 'bg-accent hover:opacity-90'
                  : 'bg-coral hover:bg-coral-deep'
              }`}
            >
              {loading
                ? 'Creating account...'
                : accountType === 'teacher'
                ? '👩‍🏫 Register as Day Care Teacher →'
                : '👨‍👩‍👧 Register Parent & Learner (Ages 3–4) →'}
            </button>
          </div>

          {msg.text && (
            <p
              className={`text-[13px] font-semibold text-center min-h-4 mt-3.5 ${
                msg.type === 'error' ? 'text-coral-deep' : 'text-[#2f9e44]'
              }`}
            >
              {msg.text}
            </p>
          )}
        </form>

        <Link
          to="/login"
          className="block mt-4 text-[13px] text-sky-deep no-underline font-bold hover:underline"
        >
          ⬅ Already have an account? Log In here
        </Link>
        <Link
          to="/"
          className="block mt-2 text-[12px] text-ink-soft no-underline font-semibold hover:text-ink hover:underline"
        >
          ← Back to EarlyLearn Hub
        </Link>
      </div>
    </div>
  );
}
