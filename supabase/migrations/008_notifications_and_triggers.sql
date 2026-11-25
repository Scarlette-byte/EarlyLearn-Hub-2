-- Migration 008: Notifications Table, RLS, Realtime & Event Triggers (Idempotent)

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, read_at, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read and mark-as-read their own notifications; inserts only via SECURITY DEFINER triggers/functions
DROP POLICY IF EXISTS "notifications_own_select" ON public.notifications;
CREATE POLICY "notifications_own_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;
CREATE POLICY "notifications_own_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Helper: insert notification (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT '',
  p_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, coalesce(p_body, ''), p_link);
END;
$$;

-- Trigger: Submission received (notify teacher) or reviewed/returned (notify parent)
CREATE OR REPLACE FUNCTION public.trg_notify_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_title text;
  v_parent_id uuid;
BEGIN
  SELECT a.teacher_id, a.title INTO v_teacher_id, v_title
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      v_teacher_id,
      'submission_received',
      'New Submission Received',
      'A student submitted work for "' || coalesce(v_title, 'Assignment') || '".',
      '/teacher-dashboard'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR v_parent_id IN
      SELECT sp.parent_id FROM public.student_parents sp WHERE sp.student_id = NEW.student_id
    LOOP
      PERFORM public.create_notification(
        v_parent_id,
        'submission_' || NEW.status,
        'Submission ' || initcap(NEW.status),
        'Your child''s submission for "' || coalesce(v_title, 'Assignment') || '" was ' || NEW.status || '.',
        '/student-dashboard'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_submission ON public.submissions;
CREATE TRIGGER trg_notify_submission
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_submission();

-- Trigger: Enrollment approved/declined (notify parent)
CREATE OR REPLACE FUNCTION public.trg_notify_student_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status
     AND NEW.approval_status IN ('approved', 'rejected') THEN
    FOR v_parent_id IN
      SELECT sp.parent_id FROM public.student_parents sp WHERE sp.student_id = NEW.id
    LOOP
      PERFORM public.create_notification(
        v_parent_id,
        'enrollment_' || NEW.approval_status,
        'Enrollment ' || initcap(NEW.approval_status),
        'Enrollment for ' || NEW.first_name || ' ' || NEW.last_name || ' has been ' || NEW.approval_status || '.',
        '/student-dashboard'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_approval ON public.students;
CREATE TRIGGER trg_notify_student_approval
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_student_approval();

-- Trigger: ECCD report published (notify parent)
CREATE OR REPLACE FUNCTION public.trg_notify_eccd_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  FOR v_parent_id IN
    SELECT sp.parent_id FROM public.student_parents sp WHERE sp.student_id = NEW.student_id
  LOOP
    PERFORM public.create_notification(
      v_parent_id,
      'eccd_published',
      'ECCD Report Published',
      'A new ' || NEW.assessment_period || ' ECCD assessment report is available.',
      '/student-dashboard'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_eccd_published ON public.eccd_assessments;
CREATE TRIGGER trg_notify_eccd_published
  AFTER INSERT ON public.eccd_assessments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_eccd_published();
