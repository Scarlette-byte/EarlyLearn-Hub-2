import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMsg({ text: '❌ ' + error.message, type: 'error' });
      setLoading(false);
      return;
    }

    const user = data.user;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      setMsg({
        text: '⚠️ Login ok, but no profile record was found. Check the setup guide.',
        type: 'error',
      });
      setLoading(false);
      return;
    }

    setMsg({ text: `✅ Welcome, ${profile.full_name || user.email}!`, type: 'ok' });

    setTimeout(() => {
      if (profile.role === 'admin') navigate('/admin-dashboard');
      else if (profile.role === 'teacher') navigate('/teacher-dashboard');
      else navigate('/student-dashboard');
    }, 900);
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

      <div className="animate-pop safe-x relative z-10 bg-cream w-full max-w-[380px] my-6 p-8 sm:p-10 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center">
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
          <label htmlFor="email" className="block font-bold text-[13px] sm:text-xs text-ink mt-3.5 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-3 rounded-2xl border-2 border-[#E6E6E6] font-nunito text-base outline-none transition-colors focus:border-sky-deep"
          />

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
              className={`mt-3.5 text-[13.5px] font-semibold text-center min-h-[18px] ${
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
          Don't have an account? Sign Up here
        </Link>
      </div>
    </div>
  );
}
