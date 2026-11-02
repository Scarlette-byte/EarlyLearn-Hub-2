-- =====================================================================
-- EarlyLearn Hub — Database Relationships & Row Level Security (RLS)
-- Municipality of Manolo Fortich, Bukidnon (MSWDO ECCD Portal)
-- =====================================================================
-- Instructions:
-- Run this script in the Supabase SQL Editor to ensure all foreign-key
-- relationships, registration/approval columns, and Row Level Security
-- (RLS) policies are properly configured.
-- =====================================================================

-- 1. Ensure optional columns exist on existing tables (non-destructive)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS cdc_name text,
  ADD COLUMN IF NOT EXISTS contact_number text;

ALTER TABLE IF EXISTS public.teachers
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true;

ALTER TABLE IF EXISTS public.learners
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS parent_contact text;

-- 2. Ensure Foreign Key Relationships (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teachers_cdc_id_fkey'
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_cdc_id_fkey
      FOREIGN KEY (cdc_id) REFERENCES public.cdcs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learners_cdc_id_fkey'
  ) THEN
    ALTER TABLE public.learners
      ADD CONSTRAINT learners_cdc_id_fkey
      FOREIGN KEY (cdc_id) REFERENCES public.cdcs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Enable Row Level Security (RLS) across all core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 4. Helper function to check user role from public.profiles
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    'student'
  );
$$;

-- =====================================================================
-- 5. RLS POLICIES FOR `profiles`
-- =====================================================================
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users and admins/teachers can insert profiles" ON public.profiles;
CREATE POLICY "Users and admins/teachers can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    auth.uid() = id
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  );

DROP POLICY IF EXISTS "Users can update own profile or admin/teacher can update" ON public.profiles;
CREATE POLICY "Users can update own profile or admin/teacher can update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  );

-- =====================================================================
-- 6. RLS POLICIES FOR `teachers`
-- (Readable by anon so parents can verify Teacher Registration Codes on /signup)
-- =====================================================================
DROP POLICY IF EXISTS "Teachers readable for registration code verification" ON public.teachers;
CREATE POLICY "Teachers readable for registration code verification"
  ON public.teachers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers can manage teacher records" ON public.teachers;
CREATE POLICY "Admins and teachers can manage teacher records"
  ON public.teachers FOR ALL
  TO authenticated
  USING (
    auth.uid() = id
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  )
  WITH CHECK (
    auth.uid() = id
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  );

-- =====================================================================
-- 7. RLS POLICIES FOR `learners`
-- =====================================================================
DROP POLICY IF EXISTS "Learners readable by authenticated users" ON public.learners;
CREATE POLICY "Learners readable by authenticated users"
  ON public.learners FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Parents and teachers can insert learner registrations" ON public.learners;
CREATE POLICY "Parents and teachers can insert learner registrations"
  ON public.learners FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Teachers, admins, and owners can update learners" ON public.learners;
CREATE POLICY "Teachers, admins, and owners can update learners"
  ON public.learners FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  );

-- =====================================================================
-- 8. RLS POLICIES FOR `cdcs`, `materials`, `submissions`, `announcements`
-- =====================================================================
DROP POLICY IF EXISTS "CDCs readable by all" ON public.cdcs;
CREATE POLICY "CDCs readable by all"
  ON public.cdcs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Materials readable by authenticated users" ON public.materials;
CREATE POLICY "Materials readable by authenticated users"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers and admins can manage materials" ON public.materials;
CREATE POLICY "Teachers and admins can manage materials"
  ON public.materials FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'superadmin', 'teacher'))
  WITH CHECK (public.get_my_role() IN ('admin', 'superadmin', 'teacher'));

DROP POLICY IF EXISTS "Submissions readable by authenticated users" ON public.submissions;
CREATE POLICY "Submissions readable by authenticated users"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  );

DROP POLICY IF EXISTS "Students and teachers can insert and update submissions" ON public.submissions;
CREATE POLICY "Students and teachers can insert and update submissions"
  ON public.submissions FOR ALL
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'superadmin', 'teacher')
  );

