import { supabase } from './supabaseClient.js';

export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10 MB
  document: 25 * 1024 * 1024, // 25 MB
  video: 25 * 1024 * 1024,    // 25 MB
  audio: 25 * 1024 * 1024,    // 25 MB
  default: 25 * 1024 * 1024,  // 25 MB
};

export const ACCEPTED_FILE_TYPES_STRING =
  'image/*,application/pdf,.doc,.docx,.ppt,.pptx,audio/*,video/mp4,video/webm,video/quicktime';

export function formatFileSize(bytes) {
  const num = Number(bytes || 0);
  if (!num) return '0 B';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectMediaCategory({ file, fileName = '', fileType = '', mimeType = '', url = '' } = {}) {
  const mime = String(file?.type || mimeType || fileType || '').toLowerCase();
  const name = String(file?.name || fileName || url || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(name)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(name)) return 'audio';
  if (mime === 'application/pdf' || /\.pdf(\?|$)/i.test(name)) return 'pdf';
  return 'document';
}

export function validateActivityFile(file) {
  if (!file) return { valid: false, error: 'No file selected.' };
  const category = detectMediaCategory({ file });
  const limit = FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.default;
  if (file.size > limit) {
    return {
      valid: false,
      error: `File exceeds the ${formatFileSize(limit)} limit for ${category} files.`,
    };
  }
  return { valid: true, category };
}

export function getEmbeddedVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const yt = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = rawUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function isVideoItem(item = {}) {
  return detectMediaCategory(item) === 'video';
}

export function isImageItem(item = {}) {
  return detectMediaCategory(item) === 'image';
}

export function isPdfItem(item = {}) {
  return detectMediaCategory(item) === 'pdf';
}

/**
 * Uploads a file to a private Supabase Storage bucket under `{ownerId}/...`
 * and returns a `storage://<bucket>/<path>` reference plus a short-lived signed URL.
 */
export async function uploadMediaToStorage({
  file,
  bucket = 'teacher-materials',
  ownerId,
  folder = 'uploads',
  expiresInSeconds = 3600,
}) {
  if (!file) throw new Error('File is required for upload.');
  const validation = validateActivityFile(file);
  if (!validation.valid) throw new Error(validation.error);

  let uid = ownerId;
  if (!uid) {
    const { data } = await supabase.auth.getUser();
    uid = data?.user?.id;
  }
  if (!uid) throw new Error('Authenticated user ID is required to upload media.');

  const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${uid}/${folder}/${Date.now()}_${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  const { data: signedData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  return {
    storageRef: `storage://${bucket}/${objectPath}`,
    bucket,
    path: objectPath,
    signedUrl: signedData?.signedUrl || null,
  };
}

/**
 * Compatibility wrapper replacing legacy MEDIA_CHUNK uploads with Supabase Storage.
 */
export async function saveMediaToSupabaseChunks({
  file,
  bucket = 'teacher-materials',
  ownerId,
  folder = 'uploads',
} = {}) {
  const res = await uploadMediaToStorage({ file, bucket, ownerId, folder });
  return res.storageRef;
}

/**
 * Resolves a `storage://<bucket>/<path>` reference to a fresh signed URL,
 * or returns external/blob URLs as-is.
 */
export async function resolveViewableMediaUrl(rawUrl, _fallbackFileName = '', _fallbackTitle = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.startsWith('storage://')) {
    const withoutScheme = rawUrl.slice('storage://'.length);
    const slashIdx = withoutScheme.indexOf('/');
    if (slashIdx === -1) return '';
    const bucket = withoutScheme.slice(0, slashIdx);
    const path = withoutScheme.slice(slashIdx + 1);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return '';
    return data.signedUrl;
  }
  return rawUrl;
}
