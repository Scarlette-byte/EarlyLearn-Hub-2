-- EarlyLearn Hub — Normalized Schema Draft (FOR REVIEW ONLY; DO NOT APPLY BLINDLY)
-- Replaces packed string fields (||CODE:, ||META:, etc.) with real columns and foreign keys.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Barangays
CREATE TABLE IF NOT EXISTS public.barangays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  municipality text NOT NULL DEFAULT 'Manolo Fortich',
  province text NOT NULL DEFAULT 'Bukidnon',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. CDCs / Learning Centers
CREATE TABLE IF NOT EXISTS public.cdcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay_id uuid NOT NULL REFERENCES public.barangays(id) ON DELETE RESTRICT,
  name text NOT NULL,
  center_type text NOT NULL CHECK (center_type IN ('CDC', 'LC')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  permit_number text,
  permit_issued_at date,
  permit_expires_at date,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barangay_id, name)
);

-- 3. Profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text NOT NULL,
  phone_number text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('superadmin', 'admin', 'teacher', 'student')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Teachers
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_code text UNIQUE,
  registration_code text UNIQUE,
  cdc_id uuid REFERENCES public.cdcs(id) ON DELETE SET NULL,
  barangay_id uuid REFERENCES public.barangays(id) ON DELETE SET NULL,
  position_title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Parents
CREATE TABLE IF NOT EXISTS public.parents (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  occupation text,
  address text,
  preferred_contact text CHECK (preferred_contact IN ('phone', 'email', 'sms')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Students
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lrn text UNIQUE,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  birthdate date,
  sex text CHECK (sex IN ('M', 'F')),
  barangay_id uuid REFERENCES public.barangays(id) ON DELETE SET NULL,
  cdc_id uuid REFERENCES public.cdcs(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Student-Parent Join Table
CREATE TABLE IF NOT EXISTS public.student_parents (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'parent',
  is_primary_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, parent_id)
);

-- 8. Classes
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cdc_id uuid NOT NULL REFERENCES public.cdcs(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('Pre-K1', 'Pre-K2', 'Kindergarten')),
  school_year text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cdc_id, name, school_year)
);

-- 9. Enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'completed', 'dropped')),
  enrolled_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);

-- 10. Curricula, Topics, Assignments
CREATE TABLE IF NOT EXISTS public.curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  level text NOT NULL CHECK (level IN ('Pre-K1', 'Pre-K2', 'Kindergarten')),
  school_year text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  title text NOT NULL,
  quarter smallint CHECK (quarter BETWEEN 1 AND 4),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  max_score numeric(6, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Materials
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  file_url text,
  mime_type text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Submissions & Submission Files
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'returned')),
  score numeric(6, 2),
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 13. Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cdc_id uuid REFERENCES public.cdcs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. ECCD Assessments
CREATE TABLE IF NOT EXISTS public.eccd_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  assessor_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  assessment_period text NOT NULL CHECK (assessment_period IN ('BOSY', 'MOSY', 'EOSY')),
  assessed_at date NOT NULL DEFAULT CURRENT_DATE,
  domain_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_total integer,
  scaled_score integer,
  interpretation text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, assessment_period)
);

-- 15. Consents
CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('enrollment', 'media', 'eccd', 'data_privacy')),
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, parent_id, consent_type)
);
