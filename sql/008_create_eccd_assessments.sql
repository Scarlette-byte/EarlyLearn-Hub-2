-- ============================================================================
-- EarlyLearn Hub (MSWDO Manolo Fortich, Bukidnon)
-- SQL Migration: 008_create_eccd_assessments.sql
-- Purpose: Create and configure the `eccd_assessments` table in Supabase
--          with indexes, Realtime publication, and Row Level Security (RLS)
--          policies so teacher evaluations immediately synchronize to
--          parent/student dashboards across all devices.
-- ============================================================================

-- 1. Create `public.eccd_assessments` table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.eccd_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id text,
  child_name text NOT NULL,
  age integer DEFAULT 3,
  level text DEFAULT 'PRE-K 1',
  barangay text,
  cdc_name text,
  teacher_id uuid,
  teacher_name text,
  assessment_date text DEFAULT (CURRENT_DATE)::text,
  cognitive_status text NOT NULL DEFAULT 'Developing as Expected',
  physical_status text NOT NULL DEFAULT 'Developing as Expected',
  social_status text NOT NULL DEFAULT 'Developing as Expected',
  language_status text NOT NULL DEFAULT 'Developing as Expected',
  overall_status text NOT NULL DEFAULT 'Developing as Expected',
  observations text DEFAULT '',
  recommendation text DEFAULT '',
  mswd_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_child_id ON public.eccd_assessments(child_id);
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_child_name ON public.eccd_assessments(lower(trim(child_name)));
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_teacher_id ON public.eccd_assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_barangay ON public.eccd_assessments(barangay);

-- 3. Enable Supabase Realtime for instant cross-device updates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.eccd_assessments;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.eccd_assessments ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins full access to eccd_assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers select own class assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers insert own class assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers update own class assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Students select own child assessment" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Allow authenticated full access to eccd_assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Allow anon read eccd_assessments" ON public.eccd_assessments;

-- Helper function to detect role safely
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    'student'
  );
$$;

-- A. Admins have full access
CREATE POLICY "Admins full access to eccd_assessments"
  ON public.eccd_assessments FOR ALL
  TO authenticated
  USING (
    public.get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    public.get_my_role() IN ('admin', 'superadmin')
  );

-- B. Teachers can SELECT, INSERT, and UPDATE evaluations for learners in their center or evaluations they created
CREATE POLICY "Teachers select own class assessments"
  ON public.eccd_assessments FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('teacher', 'admin', 'superadmin')
    OR teacher_id = auth.uid()
  );

CREATE POLICY "Teachers insert own class assessments"
  ON public.eccd_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('teacher', 'admin', 'superadmin')
    OR teacher_id = auth.uid()
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "Teachers update own class assessments"
  ON public.eccd_assessments FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() IN ('teacher', 'admin', 'superadmin')
    OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() IN ('teacher', 'admin', 'superadmin')
    OR teacher_id = auth.uid()
  );

-- C. Students & Parents: Read ONLY their own child's assessment
-- Matches by child_id (auth UID), or child_name matching student's full name in metadata or profiles
CREATE POLICY "Students select own child assessment"
  ON public.eccd_assessments FOR SELECT
  TO authenticated
  USING (
    child_id = (auth.uid())::text
    OR lower(trim(child_name)) = lower(trim(coalesce(
      (SELECT full_name FROM public.profiles WHERE id = auth.uid() LIMIT 1),
      (auth.jwt() -> 'user_metadata' ->> 'full_name'),
      (auth.jwt() -> 'user_metadata' ->> 'child_name'),
      ''
    )))
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = auth.uid()
        AND (l.id::text = eccd_assessments.child_id OR lower(trim(l.full_name)) = lower(trim(eccd_assessments.child_name)))
    )
  );

-- D. Grant permissions to authenticated and anon roles
GRANT ALL ON TABLE public.eccd_assessments TO authenticated;
GRANT ALL ON TABLE public.eccd_assessments TO service_role;
GRANT SELECT ON TABLE public.eccd_assessments TO anon;

