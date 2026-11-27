import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, barangays, normalizeAuthIdentifier } from '../lib/supabaseClient';
import PineappleLogo from '../components/PineappleLogo.jsx';
import {
  verifyTeacherRegistrationCode,
  getTeachersForBarangay,
  buildDefaultTeacherCode,
  recordRegisteredLearner,
  packLearnerContactMeta,
  cleanStudentName,
  isValidUuid,
} from '../lib/learnersService.js';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../lib/passwordPolicy.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import Icon from '../components/Icons.jsx';
import { PlayfulIcon } from '../components/KidIllustrations.jsx';

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
  const [consentAccepted, setConsentAccepted] = useState(false);

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
    const trimmed = String(codeToVerify || '').trim().toUpperCase().replace(/\s+/g, '');
    setCodeError('');
    if (!trimmed) {
      setVerifiedTeacher(null);
      setCodeError('Please enter the registration code provided by your assigned Day Care Teacher.');
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
      setCodeError(
        result?.message ||
          'Invalid registration code. Please check the code from your assigned Day Care Teacher.'
      );
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
          text: 'Please enter a valid Teacher Registration Code before registering.',
          type: 'error',
        });
        return;
      }
    }

    const cleanChild = cleanStudentName(childName);
    const cleanParent = parentName.trim();

    if (!cleanParent || !cleanChild) {
      setMsg({
        text: 'Please enter both Parent/Guardian and Child full names.',
        type: 'error',
      });
      return;
    }

    const { authEmail, display } = normalizeAuthIdentifier(identifier);
    if (!authEmail) {
      setMsg({
        text: 'Please enter a valid mobile phone number or email address.',
        type: 'error',
      });
      return;
    }

    const pwCheck = validatePassword(password, {
      identifiers: [identifier, parentName, childName],
    });
    if (!pwCheck.valid) {
      setMsg({
        text: pwCheck.errors[0],
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

    // 2. Register parent/learner in Supabase Auth with approval_status = 'pending' (public sign-up is strictly student/parent only)
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          full_name: cleanChild,
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
          class_id: isValidUuid(matchedTeacher.classId) ? matchedTeacher.classId : null,
          registration_code: matchedTeacher.code,
          approval_status: 'pending',
        },
      },
    });

    if (error) {
      setMsg({ text: error.message, type: 'error' });
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
            ? '4 to 4.11 years (Pre-K2)'
            : '3 to 3.11 years (Pre-K1)',
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
        <div className="min-h-screen min-h-[100dvh] bg-ui-panel text-ui-ink font-nunito flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-x-hidden selection:bg-brand-yellow/40 selection:text-ui-ink">
          {/* Full-Screen Playful Preschool Learning Landscape Background */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <img
              src="/login-landscape-bg.png"
              alt=""
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#0D2B1E]/65 via-[#123B29]/50 to-[#1B5139]/60 backdrop-blur-[2px]" />
          </div>

          {/* Centered Wide Rounded Card matching Login.jsx */}
          <div className="relative z-10 w-full max-w-4xl bg-ui-surface rounded-3xl shadow-2xl border border-white/15 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* LEFT HALF: BRAND-GRADIENT PANEL */}
            <aside
              aria-label="Program information"
              className="lg:col-span-5 relative overflow-hidden bg-ui-panel text-white flex flex-col justify-between p-6 sm:p-8 lg:p-9 min-h-[200px] lg:min-h-[560px]"
            >
              <img
                src="/login-landscape-bg.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-[#0D2B1E]/85 via-[#123B29]/75 to-[#1B5139]/80"
              />
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
                  Register as a parent or guardian to access your child&apos;s Day Care Center activities, flashcards, and progress records.
                </p>
              </div>
              <div className="relative z-10 hidden lg:flex items-center gap-2 text-[11px] text-white/75 font-semibold pt-4 border-t border-white/15">
                <Icon name="shield" size={14} className="text-brand-yellow shrink-0" />
                <span>Municipality of Manolo Fortich • MSWDO ECCD</span>
              </div>
            </aside>

            {/* RIGHT HALF: WHITE SIGN-UP FORM PANEL */}
            <main className="lg:col-span-7 bg-ui-surface p-6 sm:p-8 lg:p-9 relative overflow-hidden flex flex-col justify-center text-center">
              <div className="relative z-10 w-full">
                  <h1 className="font-baloo font-extrabold text-2xl sm:text-[26px] text-ui-ink m-0 mb-1">
                    Create Your Account
                  </h1>
                    <p className="text-xs text-ui-muted m-0 mb-5 font-semibold">
                      Join EarlyLearn Hub • Manolo Fortich, Bukidnon
                    </p>

                    {submittedPendingInfo ? (
                      <div className="text-left bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-xs space-y-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                            <Icon name="clock" size={20} label="Pending approval" />
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
                              className="flex items-center gap-1.5 font-bold text-[12.5px] text-ink"
                            >
                              <Icon name="key" size={14} className="text-amber-700" />
                              <span>Teacher Registration Code <span className="text-coral">*</span></span>
                            </label>
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
                            <div className="mt-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11.5px] font-bold text-rose-700 flex items-center gap-1.5">
                              <Icon name="warning" size={14} className="shrink-0" />
                              <span>{codeError}</span>
                            </div>
                          )}

                          {verifiedTeacher && verifiedTeacher.valid && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-[#EDF7ED] border border-[#B7DFB9] text-xs text-[#1E5624] space-y-1">
                              <div className="font-bold flex items-center gap-1.5">
                                <Icon name="check-circle" size={14} className="text-emerald-700 shrink-0" />
                                <span>Verified Teacher Code:</span>
                                <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  {verifiedTeacher.code}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Icon name="teachers" size={14} className="shrink-0" />
                                <strong>{verifiedTeacher.teacherName}</strong>
                              </div>
                              <div className="text-[11px] opacity-90 flex items-center gap-1.5">
                                <Icon name="school" size={13} className="shrink-0" />
                                <span>{verifiedTeacher.cdcName} • Brgy. {verifiedTeacher.barangay}</span>
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
                              <option value="3-3.11">3 to 3.11 years (Pre-K1)</option>
                              <option value="4-4.11">4 to 4.11 years (Pre-K2)</option>
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
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-ink-soft">
                            <Icon name="smartphone" size={16} />
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
                          minLength={PASSWORD_MIN_LENGTH}
                          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-sm bg-white outline-none transition-colors focus:border-sky-deep"
                        />
                        <PasswordStrengthMeter
                          password={password}
                          identifiers={[identifier, parentName, childName]}
                        />

                        <label className="mt-3 flex items-start gap-2 text-[11px] text-[#5C4E3C] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            required
                            checked={consentAccepted}
                            onChange={(e) => setConsentAccepted(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I accept the <strong>Data Privacy Notice</strong> and consent to the collection and processing of my child&apos;s enrollment and ECCD records for the current school year.
                          </span>
                        </label>

                        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                          <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-amber-700" />
                          <span>
                            <strong>Teacher Approval Required:</strong> After registering, your assigned teacher will review and approve your account before you can access your child&apos;s dashboard.
                          </span>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full mt-4 py-3 min-h-12 border-none rounded-2xl bg-[#F46D70] hover:bg-[#E65A5D] text-white font-baloo text-base font-extrabold cursor-pointer transition-all active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Submitting Registration...' : 'Sign Up'}
                        </button>

                        {msg.text && (
                          <p
                            className={`mt-3 text-xs font-bold text-center min-h-[18px] leading-snug p-2.5 rounded-xl flex items-center justify-center gap-1.5 ${
                              msg.type === 'error'
                                ? 'bg-rose-50 text-[#F46D70] border border-rose-200'
                                : 'bg-emerald-50 text-[#78BD58] border border-emerald-200'
                            }`}
                          >
                            <Icon name={msg.type === 'error' ? 'alert-circle' : 'check-circle'} size={15} className="shrink-0" />
                            <span>{msg.text}</span>
                          </p>
                        )}
                      </form>
                    )}

                      <div className="mt-4 pt-3 border-t border-[#F0EBE0] text-[11px] text-[#7A6B52] flex items-start gap-1.5 text-left">
                        <Icon name="teachers" size={14} className="mt-0.5 shrink-0 text-[#7A6B52]" />
                        <span>
                          <strong>Child Development Teachers:</strong> Teacher accounts are issued by MSWDO Administrator with an official Teacher ID.
                        </span>
                      </div>

                      <div className="mt-3">
                        <Link
                          to="/login"
                          className="block text-xs text-[#1B5139] no-underline font-extrabold hover:underline"
                        >
                          Already have an account? Log In here
                        </Link>
                      </div>
                    </div>
                  </main>
                  </div>
                </div>
                  );
}
