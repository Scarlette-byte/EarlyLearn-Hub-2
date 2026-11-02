import { createClient } from '@supabase/supabase-js';

// ============================================================
// Same Supabase project used across the whole app.
// Values are read from environment variables (see .env.example).
// Falls back to the values that were hard-coded in the original
// static HTML pages, so the app keeps working out of the box.
// ============================================================
export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://igdhovaqbntalbrgzebu.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZGhvdmFxYm50YWxicmd6ZWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU4ODcsImV4cCI6MjEwMjg3MTg4N30.B2crr9hPhgcCg9tRvcCDaHmkBO2DhNLA44M555E-qSA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Secondary non-persisting Supabase client used when an authenticated Admin creates a Teacher account
 * or an authenticated Teacher creates a Parent/Learner account, ensuring the active session
 * in the browser is never overwritten or signed out.
 */
export const supabaseSecondaryAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'earlylearn-secondary-auth-client',
  },
});

// Barangay list (Manolo Fortich, Bukidnon) — shared by Admin & Teacher dashboards
export const barangays = [
  'Agusan Canyon',
  'Alae',
  'Dahilayan',
  'Dalirig',
  'Damilag',
  'Dicklum',
  'Guilang-guilang',
  'Kalugmanan',
  'Lindaban',
  'Lingion',
  'Lunocan',
  'Maluko',
  'Mambatangan',
  'Mampayag',
  'Mantibugao',
  'Minsuro',
  'San Miguel',
  'Sankanan',
  'Santiago',
  'Santo Niño',
  'Tankulan (Poblacion)',
  'Ticala',
];

/**
 * Normalizes a Teacher ID, Philippine mobile phone number, or email address into a format
 * that works seamlessly with Supabase Auth.
 * - Email: 'user@example.com' -> 'user@example.com'
 * - Mobile Phone: '09123456789' or '+639123456789' -> '09123456789@earlylearn.ph'
 * - Teacher ID: 'TCH-2026-001' -> 'tch-2026-001@earlylearn.ph'
 */
export function normalizeAuthIdentifier(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { authEmail: '', isPhone: false, isTeacherId: false, teacherId: null, display: '' };
  }

  if (trimmed.includes('@')) {
    const lower = trimmed.toLowerCase();
    const prefix = lower.split('@')[0];
    const isSyntheticTeacher = lower.endsWith('@earlylearn.ph') && /[a-z]/i.test(prefix);
    return {
      authEmail: lower,
      isPhone: false,
      isTeacherId: isSyntheticTeacher,
      teacherId: isSyntheticTeacher ? prefix.toUpperCase() : null,
      display: isSyntheticTeacher ? prefix.toUpperCase() : trimmed,
    };
  }

  // Check if input is a phone number (only digits, spaces, +, -, parentheses)
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  const digits = trimmed.replace(/\D/g, '');

  if (!hasLetters && digits.length >= 7) {
    let cleanMobile = digits;

    if (cleanMobile.startsWith('63') && cleanMobile.length === 12) {
      cleanMobile = '0' + cleanMobile.slice(2);
    } else if (cleanMobile.length === 10 && cleanMobile.startsWith('9')) {
      cleanMobile = '0' + cleanMobile;
    }

    return {
      authEmail: `${cleanMobile}@earlylearn.ph`,
      isPhone: true,
      isTeacherId: false,
      teacherId: null,
      display: cleanMobile,
      rawDigits: digits,
    };
  }

  // Otherwise treat as a Teacher ID (e.g., TCH-2026-001, TCH-DALIRIG-01, etc.)
  const cleanTeacherId = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    authEmail: `${cleanTeacherId}@earlylearn.ph`,
    isPhone: false,
    isTeacherId: true,
    teacherId: trimmed.toUpperCase(),
    display: trimmed.toUpperCase(),
  };
}
