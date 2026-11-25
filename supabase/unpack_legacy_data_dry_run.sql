-- Legacy Data Unpack — DRY-RUN REPORT ONLY
-- Legacy tables stay completely untouched. No INSERT / UPDATE / DELETE is executed.
-- Run this in the Supabase SQL Editor to inspect what would be migrated.

-- ============================================================================
-- 1. Summary Report (Counts)
-- ============================================================================
SELECT
  'teachers_with_packed_contact' AS category,
  count(*)::bigint AS row_count
FROM public.teachers
WHERE contact_number LIKE '%||%'
UNION ALL
SELECT
  'materials_with_prefix_tags' AS category,
  count(*)::bigint AS row_count
FROM public.materials
WHERE title ~ '^\[[A-Z0-9_]+\]'
UNION ALL
SELECT
  'submissions_with_json_answer_text' AS category,
  count(*)::bigint AS row_count
FROM public.submissions
WHERE coalesce(answer_text, '') ~ '^\s*\{.*\}\s*$';

-- ============================================================================
-- 2. Preview: Teachers packed contact_number (||CODE: / ||META:)
-- ============================================================================
SELECT
  id AS teacher_id,
  full_name,
  trim(split_part(coalesce(contact_number, ''), '||', 1)) AS clean_phone,
  nullif(
    trim(substring(coalesce(contact_number, '') FROM '\|\|CODE:([^|]+)')),
    ''
  ) AS extracted_registration_code
FROM public.teachers
WHERE contact_number LIKE '%||%'
ORDER BY full_name
LIMIT 50;

-- ============================================================================
-- 3. Preview: Materials prefix rows grouped by tag
-- ============================================================================
SELECT
  substring(title FROM '^(\[[A-Z0-9_]+\])') AS prefix_tag,
  count(*)::bigint AS row_count
FROM public.materials
WHERE title ~ '^\[[A-Z0-9_]+\]'
GROUP BY prefix_tag
ORDER BY row_count DESC;

-- ============================================================================
-- 4. Preview: Submissions with JSON answer_text
-- ============================================================================
SELECT
  id AS submission_id,
  left(answer_text, 120) AS answer_text_preview
FROM public.submissions
WHERE coalesce(answer_text, '') ~ '^\s*\{.*\}\s*$'
LIMIT 25;

-- ============================================================================
-- 5. Apply Template (COMMENTED OUT — review dry-run output above first)
-- ============================================================================
/*
BEGIN;

-- Example: unpack teachers.registration_code from contact_number ||CODE:...
UPDATE public.teachers
SET registration_code = nullif(trim(substring(contact_number FROM '\|\|CODE:([^|]+)')), '')
WHERE contact_number LIKE '%||CODE:%'
  AND registration_code IS NULL;

COMMIT;
*/
