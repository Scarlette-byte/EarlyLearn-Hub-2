import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, barangays, normalizeAuthIdentifier } from '../lib/supabaseClient';
import {
  verifyTeacherRegistrationCode,
  getTeachersForBarangay,
  buildDefaultTeacherCode,
  recordRegisteredLearner,
  packLearnerContactMeta,
  cleanStudentName,
  isValidUuid,
} from '../lib/learnersService.js';

export default function SignUp() {
  // Teacher Registration Code state
  const [registrationCode, setRegistrationCode] = useState('');
  const [verifiedTeacher, setVerifiedTeacher] = useState(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Optional helper for parents who need to look up their Barangay's teacher code
  const [showCodeHelper, setShowCodeHelper] = useState(false);
  const [helperBarangay, setHelperBarangay] = useState('');
  const [helperTeachers, setHelperTeachers] = useState([]);

  // Parent & Child Registration Fields
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('3-3.11');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [submittedPendingInfo, setSubmittedPendingInfo] = useState(null);

  // Load teachers for helper dropdown when barangay is chosen
  useEffect(() => {
    let active = true;
    if (!helperBarangay) {
      setHelperTeachers([]);
      return;
    }
    getTeachersForBarangay(helperBarangay).then((list) => {
      if (active) setHelperTeachers(list || []);
    });
    return () => {
      active = false;
    };
  }, [helperBarangay]);

  async function handleVerifyCode(codeToVerify = registrationCode) {
    const trimmed = (codeToVerify || '').trim().toUpperCase();
    setCodeError('');
    if (!trimmed) {
      setVerifiedTeacher(null);
      setCodeError('Please enter the registration code provided by your assigned teacher.');
      return null;
    }

    setVerifyingCode(true);
    const result = await verifyTeacherRegistrationCode(trimmed);
    setVerifyingCode(false);

    if (result && result.valid) {
      setVerifiedTeacher(result);
      setRegistrationCode(result.code || trimmed);
      setCodeError('');
      return result;
    } else {
      setVerifiedTeacher(null);
      setCodeError('Invalid registration code. Please check the code from your assigned teacher.');
      return null;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    // 1. Validate Teacher Registration Code
    let matchedTeacher = verifiedTeacher;
    if (!matchedTeacher || !matchedTeacher.valid) {
      matchedTeacher = await handleVerifyCode(registrationCode);
      if (!matchedTeacher || !matchedTeacher.valid) {
        setMsg({
          text: '⚠️ Please enter a valid Teacher Registration Code before registering.',
          type: 'error',
        });
        return;
      }
    }

    const cleanChild = cleanStudentName(childName);
    const cleanParent = parentName.trim();

    if (!cleanParent || !cleanChild) {
      setMsg({
        text: '⚠️ Please enter both Parent/Guardian and Child full names.',
        type: 'error',
      });
      return;
    }

    const { authEmail, display } = normalizeAuthIdentifier(identifier);
    if (!authEmail) {
      setMsg({
        text: '⚠️ Please enter a valid mobile phone number or email address.',
        type: 'error',
      });
      return;
    }

    if (!password || password.length < 6) {
      setMsg({
        text: '⚠️ Password must be at least 6 characters long.',
        type: 'error',
      });
      return;
    }

    setLoading(true);

    const assignedBarangay = matchedTeacher.barangay;
    const assignedCdcName =
      matchedTeacher.cdcName || `${assignedBarangay} Child Development Center`;
    const assignedTeacherName = matchedTeacher.teacherName;
    const assignedTeacherId = matchedTeacher.teacherId;
    const assignedCdcId = isValidUuid(matchedTeacher.cdcId) ? matchedTeacher.cdcId : null;

    // 2. Register user in Supabase Auth with approval_status = 'pending'
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          full_name: cleanChild,
          role: 'student',
          barangay: assignedBarangay,
          contact_number: display,
          email_or_phone: display,
          parent_name: cleanParent,
          child_name: cleanChild,
          child_age: childAge,
          teacher_id: assignedTeacherId,
          adviser_name: assignedTeacherName,
          teacher_name: assignedTeacherName,
          cdc_name: assignedCdcName,
          cdc_id: assignedCdcId,
          registration_code: matchedTeacher.code,
          approval_status: 'pending',
        },
      },
    });

    if (error) {
      setMsg({ text: '❌ ' + error.message, type: 'error' });
      setLoading(false);
      return;
    }

    const createdUserId = data?.user?.id;
    const packedContact = packLearnerContactMeta(display, {
      approval_status: 'pending',
      teacher_id: assignedTeacherId,
      adviser_name: assignedTeacherName,
      cdc_name: assignedCdcName,
      child_age: childAge,
      registration_code: matchedTeacher.code,
    });

    // 3. Save profile to Supabase `profiles` table
    if (createdUserId) {
      try {
        await supabase.from('profiles').upsert({
          id: createdUserId,
          full_name: cleanChild,
          role: 'student',
          barangay: assignedBarangay,
          cdc_name: assignedCdcName,
          contact_number: packedContact,
        });
      } catch (profErr) {
        console.warn('Profile upsert warning:', profErr);
      }
    }

    // 4. Save learner to Supabase `learners` table with approval_status = 'pending'
    try {
      await recordRegisteredLearner({
        id: createdUserId,
        full_name: cleanChild,
        birthdate:
          childAge === '4-4.11'
            ? '4 to 4.11 months (Pre-K2)'
            : '3 to 3.11 months (Pre-K1)',
        child_age: childAge,
        barangay: assignedBarangay,
        parent_name: cleanParent,
        parent_contact: display,
        adviser_name: assignedTeacherName,
        teacher_id: assignedTeacherId,
        cdc_name: assignedCdcName,
        cdc_id: assignedCdcId,
        registration_code: matchedTeacher.code,
        approval_status: 'pending',
      });
    } catch (lrnErr) {
      console.warn('Learner sync warning:', lrnErr);
    }

    // 5. Sign out the pending session so the parent cannot bypass teacher approval
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    setLoading(false);
    setSubmittedPendingInfo({
      parentName: cleanParent,
      childName: cleanChild,
      identifier: display,
      teacherName: assignedTeacherName,
      cdcName: assignedCdcName,
      barangay: assignedBarangay,
      code: matchedTeacher.code,
    });
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center overflow-x-hidden relative bg-gradient-to-b from-sky-deep via-sky to-[#BEE7FF] font-nunito py-6">
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

      <div className="animate-pop safe-x relative z-10 bg-cream w-full max-w-[440px] my-4 p-7 sm:p-9 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-[20px] bg-gradient-to-br from-sun to-coral text-3xl mb-2.5">
          🌱
        </div>
        <h1 className="font-baloo text-2xl sm:text-[21px] text-ink m-0 mb-0.5">
          Parent &amp; Learner Registration
        </h1>
        <p className="text-[12.5px] text-ink-soft m-0 mb-5">
          EarlyLearn Hub • Manolo Fortich, Bukidnon
        </p>

        {submittedPendingInfo ? (
          <div className="text-left bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0">
                ⏳
              </div>
              <div>
                <h2 className="font-baloo text-lg text-ink m-0 leading-tight">
                  Waiting for Teacher Approval
                </h2>
                <p className="text-xs text-ink-soft m-0">
                  Registration saved to EarlyLearn Hub
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed m-0">
              Your parent and learner account has been registered using code{' '}
              <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded">
                {submittedPendingInfo.code}
              </span>
              . Before you can access your child&apos;s dashboard, your assigned teacher must approve your account.
            </p>

            <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#E5DAC4] text-xs space-y-1.5">
              <div>
                <span className="text-slate-500">Child / Learner:</span>{' '}
                <strong className="text-slate-900">{submittedPendingInfo.childName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Parent / Guardian:</span>{' '}
                <strong className="text-slate-900">{submittedPendingInfo.parentName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Login ID:</span>{' '}
                <strong className="font-mono text-slate-900">{submittedPendingInfo.identifier}</strong>
              </div>
              <div>
                <span className="text-slate-500">Assigned Teacher:</span>{' '}
                <strong className="text-emerald-800">{submittedPendingInfo.teacherName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Day Care Center:</span>{' '}
                <strong className="text-slate-800">
                  {submittedPendingInfo.cdcName} (Brgy. {submittedPendingInfo.barangay})
                </strong>
              </div>
            </div>

            <Link
              to="/login"
              className="block w-full py-3 rounded-2xl bg-coral text-white font-baloo text-base font-bold text-center no-underline hover:bg-coral-deep transition-colors"
            >
              Go to Login Page →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="text-left">
            {/* STEP 1: Teacher Registration Code */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border-2 border-[#EED9B3] mb-3.5">
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="regCode"
                  className="block font-bold text-[12.5px] text-ink"
                >
                  🔑 Teacher Registration Code <span className="text-coral">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCodeHelper((v) => !v)}
                  className="text-[11px] font-bold text-sky-deep hover:underline bg-transparent border-none cursor-pointer"
                >
                  {showCodeHelper ? 'Hide Code Lookup' : 'Find My Teacher Code'}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  id="regCode"
                  type="text"
                  required
                  placeholder="e.g. ELH-DALIRIG-327F"
                  value={registrationCode}
                  onChange={(e) => {
                    setRegistrationCode(e.target.value.toUpperCase());
                    setVerifiedTeacher(null);
                    setCodeError('');
                  }}
                  onBlur={() => {
                    if (registrationCode.trim()) handleVerifyCode(registrationCode);
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-[#E6E6E6] font-mono text-sm font-bold uppercase text-ink bg-white outline-none focus:border-sky-deep"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyCode(registrationCode)}
                  disabled={verifyingCode}
                  className="px-3.5 py-2.5 rounded-xl bg-sky-deep text-white font-bold text-xs cursor-pointer hover:opacity-90 shrink-0 disabled:opacity-60"
                >
                  {verifyingCode ? 'Checking...' : 'Verify Code'}
                </button>
              </div>

              <p className="text-[11px] text-ink-soft mt-1 mb-0">
                Enter the unique registration code provided by your child&apos;s Day Care Teacher.
              </p>

              {codeError && (
                <div className="mt-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11.5px] font-bold text-rose-700">
                  ⚠️ {codeError}
                </div>
              )}

              {verifiedTeacher && verifiedTeacher.valid && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-[#EDF7ED] border border-[#B7DFB9] text-xs text-[#1E5624] space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>✅ Verified Teacher Code:</span>
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                      {verifiedTeacher.code}
                    </span>
                  </div>
                  <div>
                    👩‍🏫 <strong>{verifiedTeacher.teacherName}</strong>
                  </div>
                  <div className="text-[11px] opacity-90">
                    🏫 {verifiedTeacher.cdcName} • Brgy. {verifiedTeacher.barangay}
                  </div>
                </div>
              )}

              {/* Helper to look up Barangay Teacher Code */}
              {showCodeHelper && (
                <div className="mt-2.5 pt-2.5 border-t border-[#EED9B3] space-y-2">
                  <label className="block text-[11px] font-bold text-ink">
                    Select your Barangay to view your assigned Teacher&apos;s Code:
                  </label>
                  <select
                    value={helperBarangay}
                    onChange={(e) => setHelperBarangay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB8] text-xs bg-white text-ink outline-none"
                  >
                    <option value="">— Select Barangay —</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  {helperBarangay && helperTeachers.length > 0 && (
                    <div className="space-y-1.5">
                      {helperTeachers.map((t) => {
                        const code = t.registration_code || buildDefaultTeacherCode(t);
                        return (
                          <div
                            key={t.id}
                            className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate">
                                {t.full_name}
                              </div>
                              <div className="text-[10.5px] text-slate-500 font-mono">
                                Code: <strong>{code}</strong>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setRegistrationCode(code);
                                setShowCodeHelper(false);
                                handleVerifyCode(code);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer hover:bg-emerald-700 shrink-0"
                            >
                              Use Code
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 2: Parent & Child Information */}
            <label
              htmlFor="parentName"
              className="block font-bold text-[13px] sm:text-xs text-ink mt-2.5 mb-1"
            >
              Parent / Guardian Full Name <span className="text-coral">*</span>
            </label>
            <input
              id="parentName"
              type="text"
              required
              placeholder="e.g. Maria Dela Cruz"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-sm bg-white outline-none transition-colors focus:border-sky-deep"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5">
              <div className="sm:col-span-2">
                <label
                  htmlFor="childName"
                  className="block font-bold text-[13px] sm:text-xs text-ink mb-1"
                >
                  Child / Learner Full Name <span className="text-coral">*</span>
                </label>
                <input
                  id="childName"
                  type="text"
                  required
                  placeholder="e.g. Lucas Dela Cruz"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-sm bg-white outline-none transition-colors focus:border-sky-deep"
                />
              </div>

              <div>
                <label
                  htmlFor="childAge"
                  className="block font-bold text-[13px] sm:text-xs text-ink mb-1"
                >
                  Age Level
                </label>
                <select
                  id="childAge"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-sm bg-white outline-none transition-colors focus:border-sky-deep"
                >
                  <option value="3-3.11">3 to 3.11 months (Pre-K1)</option>
                  <option value="4-4.11">4 to 4.11 months (Pre-K2)</option>
                </select>
              </div>
            </div>

            {/* STEP 3: Login Identifier & Password */}
            <label
              htmlFor="identifier"
              className="block font-bold text-[13px] sm:text-xs text-ink mt-2.5 mb-1"
            >
              Mobile Phone Number or Email Address <span className="text-coral">*</span>
            </label>
            <div className="relative">
              <input
                id="identifier"
                type="text"
                required
                placeholder="09123456789 or parent@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-sm bg-white outline-none transition-colors focus:border-sky-deep pr-10"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-ink-soft text-sm">
                📱
              </div>
            </div>

            <label
              htmlFor="password"
              className="block font-bold text-[13px] sm:text-xs text-ink mt-2.5 mb-1"
            >
              Create Your Password <span className="text-coral">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-sm bg-white outline-none transition-colors focus:border-sky-deep"
            />

            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              🔒 <strong>Teacher Approval Required:</strong> After registering, your assigned teacher will review and approve your account before you can access your child&apos;s dashboard.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-[13px] min-h-12 border-none rounded-2xl bg-coral text-white font-baloo text-[17px] sm:text-base font-bold cursor-pointer transition-all hover:bg-coral-deep active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting Registration...' : 'Register Parent & Child Account'}
            </button>

            {msg.text && (
              <p
                className={`mt-3 text-[13px] font-semibold text-center min-h-[18px] ${
                  msg.type === 'error' ? 'text-coral-deep' : 'text-[#2f9e44]'
                }`}
              >
                {msg.text}
              </p>
            )}
          </form>
        )}

        <div className="mt-4 pt-3 border-t border-[#E8DFC8] text-[11.5px] text-ink-soft">
          👩‍🏫 <strong>Child Development Teachers:</strong> Teacher accounts are created and issued by the MSWDO Administrator using your official Teacher ID.
        </div>

        <Link
          to="/login"
          className="block mt-3 text-[13px] text-sky-deep no-underline font-bold hover:underline"
        >
          Already have an account? Log In
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
