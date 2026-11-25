-- ============================================================================
-- EarlyLearn Hub (MSWDO Manolo Fortich, Bukidnon)
-- SQL Migration: 009_bootstrap_superadmin.sql
-- Purpose:
--   1. Lock down public/client admin sign-up on `public.profiles` and `get_my_role()`
--      so role authority comes strictly from server-controlled JWT `app_metadata` (1C).
--   2. Provide a server-only helper `public.assign_app_role(...)` restricted to
--      `postgres` / `service_role`.
--   3. Bootstrap the first Municipal Superadmin account in `auth.users` + `public.profiles`.
-- ============================================================================

-- 1. Server-trusted role reader for RLS (never reads client-editable `user_metadata`)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(lower(trim(auth.jwt() -> 'app_metadata' ->> 'role')), ''),
    CASE
      WHEN (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE THEN 'superadmin'
      ELSE NULL
    END,
    'student'
  );
$$;

-- 2. Block public / self-service escalation to `admin` on `public.profiles`
DROP POLICY IF EXISTS "Users and admins/teachers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin/teacher can update" ON public.profiles;
DROP POLICY IF EXISTS "Self insert student profile only" ON public.profiles;
DROP POLICY IF EXISTS "Admins and teachers insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own non-role profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;

-- Public / newly signed-up users can only create their own `student` profile row
CREATE POLICY "Self insert student profile only"
  ON public.profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    auth.uid() = id
    AND role = 'student'
  );

-- Teachers can create `student` or `teacher` profiles (never `admin`)
CREATE POLICY "Admins and teachers insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('admin', 'superadmin')
    OR (public.get_my_role() = 'teacher' AND role IN ('student', 'teacher'))
  );

-- Non-admin users can update their own profile row only if `role` remains unchanged and non-admin
CREATE POLICY "Users update own non-role profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      public.get_my_role() IN ('admin', 'superadmin')
      OR role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
    )
  );

-- Admins & Superadmins have full management over `public.profiles`
CREATE POLICY "Admins manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_my_role() IN ('admin', 'superadmin'));

-- 3. Server-only helper to assign 1C `raw_app_meta_data.role` and sync `public.profiles`
CREATE OR REPLACE FUNCTION public.assign_app_role(
  target_user_id uuid,
  target_role text,
  target_full_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_role text := lower(trim(coalesce(target_role, '')));
  db_profile_role text;
BEGIN
  IF normalized_role NOT IN ('superadmin', 'admin', 'teacher', 'student') THEN
    RAISE EXCEPTION 'Invalid role "%". Allowed: superadmin, admin, teacher, student.', target_role;
  END IF;

  db_profile_role := CASE
    WHEN normalized_role IN ('superadmin', 'admin') THEN 'admin'
    WHEN normalized_role = 'teacher' THEN 'teacher'
    ELSE 'student'
  END;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role', normalized_role,
        'is_superadmin', (normalized_role = 'superadmin')
      ),
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found in auth.users.', target_user_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    target_user_id,
    coalesce(
      NULLIF(trim(target_full_name), ''),
      (SELECT coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Administrator') FROM auth.users WHERE id = target_user_id),
      'Administrator'
    ),
    db_profile_role
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = coalesce(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_app_role(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_app_role(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_app_role(uuid, text, text) TO service_role;

-- ============================================================================
-- 4. BOOTSTRAP THE FIRST MUNICIPAL SUPERADMIN
-- Instructions:
--   1. Create the initial user in Supabase Dashboard -> Authentication -> Users
--      (e.g., `superadmin@earlylearn.ph`) OR replace `v_bootstrap_email` below
--      with your chosen superadmin email before running this script in the
--      Supabase SQL Editor.
--   2. Sign out and sign back in so the browser receives the updated JWT.
-- ============================================================================
DO $$
DECLARE
  v_bootstrap_email text := 'superadmin@earlylearn.ph';
  v_superadmin_id uuid;
BEGIN
  SELECT u.id
  INTO v_superadmin_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_bootstrap_email)
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_superadmin_id IS NULL THEN
    RAISE NOTICE 'Bootstrap skipped: create % in Supabase Auth -> Users first, then re-run 009_bootstrap_superadmin.sql.', v_bootstrap_email;
  ELSE
    PERFORM public.assign_app_role(v_superadmin_id, 'superadmin', 'Municipal Superadmin');
    RAISE NOTICE 'Bootstrapped % (%) as superadmin in auth.users.raw_app_meta_data and public.profiles.', v_bootstrap_email, v_superadmin_id;
  END IF;
END;
$$;
