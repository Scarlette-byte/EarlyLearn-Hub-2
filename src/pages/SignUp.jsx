import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function SignUp() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (password !== confirmPassword) {
      setMsg({ text: '⚠️ Passwords do not match.', type: 'error' });
      return;
    }

    setLoading(true);

    // Step 1: Create the auth account
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setMsg({ text: '❌ ' + error.message, type: 'error' });
      setLoading(false);
      return;
    }

    // Step 2: Create the profile row (default role = student)
    const user = data.user;
    if (user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName.trim(),
        role: 'student',
      });

      if (profileError) {
        setMsg({
          text: '⚠️ Account created but there was a profile error: ' + profileError.message,
          type: 'error',
        });
        setLoading(false);
        return;
      }
    }

    setMsg({ text: '✅ Account created! Redirecting to login...', type: 'ok' });
    setTimeout(() => navigate('/login'), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-x-hidden relative bg-gradient-to-b from-sky-deep via-sky to-[#BEE7FF] font-nunito">
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

      <div className="safe-x relative z-10 bg-cream w-full max-w-[380px] my-6 px-7 sm:px-6 pt-9 sm:pt-7 pb-7 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-br from-sun to-coral text-[28px] mb-3">
          🌻
        </div>
        <h1 className="font-baloo text-[22px] text-ink m-0 mb-0.5">Create an Account</h1>
        <p className="text-[12.5px] text-ink-soft m-0 mb-5">
          EarlyLearn Hub — Manolo Fortich, Bukidnon
        </p>

        <form onSubmit={handleSubmit} className="text-left">
          <label htmlFor="fullName" className="block font-bold text-[12.5px] text-ink mt-3 mb-1.5">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            required
            placeholder="Juan Dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
          />
          <p className="text-[11.5px] text-ink-soft mt-1">
            ⚠️ Please use your REAL name so the Admin can verify you.
          </p>

          <label htmlFor="email" className="block font-bold text-[12.5px] text-ink mt-3 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-[13px] border-2 border-[#E6E6E6] font-nunito text-base outline-none focus:border-sky-deep"
          />

          <label htmlFor="password" className="block font-bold text-[12.5px] text-ink mt-3 mb-1.5">
            Password
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

          <label
            htmlFor="confirmPassword"
            className="block font-bold text-[12.5px] text-ink mt-3 mb-1.5"
          >
            Confirm Password
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 py-3 min-h-12 border-none rounded-[15px] bg-leaf text-white font-baloo text-base font-bold cursor-pointer hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <p className="text-[11.5px] text-ink-soft mt-1.5">
            📢 <strong>Teachers:</strong> after signing up, please message the Admin (using your
            real name) to get verified and have your role updated to "teacher".
          </p>

          {msg.text && (
            <p
              className={`text-[13px] font-semibold text-center min-h-4 mt-3 ${
                msg.type === 'error' ? 'text-coral-deep' : 'text-[#2f9e44]'
              }`}
            >
              {msg.text}
            </p>
          )}
        </form>

        <Link
          to="/login"
          className="block mt-4.5 text-[13px] text-sky-deep no-underline font-bold hover:underline"
        >
          ⬅ Back to Log In
        </Link>
      </div>
    </div>
  );
}
