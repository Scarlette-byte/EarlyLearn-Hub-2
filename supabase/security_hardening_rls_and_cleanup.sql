-- Security Hardening: Narrow RPCs for anon teacher lookup/registration + Cleanup of leaked credentials
-- Run this in the Supabase SQL Editor. Do NOT commit secrets.

-- ============================================================================
-- 1. Narrow SECURITY DEFINER RPCs (replace anon SELECT on public.teachers)
-- ============================================================================

-- 1a. Login-email lookup: given an email, Teacher ID, or phone number, return ONLY the auth email.
CREATE OR REPLACE FUNCTION public.lookup_teacher_login_email(p_identifier text)
RETURNS TABLE (email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text := lower(trim(coalesce(p_identifier, '')));
  v_digits text := regexp_replace(v_raw, '\D', '', 'g');
  v_core text;
BEGIN
  IF v_raw = '' THEN
    RETURN;
  END IF;

  -- Normalize PH mobile core (10 digits starting with 9)
  v_core := v_digits;
  IF length(v_core) = 12 AND left(v_core, 2) = '63' THEN
    v_core := substring(v_core FROM 3);
  ELSIF length(v_core) = 11 AND left(v_core, 1) = '0' THEN
    v_core := substring(v_core FROM 2);
  END IF;

  RETURN QUERY
  SELECT t.email::text
  FROM public.teachers t
  WHERE t.email IS NOT NULL
    AND (
      lower(trim(t.email)) = v_raw
      OR lower(trim(coalesce(t.teacher_id, ''))) = v_raw
      OR (
        length(v_core) >= 7
        AND regexp_replace(split_part(coalesce(t.contact_number, ''), '||', 1), '\D', '', 'g') LIKE '%' || v_core
      )
    )
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_teacher_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_teacher_login_email(text) TO anon, authenticated;

-- 1b. Registration-code verify: given a teacher registration code, return ONLY non-sensitive teacher info.
CREATE OR REPLACE FUNCTION public.verify_teacher_registration_code(p_code text)
RETURNS TABLE (
  id uuid,
  full_name text,
  barangay text,
  cdc_name text,
  teacher_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  IF v_code = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.full_name::text,
    t.barangay::text,
    t.cdc_name::text,
    t.teacher_id::text
  FROM public.teachers t
  WHERE upper(trim(coalesce(t.teacher_id, ''))) = v_code
     OR upper(coalesce(t.contact_number, '')) LIKE '%||CODE:' || v_code || '%'
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_teacher_registration_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_teacher_registration_code(text) TO anon, authenticated;

-- 1c. Public barangay teacher list for SignUp dropdown (no email, no phone, no credentials).
CREATE OR REPLACE FUNCTION public.get_teachers_for_barangay_public(p_barangay text)
RETURNS TABLE (
  id uuid,
  full_name text,
  barangay text,
  cdc_name text,
  teacher_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brgy text := lower(trim(coalesce(p_barangay, '')));
BEGIN
  IF v_brgy = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.full_name::text,
    t.barangay::text,
    t.cdc_name::text,
    t.teacher_id::text
  FROM public.teachers t
  WHERE lower(trim(coalesce(t.barangay, ''))) = v_brgy
  ORDER BY t.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_teachers_for_barangay_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teachers_for_barangay_public(text) TO anon, authenticated;

-- ============================================================================
-- 2. Revoke anon SELECT on public.teachers
-- ============================================================================
DROP POLICY IF EXISTS "Allow anon select on teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public read teachers" ON public.teachers;
DROP POLICY IF EXISTS "teachers_anon_select" ON public.teachers;
-- Note: If you have another anon SELECT policy on public.teachers with a custom name,
-- drop it in Supabase Dashboard → Authentication → Policies → public.teachers.

-- ============================================================================
-- 3. Cleanup SQL for existing leaked plaintext passwords
-- ============================================================================

-- 3a. Strip `||PASS:...` segments from public.teachers.contact_number
UPDATE public.teachers
SET contact_number = trim(
  regexp_replace(contact_number, '\s*\|\|PASS:[^|]*', '', 'gi')
)
WHERE contact_number ILIKE '%||PASS:%';

-- 3b. Delete all [TEACHER_CREDENTIAL_SYNC] and [PARENT_CREDENTIAL_SYNC] rows from public.materials
DELETE FROM public.materials
WHERE title ILIKE '[TEACHER_CREDENTIAL_SYNC]%'
   OR title ILIKE '[PARENT_CREDENTIAL_SYNC]%';
