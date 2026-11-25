-- Migration 004: ECCD Assessments & Consents (Idempotent)

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

CREATE INDEX IF NOT EXISTS idx_eccd_assessments_student_id ON public.eccd_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_eccd_assessments_assessor_id ON public.eccd_assessments(assessor_id);

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

CREATE INDEX IF NOT EXISTS idx_consents_student_id ON public.consents(student_id);
CREATE INDEX IF NOT EXISTS idx_consents_parent_id ON public.consents(parent_id);
