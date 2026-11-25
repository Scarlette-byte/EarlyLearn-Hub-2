-- Migration 002: Students, Student-Parents, Classes & Enrollments (Idempotent)

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

CREATE INDEX IF NOT EXISTS idx_students_cdc_id ON public.students(cdc_id);
CREATE INDEX IF NOT EXISTS idx_students_barangay_id ON public.students(barangay_id);
CREATE INDEX IF NOT EXISTS idx_students_approval_status ON public.students(approval_status);

CREATE TABLE IF NOT EXISTS public.student_parents (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'parent',
  is_primary_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_student_parents_parent_id ON public.student_parents(parent_id);

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

CREATE INDEX IF NOT EXISTS idx_classes_cdc_id ON public.classes(cdc_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'completed', 'dropped')),
  enrolled_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON public.enrollments(class_id);
