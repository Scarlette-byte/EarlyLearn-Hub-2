/**
 * Migrates legacy [MEDIA_CHUNK] rows from `public.materials` into Supabase Storage
 * (`teacher-materials` bucket). Dry-run by default; pass `--apply` to upload.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate_chunked_media_to_storage.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await supabase
  .from('materials')
  .select('id, title, description, teacher_id')
  .ilike('title', '[MEDIA_CHUNK]%');

if (error) {
  console.error('Failed to query legacy [MEDIA_CHUNK] rows:', error.message);
  process.exit(1);
}

console.log(`Found ${rows?.length || 0} [MEDIA_CHUNK] rows. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

for (const row of rows || []) {
  const ownerId = row.teacher_id || 'legacy';
  const objectPath = `${ownerId}/migrated/${row.id}.bin`;
  if (!APPLY) {
    console.log(`[DRY-RUN] Would upload ${row.title} -> teacher-materials/${objectPath}`);
    continue;
  }
  const buffer = Buffer.from(String(row.description || ''), 'base64');
  const { error: upErr } = await supabase.storage
    .from('teacher-materials')
    .upload(objectPath, buffer, { upsert: true });
  if (upErr) {
    console.error(`[ERROR] ${row.id}: ${upErr.message}`);
  } else {
    console.log(`[MIGRATED] ${row.id} -> storage://teacher-materials/${objectPath}`);
  }
}
