-- Migration 007: Private Storage Buckets & RLS Policies (Idempotent)

-- 1. Create private buckets with 25 MB size limit and allowed MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-materials',
  'teacher-materials',
  false,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-submissions',
  'student-submissions',
  false,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies (path convention: {owner_id}/...)

-- Admin / Superadmin: full access to both buckets
DROP POLICY IF EXISTS "storage_admin_all" ON storage.objects;
CREATE POLICY "storage_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('teacher-materials', 'student-submissions')
    AND public.is_admin_or_superadmin()
  )
  WITH CHECK (
    bucket_id IN ('teacher-materials', 'student-submissions')
    AND public.is_admin_or_superadmin()
  );

-- teacher-materials: owner full access
DROP POLICY IF EXISTS "teacher_materials_owner_all" ON storage.objects;
CREATE POLICY "teacher_materials_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'teacher-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- teacher-materials: authenticated users can read published materials in their CDC/classes
DROP POLICY IF EXISTS "teacher_materials_auth_read" ON storage.objects;
CREATE POLICY "teacher_materials_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.cdc_id = public.current_teacher_cdc_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.classes c
        JOIN public.enrollments e ON e.class_id = c.id
        JOIN public.student_parents sp ON sp.student_id = e.student_id
        WHERE c.teacher_id::text = (storage.foldername(name))[1]
          AND sp.parent_id = auth.uid()
      )
    )
  );

-- student-submissions: owner (parent/student) full access
DROP POLICY IF EXISTS "student_submissions_owner_all" ON storage.objects;
CREATE POLICY "student_submissions_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'student-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'student-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- student-submissions: teacher read via class membership
DROP POLICY IF EXISTS "student_submissions_teacher_read" ON storage.objects;
CREATE POLICY "student_submissions_teacher_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-submissions'
    AND EXISTS (
      SELECT 1 FROM public.student_parents sp
      JOIN public.enrollments e ON e.student_id = sp.student_id
      JOIN public.classes c ON c.id = e.class_id
      WHERE sp.parent_id::text = (storage.foldername(name))[1]
        AND c.teacher_id = auth.uid()
    )
  );
