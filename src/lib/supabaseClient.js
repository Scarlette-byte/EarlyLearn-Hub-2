import { createClient } from '@supabase/supabase-js';

// ============================================================
// Same Supabase project used across the whole app.
// Values are read from environment variables (see .env.example).
// Falls back to the values that were hard-coded in the original
// static HTML pages, so the app keeps working out of the box.
// ============================================================
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://igdhovaqbntalbrgzebu.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZGhvdmFxYm50YWxicmd6ZWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU4ODcsImV4cCI6MjEwMjg3MTg4N30.B2crr9hPhgcCg9tRvcCDaHmkBO2DhNLA44M555E-qSA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
 * Normalizes an email or a Philippine mobile phone number into a format
 * that works seamlessly with Supabase Auth for users without an email address.
 * E.g., '09123456789' or '+639123456789' -> '09123456789@earlylearn.ph'
 */
export function normalizeAuthIdentifier(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return { authEmail: '', isPhone: false, display: '' };

  if (trimmed.includes('@')) {
    return {
      authEmail: trimmed.toLowerCase(),
      isPhone: false,
      display: trimmed,
    };
  }

  const digits = trimmed.replace(/\D/g, '');
  let cleanMobile = digits;

  if (cleanMobile.startsWith('63') && cleanMobile.length === 12) {
    cleanMobile = '0' + cleanMobile.slice(2);
  } else if (cleanMobile.length === 10 && cleanMobile.startsWith('9')) {
    cleanMobile = '0' + cleanMobile;
  }

  return {
    authEmail: `${cleanMobile}@earlylearn.ph`,
    isPhone: true,
    display: cleanMobile,
    rawDigits: digits,
  };
}
