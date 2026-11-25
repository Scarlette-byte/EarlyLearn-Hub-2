-- Migration 003: Curricula, Topics, Assignments, Materials, Submissions & Announcements (Idempotent)

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

CREATE INDEX IF NOT EXISTS idx_topics_curriculum_id ON public.topics(curriculum_id);

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

CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON public.assignments(teacher_id);

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

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE RESTRICT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_materials_class_id ON public.materials(class_id);
CREATE INDEX IF NOT EXISTS idx_materials_teacher_id ON public.materials(teacher_id);

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

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);

CREATE TABLE IF NOT EXISTS public.submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON public.submission_files(submission_id);

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

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS cdc_id uuid REFERENCES public.cdcs(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_announcements_cdc_id ON public.announcements(cdc_id);
CREATE INDEX IF NOT EXISTS idx_announcements_class_id ON public.announcements(class_id);
