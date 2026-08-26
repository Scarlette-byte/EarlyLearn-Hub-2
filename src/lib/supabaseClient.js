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
