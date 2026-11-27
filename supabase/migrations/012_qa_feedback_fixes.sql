-- Migration 012: QA Feedback Fixes (S1, T2, T6, T8, T9, P1, A1, A4, A5)
-- Idempotent migration: do not apply directly here; review and run in Supabase SQL Editor.

-- ============================================================
-- 1. S1: Anon-safe Teacher Registration Code Verification RPC
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS fn_sig
    FROM pg_proc
    WHERE proname = 'verify_teacher_registration_code'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.verify_teacher_registration_code(p_code text)
RETURNS TABLE (
  valid boolean,
  reason text,
  message text,
  code text,
  id uuid,
  full_name text,
  barangay text,
  cdc_id uuid,
  cdc_name text,
  class_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));
  v_teacher record;
BEGIN
  IF v_clean = '' THEN
    RETURN QUERY SELECT false, 'blank'::text, 'Please enter a registration code.'::text,
      NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT
    t.id,
    t.full_name,
    coalesce(t.registration_code, t.teacher_code) AS matched_code,
    t.is_active,
    b.name AS barangay_name,
    c.id AS cdc_id,
    c.name AS cdc_name,
    (
      SELECT cl.id
      FROM public.classes cl
      WHERE cl.teacher_id = t.id AND cl.is_active = true
      ORDER BY cl.created_at DESC
      LIMIT 1
    ) AS class_id
  INTO v_teacher
  FROM public.teachers t
  LEFT JOIN public.cdcs c ON c.id = t.cdc_id
  LEFT JOIN public.barangays b ON b.id = coalesce(t.barangay_id, c.barangay_id)
  WHERE upper(regexp_replace(trim(coalesce(t.registration_code, '')), '\s+', '', 'g')) = v_clean
     OR upper(regexp_replace(trim(coalesce(t.teacher_code, '')), '\s+', '', 'g')) = v_clean
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid'::text,
      'Invalid registration code. Please check the code given by your assigned Day Care Teacher.'::text,
      NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF coalesce(v_teacher.is_active, true) = false THEN
    RETURN QUERY SELECT false, 'inactive'::text,
      'This teacher registration code is currently inactive. Please contact your Day Care Center.'::text,
      v_teacher.matched_code, v_teacher.id, v_teacher.full_name, v_teacher.barangay_name,
      v_teacher.cdc_id, v_teacher.cdc_name, v_teacher.class_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'ok'::text, 'Registration code verified.'::text,
    v_teacher.matched_code, v_teacher.id, v_teacher.full_name, v_teacher.barangay_name,
    v_teacher.cdc_id, v_teacher.cdc_name, v_teacher.class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_teacher_registration_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_teacher_registration_code(text) TO anon, authenticated;

-- ============================================================
-- 2. T2 & T8: Submission Rating, Statuses & Feedback Thread
-- ============================================================
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('submitted', 'needs_revision', 'returned', 'approved', 'reviewed', 'pending', 'rejected', 'draft')) NOT VALID;

CREATE TABLE IF NOT EXISTS public.submission_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('teacher', 'student', 'parent', 'admin', 'superadmin')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission_id
  ON public.submission_feedback(submission_id, created_at ASC);

ALTER TABLE public.submission_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submission_feedback_select" ON public.submission_feedback;
CREATE POLICY "submission_feedback_select" ON public.submission_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_feedback.submission_id
        AND (
          s.submitted_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.id = s.assignment_id AND a.teacher_id = auth.uid()
          )
          OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
        )
    )
  );

DROP POLICY IF EXISTS "submission_feedback_insert" ON public.submission_feedback;
CREATE POLICY "submission_feedback_insert" ON public.submission_feedback
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ============================================================
-- 3. T6, T9, P1: Strict Delete & Resubmit RLS Guards
-- ============================================================
DROP POLICY IF EXISTS "teachers_delete_submissions" ON public.submissions;
DROP POLICY IF EXISTS "teachers_delete_assignments" ON public.assignments;
DROP POLICY IF EXISTS "teachers_delete_topics" ON public.topics;

DROP POLICY IF EXISTS "parents_update_returned_submissions" ON public.submissions;
CREATE POLICY "parents_update_returned_submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status IN ('needs_revision', 'returned')
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND status IN ('submitted', 'needs_revision', 'returned')
  );

-- ============================================================
-- 4. A1: Superadmin-Issued Single-Use Admin Invite Codes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  email text,
  issued_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_manage_admin_invites" ON public.admin_invites;
CREATE POLICY "superadmin_manage_admin_invites" ON public.admin_invites
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin' OR (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin' OR (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);

-- ============================================================
-- 5. A4 & A5: CDC Metadata & Curriculum Soft Delete
-- ============================================================
ALTER TABLE public.cdcs
  ADD COLUMN IF NOT EXISTS center_type text NOT NULL DEFAULT 'CDC' CHECK (center_type IN ('CDC', 'Learning Center')),
  ADD COLUMN IF NOT EXISTS permit_number text,
  ADD COLUMN IF NOT EXISTS recognition_status text DEFAULT 'Recognized',
  ADD COLUMN IF NOT EXISTS capacity integer;

ALTER TABLE public.curricula
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
