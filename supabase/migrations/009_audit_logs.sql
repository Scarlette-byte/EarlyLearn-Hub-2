-- Migration 009: Append-Only DB Audit Log + App Event RPC (Idempotent)

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid uuid,
  actor_role text,
  table_name text NOT NULL,
  op text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  event_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_uid ON audit.logs(actor_uid);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_op ON audit.logs(table_name, op);

-- Append-only: revoke UPDATE and DELETE
REVOKE UPDATE, DELETE ON audit.logs FROM PUBLIC, authenticated, anon;

ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_select" ON audit.logs;
CREATE POLICY "audit_logs_admin_select" ON audit.logs
  FOR SELECT TO authenticated
  USING (public.is_admin_or_superadmin());

-- Mask sensitive keys before storing JSONB
CREATE OR REPLACE FUNCTION audit.mask_sensitive(p_row jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_row IS NULL THEN NULL
    ELSE p_row - 'password' - 'encrypted_password' - 'token' - 'secret'
  END;
$$;

-- Generic DB audit trigger
CREATE OR REPLACE FUNCTION audit.record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public
AS $$
BEGIN
  INSERT INTO audit.logs (actor_uid, actor_role, table_name, op, old_data, new_data)
  VALUES (
    auth.uid(),
    public.current_app_role(),
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN audit.mask_sensitive(to_jsonb(OLD)) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN audit.mask_sensitive(to_jsonb(NEW)) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers to key tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'teachers', 'students', 'enrollments', 'submissions', 'eccd_assessments', 'cdcs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION audit.record_change()',
      t, t
    );
  END LOOP;
END $$;

-- App-level audit event RPC (login, logout, failed_login, password_reset, role_change, report_export, file_download)
CREATE OR REPLACE FUNCTION public.log_event(
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public
AS $$
BEGIN
  INSERT INTO audit.logs (actor_uid, actor_role, table_name, op, event_type, metadata)
  VALUES (
    auth.uid(),
    public.current_app_role(),
    'app_event',
    'EVENT',
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_event(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_event(text, jsonb) TO authenticated, anon;
