-- Migration 005: Row-Level Security Policies (Idempotent, No Anon Access)
-- Roles:
--   - admin / superadmin: full access
--   - teacher: per-CDC isolation (only records in their assigned cdc_id)
--   - parent (student): sees only own children via student_parents

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''));
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN ('admin', 'superadmin')
      OR coalesce((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_cdc_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.cdc_id FROM public.teachers t WHERE t.id = auth.uid() LIMIT 1;
$$;

-- Enable RLS on all tables
ALTER TABLE public.barangays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eccd_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- 1. barangays & cdcs: authenticated read, admin write
DROP POLICY IF EXISTS "barangays_auth_select" ON public.barangays;
CREATE POLICY "barangays_auth_select" ON public.barangays FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "barangays_admin_all" ON public.barangays;
CREATE POLICY "barangays_admin_all" ON public.barangays FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "cdcs_auth_select" ON public.cdcs;
CREATE POLICY "cdcs_auth_select" ON public.cdcs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cdcs_admin_all" ON public.cdcs;
CREATE POLICY "cdcs_admin_all" ON public.cdcs FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());

-- 2. profiles: own row or admin
DROP POLICY IF EXISTS "profiles_self_or_admin_select" ON public.profiles;
CREATE POLICY "profiles_self_or_admin_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());

-- 3. teachers: own row, same-CDC teachers, or admin
DROP POLICY IF EXISTS "teachers_cdc_or_admin_select" ON public.teachers;
CREATE POLICY "teachers_cdc_or_admin_select" ON public.teachers FOR SELECT TO authenticated
  USING (id = auth.uid() OR cdc_id = public.current_teacher_cdc_id() OR public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "teachers_admin_all" ON public.teachers;
CREATE POLICY "teachers_admin_all" ON public.teachers FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());

-- 4. parents: own row or admin
DROP POLICY IF EXISTS "parents_self_or_admin" ON public.parents;
CREATE POLICY "parents_self_or_admin" ON public.parents FOR ALL TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_admin_or_superadmin());

-- 5. students: admin all, teacher per-CDC, parent own children only
DROP POLICY IF EXISTS "students_admin_all" ON public.students;
CREATE POLICY "students_admin_all" ON public.students FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "students_teacher_cdc" ON public.students;
CREATE POLICY "students_teacher_cdc" ON public.students FOR ALL TO authenticated
  USING (cdc_id = public.current_teacher_cdc_id())
  WITH CHECK (cdc_id = public.current_teacher_cdc_id());
DROP POLICY IF EXISTS "students_parent_own" ON public.students;
CREATE POLICY "students_parent_own" ON public.students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id = students.id AND sp.parent_id = auth.uid()));

-- 6. student_parents: admin all, teacher per-CDC, parent own links
DROP POLICY IF EXISTS "student_parents_admin_all" ON public.student_parents;
CREATE POLICY "student_parents_admin_all" ON public.student_parents FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "student_parents_parent_own" ON public.student_parents;
CREATE POLICY "student_parents_parent_own" ON public.student_parents FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
DROP POLICY IF EXISTS "student_parents_teacher_cdc" ON public.student_parents;
CREATE POLICY "student_parents_teacher_cdc" ON public.student_parents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_parents.student_id AND s.cdc_id = public.current_teacher_cdc_id()));

-- 7. classes: admin all, teacher per-CDC, parent of enrolled child
DROP POLICY IF EXISTS "classes_admin_all" ON public.classes;
CREATE POLICY "classes_admin_all" ON public.classes FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "classes_teacher_cdc" ON public.classes;
CREATE POLICY "classes_teacher_cdc" ON public.classes FOR ALL TO authenticated
  USING (cdc_id = public.current_teacher_cdc_id()) WITH CHECK (cdc_id = public.current_teacher_cdc_id());
DROP POLICY IF EXISTS "classes_parent_enrolled" ON public.classes;
CREATE POLICY "classes_parent_enrolled" ON public.classes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.student_parents sp ON sp.student_id = e.student_id
    WHERE e.class_id = classes.id AND sp.parent_id = auth.uid()
  ));

-- 8. enrollments: admin all, teacher per-CDC, parent own children
DROP POLICY IF EXISTS "enrollments_admin_all" ON public.enrollments;
CREATE POLICY "enrollments_admin_all" ON public.enrollments FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "enrollments_teacher_cdc" ON public.enrollments;
CREATE POLICY "enrollments_teacher_cdc" ON public.enrollments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = enrollments.class_id AND c.cdc_id = public.current_teacher_cdc_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = enrollments.class_id AND c.cdc_id = public.current_teacher_cdc_id()));
DROP POLICY IF EXISTS "enrollments_parent_own" ON public.enrollments;
CREATE POLICY "enrollments_parent_own" ON public.enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id = enrollments.student_id AND sp.parent_id = auth.uid()));

-- 9. curricula & topics: authenticated read, admin/teacher write
DROP POLICY IF EXISTS "curricula_auth_select" ON public.curricula;
CREATE POLICY "curricula_auth_select" ON public.curricula FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "curricula_admin_all" ON public.curricula;
CREATE POLICY "curricula_admin_all" ON public.curricula FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "topics_auth_select" ON public.topics;
CREATE POLICY "topics_auth_select" ON public.topics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "topics_admin_all" ON public.topics;
CREATE POLICY "topics_admin_all" ON public.topics FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());

-- 10. assignments & materials: admin all, teacher per-CDC, parent of enrolled child
DROP POLICY IF EXISTS "assignments_admin_all" ON public.assignments;
CREATE POLICY "assignments_admin_all" ON public.assignments FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "assignments_teacher_cdc" ON public.assignments;
CREATE POLICY "assignments_teacher_cdc" ON public.assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assignments.class_id AND c.cdc_id = public.current_teacher_cdc_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assignments.class_id AND c.cdc_id = public.current_teacher_cdc_id()));
DROP POLICY IF EXISTS "assignments_parent_select" ON public.assignments;
CREATE POLICY "assignments_parent_select" ON public.assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.student_parents sp ON sp.student_id = e.student_id
    WHERE e.class_id = assignments.class_id AND sp.parent_id = auth.uid()
  ));

DROP POLICY IF EXISTS "materials_admin_all" ON public.materials;
CREATE POLICY "materials_admin_all" ON public.materials FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "materials_teacher_cdc" ON public.materials;
CREATE POLICY "materials_teacher_cdc" ON public.materials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = materials.class_id AND c.cdc_id = public.current_teacher_cdc_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = materials.class_id AND c.cdc_id = public.current_teacher_cdc_id()));
DROP POLICY IF EXISTS "materials_parent_select" ON public.materials;
CREATE POLICY "materials_parent_select" ON public.materials FOR SELECT TO authenticated
  USING (is_published = true AND EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.student_parents sp ON sp.student_id = e.student_id
    WHERE e.class_id = materials.class_id AND sp.parent_id = auth.uid()
  ));

-- 11. submissions & submission_files: admin all, teacher per-CDC, parent own children
DROP POLICY IF EXISTS "submissions_admin_all" ON public.submissions;
CREATE POLICY "submissions_admin_all" ON public.submissions FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "submissions_teacher_cdc" ON public.submissions;
CREATE POLICY "submissions_teacher_cdc" ON public.submissions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = submissions.assignment_id AND c.cdc_id = public.current_teacher_cdc_id()
  ));
DROP POLICY IF EXISTS "submissions_parent_own" ON public.submissions;
CREATE POLICY "submissions_parent_own" ON public.submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id = submissions.student_id AND sp.parent_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id = submissions.student_id AND sp.parent_id = auth.uid()));

DROP POLICY IF EXISTS "submission_files_admin_all" ON public.submission_files;
CREATE POLICY "submission_files_admin_all" ON public.submission_files FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "submission_files_parent_own" ON public.submission_files;
CREATE POLICY "submission_files_parent_own" ON public.submission_files FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.student_parents sp ON sp.student_id = s.student_id
    WHERE s.id = submission_files.submission_id AND sp.parent_id = auth.uid()
  ));

-- 12. announcements: admin all, teacher per-CDC, parent for enrolled CDC/class
DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
CREATE POLICY "announcements_admin_all" ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "announcements_teacher_cdc" ON public.announcements;
CREATE POLICY "announcements_teacher_cdc" ON public.announcements FOR ALL TO authenticated
  USING (cdc_id = public.current_teacher_cdc_id()) WITH CHECK (cdc_id = public.current_teacher_cdc_id());
DROP POLICY IF EXISTS "announcements_parent_select" ON public.announcements;
CREATE POLICY "announcements_parent_select" ON public.announcements FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.student_parents sp ON sp.student_id = s.id
    WHERE sp.parent_id = auth.uid() AND (announcements.cdc_id IS NULL OR announcements.cdc_id = s.cdc_id)
  ));

-- 13. eccd_assessments: admin all, teacher per-CDC, parent own children (read-only)
DROP POLICY IF EXISTS "eccd_admin_all" ON public.eccd_assessments;
CREATE POLICY "eccd_admin_all" ON public.eccd_assessments FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "eccd_teacher_cdc" ON public.eccd_assessments;
CREATE POLICY "eccd_teacher_cdc" ON public.eccd_assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = eccd_assessments.student_id AND s.cdc_id = public.current_teacher_cdc_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = eccd_assessments.student_id AND s.cdc_id = public.current_teacher_cdc_id()));
DROP POLICY IF EXISTS "eccd_parent_own" ON public.eccd_assessments;
CREATE POLICY "eccd_parent_own" ON public.eccd_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id = eccd_assessments.student_id AND sp.parent_id = auth.uid()));

-- 14. consents: admin all, teacher per-CDC (read-only), parent own children
DROP POLICY IF EXISTS "consents_admin_all" ON public.consents;
CREATE POLICY "consents_admin_all" ON public.consents FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin()) WITH CHECK (public.is_admin_or_superadmin());
DROP POLICY IF EXISTS "consents_teacher_cdc" ON public.consents;
CREATE POLICY "consents_teacher_cdc" ON public.consents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = consents.student_id AND s.cdc_id = public.current_teacher_cdc_id()));
DROP POLICY IF EXISTS "consents_parent_own" ON public.consents;
CREATE POLICY "consents_parent_own" ON public.consents FOR ALL TO authenticated
  USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());
