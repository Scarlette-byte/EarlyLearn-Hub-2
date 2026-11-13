-- ============================================================================
-- EarlyLearn Hub (MSWDO Manolo Fortich, Bukidnon)
-- SQL Migration: 007_teacher_privacy.sql
-- Purpose: Enforce strict Row Level Security (RLS) on `eccd_assessments`,
--          `learners`, and `submissions` so each teacher only sees and edits
--          learners and assessments belonging to their own class/CDC, admins
--          have full municipal access, and parents read only their own child.
-- ============================================================================

-- 1. Ensure `eccd_assessments` table exists
CREATE TABLE IF NOT EXISTS public.eccd_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id text,
  child_name text NOT NULL,
  age integer DEFAULT 3,
  level text DEFAULT 'PRE-K 1',
  barangay text,
  cdc_name text,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_eccd_assessments_child_id ON public.eccd_assessments(child_id);
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_teacher_id ON public.eccd_assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_barangay ON public.eccd_assessments(barangay);

-- 2. Enable Row Level Security on all three tables
ALTER TABLE public.eccd_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 3. Security Definer Helper Functions (prevent recursive RLS evaluation)
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

CREATE OR REPLACE FUNCTION public.get_my_teacher_cdc_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.cdc_id
  FROM public.teachers t
  WHERE t.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_teacher_barangay()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT t.barangay FROM public.teachers t WHERE t.id = auth.uid() LIMIT 1),
    (SELECT p.barangay FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (auth.jwt() -> 'user_metadata' ->> 'barangay')
  );
$$;

-- ============================================================================
-- 4. RLS POLICIES FOR `public.learners`
-- ============================================================================
DROP POLICY IF EXISTS "Learners readable by authenticated users" ON public.learners;
DROP POLICY IF EXISTS "Authenticated users can insert learners" ON public.learners;
DROP POLICY IF EXISTS "Teachers, admins, and owners can update learners" ON public.learners;
DROP POLICY IF EXISTS "Admins full access to learners" ON public.learners;
DROP POLICY IF EXISTS "Teachers access own CDC learners" ON public.learners;
DROP POLICY IF EXISTS "Teachers insert own CDC learners" ON public.learners;
DROP POLICY IF EXISTS "Teachers update own CDC learners" ON public.learners;
DROP POLICY IF EXISTS "Students read own learner row" ON public.learners;
DROP POLICY IF EXISTS "Students insert own learner row" ON public.learners;
DROP POLICY IF EXISTS "Students update own learner row" ON public.learners;

-- Admins: full access
CREATE POLICY "Admins full access to learners"
  ON public.learners FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin', 'superadmin'));

-- Teachers: SELECT/INSERT/UPDATE only learners matching their own cdc_id in `teachers` (or assigned barangay when cdc_id is unset)
CREATE POLICY "Teachers access own CDC learners"
  ON public.learners FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND (
      (cdc_id IS NOT NULL AND cdc_id = public.get_my_teacher_cdc_id())
      OR (
        (cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
        AND lower(trim(coalesce(barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
      )
      OR parent_contact ILIKE ('%"teacher_id":"' || (auth.uid())::text || '"%')
    )
  );

CREATE POLICY "Teachers insert own CDC learners"
  ON public.learners FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND (
      (cdc_id IS NOT NULL AND cdc_id = public.get_my_teacher_cdc_id())
      OR (
        (cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
        AND lower(trim(coalesce(barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
      )
    )
  );

CREATE POLICY "Teachers update own CDC learners"
  ON public.learners FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND (
      (cdc_id IS NOT NULL AND cdc_id = public.get_my_teacher_cdc_id())
      OR (
        (cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
        AND lower(trim(coalesce(barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
      )
      OR parent_contact ILIKE ('%"teacher_id":"' || (auth.uid())::text || '"%')
    )
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND (
      (cdc_id IS NOT NULL AND cdc_id = public.get_my_teacher_cdc_id())
      OR (
        (cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
        AND lower(trim(coalesce(barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
      )
      OR parent_contact ILIKE ('%"teacher_id":"' || (auth.uid())::text || '"%')
    )
  );

-- Students/Parents: read only their own child's row (plus self-registration insert/update for own uid)
CREATE POLICY "Students read own learner row"
  ON public.learners FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND id = auth.uid()
  );

CREATE POLICY "Students insert own learner row"
  ON public.learners FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'student'
    AND id = auth.uid()
  );

CREATE POLICY "Students update own learner row"
  ON public.learners FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'student'
    AND id = auth.uid()
  );

-- ============================================================================
-- 5. RLS POLICIES FOR `public.eccd_assessments`
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage all eccd_assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers can view assigned learner assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers can insert assigned learner assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers can update assigned learner assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Parents can view only their own child assessment" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Admins full access to eccd_assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers select own class assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers insert own class assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Teachers update own class assessments" ON public.eccd_assessments;
DROP POLICY IF EXISTS "Students select own child assessment" ON public.eccd_assessments;

-- Admins: full access
CREATE POLICY "Admins full access to eccd_assessments"
  ON public.eccd_assessments FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin', 'superadmin'));

-- Teachers: SELECT/INSERT/UPDATE only assessments they created (teacher_id = auth.uid())
-- or where the learner's cdc_id matches their own cdc_id in `teachers`
CREATE POLICY "Teachers select own class assessments"
  ON public.eccd_assessments FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.learners l
        WHERE (l.id::text = eccd_assessments.child_id OR lower(trim(l.full_name)) = lower(trim(eccd_assessments.child_name)))
          AND (
            (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
            OR (
              (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
              AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
            )
          )
      )
    )
  );

CREATE POLICY "Teachers insert own class assessments"
  ON public.eccd_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.learners l
        WHERE (l.id::text = eccd_assessments.child_id OR lower(trim(l.full_name)) = lower(trim(eccd_assessments.child_name)))
          AND (
            (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
            OR (
              (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
              AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
            )
          )
      )
    )
  );

CREATE POLICY "Teachers update own class assessments"
  ON public.eccd_assessments FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.learners l
        WHERE (l.id::text = eccd_assessments.child_id OR lower(trim(l.full_name)) = lower(trim(eccd_assessments.child_name)))
          AND (
            (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
            OR (
              (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
              AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
            )
          )
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.learners l
        WHERE (l.id::text = eccd_assessments.child_id OR lower(trim(l.full_name)) = lower(trim(eccd_assessments.child_name)))
          AND (
            (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
            OR (
              (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
              AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
            )
          )
      )
    )
  );

-- Students/Parents: strictly READ-ONLY access to their own child's assessment
CREATE POLICY "Students select own child assessment"
  ON public.eccd_assessments FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND child_id = (auth.uid())::text
  );

-- ============================================================================
-- 6. RLS POLICIES FOR `public.submissions`
-- ============================================================================
DROP POLICY IF EXISTS "Submissions readable by authenticated users" ON public.submissions;
DROP POLICY IF EXISTS "Students and teachers can insert and update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins full access to submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teachers select own CDC submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teachers update own CDC submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students select own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students update own submissions" ON public.submissions;

-- Admins: full access
CREATE POLICY "Admins full access to submissions"
  ON public.submissions FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin', 'superadmin'));

-- Teachers: SELECT and UPDATE only submissions belonging to learners in their own CDC / barangay
CREATE POLICY "Teachers select own CDC submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = submissions.student_id
        AND (
          (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
          OR (
            (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
            AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
          )
        )
    )
  );

CREATE POLICY "Teachers update own CDC submissions"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = submissions.student_id
        AND (
          (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
          OR (
            (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
            AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
          )
        )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = submissions.student_id
        AND (
          (l.cdc_id IS NOT NULL AND l.cdc_id = public.get_my_teacher_cdc_id())
          OR (
            (l.cdc_id IS NULL OR public.get_my_teacher_cdc_id() IS NULL)
            AND lower(trim(coalesce(l.barangay, ''))) = lower(trim(coalesce(public.get_my_teacher_barangay(), '')))
          )
        )
    )
  );

-- Students/Parents: read and submit only their own child's submissions
CREATE POLICY "Students select own submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND student_id = auth.uid()
  );

CREATE POLICY "Students insert own submissions"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'student'
    AND student_id = auth.uid()
  );

CREATE POLICY "Students update own submissions"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND student_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'student'
    AND student_id = auth.uid()
  );

