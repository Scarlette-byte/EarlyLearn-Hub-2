-- ============================================================================
-- Migration 010: Dashboard Aggregate Views (security_invoker = true)
-- Replaces static/hardcoded/localStorage dashboard figures with live DB views.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_admin_dashboard_summary
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.students)::bigint AS total_students,
  (SELECT count(*) FROM public.enrollments WHERE status = 'enrolled')::bigint AS enrolled_students,
  (SELECT count(*) FROM public.cdcs)::bigint AS total_cdcs,
  (SELECT count(*) FROM public.teachers)::bigint AS total_teachers,
  (SELECT count(*) FROM public.materials WHERE status = 'pending')::bigint AS pending_materials,
  (SELECT count(*) FROM public.materials WHERE status = 'approved')::bigint AS approved_materials,
  (SELECT count(*) FROM public.eccd_assessments)::bigint AS total_assessments,
  (SELECT count(*) FROM public.enrollments WHERE status = 'pending')::bigint AS pending_enrollments;

CREATE OR REPLACE VIEW public.v_teacher_dashboard_summary
WITH (security_invoker = true) AS
SELECT
  t.id AS teacher_id,
  (SELECT count(*) FROM public.assignments a WHERE a.teacher_id = t.id)::bigint AS assigned_topics_total,
  (SELECT count(*) FROM public.assignments a WHERE a.teacher_id = t.id AND (a.due_at IS NULL OR a.due_at > now()))::bigint AS assigned_topics_pending,
  (SELECT count(*) FROM public.materials m WHERE m.teacher_id = t.id AND m.status = 'pending')::bigint AS materials_pending,
  (SELECT count(*) FROM public.materials m WHERE m.teacher_id = t.id AND m.status = 'approved')::bigint AS materials_approved,
  (SELECT count(*) FROM public.materials m WHERE m.teacher_id = t.id AND m.is_published = true)::bigint AS materials_posted,
  (
    SELECT count(DISTINCT e.student_id)
    FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE c.teacher_id = t.id AND e.status = 'enrolled'
  )::bigint AS enrolled_students_count,
  (
    SELECT count(DISTINCT e.student_id)
    FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE c.teacher_id = t.id AND e.status = 'pending'
  )::bigint AS pending_parent_approvals,
  (
    SELECT count(*)
    FROM public.submissions s
    JOIN public.materials m ON m.id = s.material_id
    WHERE m.teacher_id = t.id AND s.status = 'pending'
  )::bigint AS pending_submissions
FROM public.teachers t;

CREATE OR REPLACE VIEW public.v_student_dashboard_summary
WITH (security_invoker = true) AS
SELECT
  s.id AS student_id,
  (SELECT count(*) FROM public.materials m WHERE m.is_published = true AND m.status = 'approved')::bigint AS total_posted_activities,
  (SELECT count(*) FROM public.submissions sub WHERE sub.student_id = s.id)::bigint AS submissions_count,
  (SELECT count(*) FROM public.submissions sub WHERE sub.student_id = s.id AND sub.status IN ('checked', 'approved'))::bigint AS completed_activities,
  (SELECT count(*) FROM public.announcements a WHERE a.cdc_id = s.cdc_id OR a.cdc_id IS NULL)::bigint AS announcements_count,
  (SELECT max(ea.assessed_at) FROM public.eccd_assessments ea WHERE ea.student_id = s.id) AS latest_assessment_at
FROM public.students s;

GRANT SELECT ON public.v_admin_dashboard_summary TO authenticated;
GRANT SELECT ON public.v_teacher_dashboard_summary TO authenticated;
GRANT SELECT ON public.v_student_dashboard_summary TO authenticated;
