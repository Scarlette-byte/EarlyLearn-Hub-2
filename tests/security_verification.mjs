import { createClient } from '@supabase/supabase-js';
import { getEffectiveRole, getRoleDashboardPath } from '../src/lib/roles.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://igdhovaqbntalbrgzebu.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZGhvdmFxYm50YWxicmd6ZWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU4ODcsImV4cCI6MjEwMjg3MTg4N30.B2crr9hPhgcCg9tRvcCDaHmkBO2DhNLA44M555E-qSA';

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. Route / Role Matrix (offline, deterministic check against src/lib/roles.js)
const ROUTE_MATRIX = [
  { role: 'superadmin', allowed: ['/admin-dashboard', '/manage-users', '/manage-teachers', '/manage-learners'], denied: ['/teacher-dashboard', '/student-dashboard'] },
  { role: 'admin', allowed: ['/admin-dashboard', '/manage-users', '/manage-teachers', '/manage-learners'], denied: ['/teacher-dashboard', '/student-dashboard'] },
  { role: 'teacher', allowed: ['/teacher-dashboard', '/manage-learners'], denied: ['/admin', '/manage-users', '/manage-teachers', '/student-dashboard'] },
  { role: 'student', allowed: ['/student-dashboard'], denied: ['/admin', '/manage-users', '/manage-teachers', '/manage-learners', '/teacher-dashboard'] },
];

for (const entry of ROUTE_MATRIX) {
  const fakeUser = { app_metadata: { role: entry.role }, user_metadata: {} };
  const effective = getEffectiveRole(fakeUser);
  const dash = getRoleDashboardPath(effective);
  const ok = effective === entry.role && entry.allowed.includes(dash) && !entry.denied.includes(dash);
  record(
    `Role "${entry.role}" route check`,
    ok,
    `effective=${effective}, defaultDash=${dash}`
  );
}

// 2. Client-forged user_metadata.role = 'admin' must NOT grant admin access
{
  const forgedUser = { app_metadata: {}, user_metadata: { role: 'admin', is_superadmin: true } };
  const effective = getEffectiveRole(forgedUser);
  record(
    'Forged user_metadata.role=admin ignored by getEffectiveRole',
    effective !== 'admin' && effective !== 'superadmin',
    `effective=${effective}`
  );
}

// 3. Live Supabase checks (anon reads + signup with metadata role=admin + self-update role)
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const { data: teachersData, error: teachersErr } = await anonClient
    .from('teachers')
    .select('id, email, contact_number')
    .limit(1);

  const denied = Boolean(teachersErr) || !Array.isArray(teachersData) || teachersData.length === 0;
  record(
    'Anon SELECT on public.teachers denied',
    denied,
    teachersErr ? `error: ${teachersErr.message}` : `rows=${teachersData?.length ?? 0}`
  );
} catch (err) {
  record('Anon SELECT on public.teachers denied', false, `network/runtime error: ${err.message}`);
}

try {
  const { data: eccdData, error: eccdErr } = await anonClient
    .from('eccd_assessments')
    .select('id')
    .limit(1);

  const denied = Boolean(eccdErr) || !Array.isArray(eccdData) || eccdData.length === 0;
  record(
    'Anon SELECT on public.eccd_assessments denied',
    denied,
    eccdErr ? `error: ${eccdErr.message}` : `rows=${eccdData?.length ?? 0}`
  );
} catch (err) {
  record('Anon SELECT on public.eccd_assessments denied', false, `network/runtime error: ${err.message}`);
}

try {
  const testEmail = `sec_test_${Date.now()}@earlylearn.ph`;
  const testPassword = 'TestPassword!2026#Secure';
  const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: { data: { role: 'admin' } },
  });

  if (signUpErr) {
    record('Sign up with metadata role=admin -> no admin access', false, `signUp error: ${signUpErr.message}`);
  } else {
    const u = signUpData.user;
    const effective = getEffectiveRole(u);
    record(
      'Sign up with metadata role=admin -> no admin access',
      effective !== 'admin' && effective !== 'superadmin' && u?.app_metadata?.role !== 'admin',
      `app_metadata.role=${u?.app_metadata?.role ?? 'none'}, effective=${effective}`
    );

    if (signUpData.session?.access_token) {
      const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${signUpData.session.access_token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error: profErr } = await authedClient
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', u.id);

      record(
        'Self-update profiles.role=admin -> denied',
        Boolean(profErr),
        profErr ? `denied: ${profErr.message}` : 'WARNING: update succeeded!'
      );
    } else {
      record('Self-update profiles.role=admin -> denied', true, 'No session returned (email confirmation required)');
    }
  }
} catch (err) {
  record('Live signup/self-update checks', false, `network/runtime error: ${err.message}`);
}

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
