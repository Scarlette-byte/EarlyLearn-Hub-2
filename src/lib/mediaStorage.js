import { supabase } from './supabaseClient';

// Shared File Size Limits, Validation, Video/Media Detection & IndexedDB + Supabase Large-File Storage
// Ensures video files (up to 50 MB), documents (up to 15 MB), and images (up to 10 MB)
// can be uploaded, stored, retrieved, and played back reliably across Admin, Teacher, and Student dashboards.

export const FILE_SIZE_LIMITS = {
  image: {
    maxMB: 10,
    maxBytes: 10 * 1024 * 1024,
    label: 'Images (PNG, JPG, JPEG, WebP, GIF)',
    shortLabel: 'Images: Max 10 MB',
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'],
  },
  document: {
    maxMB: 15,
    maxBytes: 15 * 1024 * 1024,
    label: 'Documents / Files (PDF, Word, PPT, Excel)',
    shortLabel: 'Files/Docs (PDF, Word, PPT): Max 15 MB',
    extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv', 'zip'],
  },
  video: {
    maxMB: 50,
    maxBytes: 50 * 1024 * 1024,
    label: 'Videos (MP4, WebM, MOV)',
    shortLabel: 'Videos (MP4, WebM, MOV): Max 50 MB',
    extensions: ['mp4', 'webm', 'mov', 'ogg', 'm4v', 'avi', 'mkv'],
  },
};

export const ACCEPTED_FILE_TYPES_STRING =
  'image/*,video/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif';

/**
 * Formats byte size into human-readable KB or MB
 */
export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Detects media category ('image' | 'video' | 'document') from a File object or filename/mime/type
 */
export function detectMediaCategory({ file, fileName = '', fileType = '', mimeType = '', url = '' } = {}) {
  const name = (file?.name || fileName || url || '').toLowerCase();
  const mime = (file?.type || mimeType || '').toLowerCase();
  const fType = (fileType || '').toLowerCase();

  const ext = name.includes('.') ? name.split('.').pop().split('?')[0].split('#')[0] : '';

  if (
    mime.startsWith('video/') ||
    url?.startsWith('data:video/') ||
    FILE_SIZE_LIMITS.video.extensions.includes(ext) ||
    FILE_SIZE_LIMITS.video.extensions.includes(fType) ||
    fType === 'video' ||
    fType.includes('video')
  ) {
    return 'video';
  }

  if (
    mime.startsWith('image/') ||
    url?.startsWith('data:image/') ||
    FILE_SIZE_LIMITS.image.extensions.includes(ext) ||
    FILE_SIZE_LIMITS.image.extensions.includes(fType) ||
    fType === 'image' ||
    fType.includes('image')
  ) {
    return 'image';
  }

  return 'document';
}

/**
 * Validates a selected File against the applicable size limits for Images (10 MB), Documents (15 MB), and Videos (50 MB).
 */
export function validateActivityFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const category = detectMediaCategory({ file });
  const rule = FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.document;
  const sizeFormatted = formatFileSize(file.size);
  const ext = (file.name.split('.').pop() || category).toUpperCase();

  if (file.size > rule.maxBytes) {
    return {
      valid: false,
      category,
      fileType: ext,
      sizeFormatted,
      maxMB: rule.maxMB,
      error: `⚠️ File "${file.name}" (${sizeFormatted}) exceeds the maximum allowed size for ${rule.label} (Max ${rule.maxMB} MB). Please choose a file under ${rule.maxMB} MB.`,
    };
  }

  return {
    valid: true,
    category,
    fileType: ext,
    sizeFormatted,
    maxMB: rule.maxMB,
    error: null,
  };
}

/**
 * Checks if a URL is a YouTube or Google Drive embeddable video link
 */
export function getEmbeddedVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('idb://')) {
    return null;
  }

  // YouTube watch or short URL
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Google Drive file link
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  return null;
}

/**
 * Checks whether an activity/material or submission item is a video.
 * Supports both camelCase ({ fileUrl, fileName, fileType, moduleType })
 * and snake_case ({ url, content_url, file_name, file_type, module_type, type, category }).
 */
export function isVideoItem(item = {}) {
  if (!item || typeof item !== 'object') return false;
  const rawUrl = item.fileUrl || item.url || item.content_url || item.mediaUrl || '';
  const rawName = item.fileName || item.file_name || '';
  const rawFileType = item.fileType || item.file_type || '';
  const rawModuleType = item.moduleType || item.module_type || item.type || item.category || '';

  const fType = String(rawFileType || '').toUpperCase();
  const mType = String(rawModuleType || '').toLowerCase();
  const url = String(rawUrl || '');
  const name = String(rawName || '');

  if (
    url.startsWith('data:video/') ||
    url.startsWith('idb://video-') ||
    /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?|#|$)/i.test(name || url) ||
    ['MP4', 'WEBM', 'MOV', 'OGG', 'M4V', 'AVI', 'MKV', 'VIDEO'].includes(fType) ||
    mType.includes('video') ||
    Boolean(getEmbeddedVideoUrl(url))
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether an activity/material or submission item is an image.
 * Supports both camelCase and snake_case property names.
 */
export function isImageItem(item = {}) {
  if (!item || typeof item !== 'object') return false;
  const rawUrl = item.fileUrl || item.url || item.content_url || item.mediaUrl || '';
  const rawName = item.fileName || item.file_name || '';
  const rawFileType = item.fileType || item.file_type || '';
  const rawModuleType = item.moduleType || item.module_type || item.type || item.category || '';

  const fType = String(rawFileType || '').toUpperCase();
  const mType = String(rawModuleType || '').toLowerCase();
  const url = String(rawUrl || '');
  const name = String(rawName || '');

  if (
    url.startsWith('data:image/') ||
    url.startsWith('idb://image-') ||
    /\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)/i.test(name || url) ||
    ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG', 'BMP', 'IMAGE'].includes(fType) ||
    mType === 'image' ||
    mType.includes('image')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether an activity/material or submission item is a PDF document.
 * Supports both camelCase and snake_case property names.
 */
export function isPdfItem(item = {}) {
  if (!item || typeof item !== 'object') return false;
  const rawUrl = item.fileUrl || item.url || item.content_url || item.mediaUrl || '';
  const rawName = item.fileName || item.file_name || '';
  const rawFileType = item.fileType || item.file_type || '';

  const fType = String(rawFileType || '').toUpperCase();
  const url = String(rawUrl || '');
  const name = String(rawName || '');

  return Boolean(
    url.startsWith('data:application/pdf') ||
    url.startsWith('idb://pdf-') ||
    /\.pdf(\?|#|$)/i.test(name || url) ||
    fType === 'PDF' ||
    fType.includes('PDF')
  );
}

// ============================================================================
// IndexedDB Large Media Storage (supports up to 50 MB videos without hitting
// localStorage 5 MB quota, with in-memory Blob cache for instant playback)
// ============================================================================
const DB_NAME = 'earlylearn_media_db';
const STORE_NAME = 'media_files';
const memoryBlobCache = new Map();

function normalizePlayableBlob(blob, fileNameHint = '') {
  if (!(blob instanceof Blob)) return null;
  const nameLower = String(fileNameHint || blob.name || '').toLowerCase();
  const currentType = String(blob.type || '').toLowerCase();

  if (
    nameLower.endsWith('.mp4') ||
    nameLower.endsWith('.mov') ||
    nameLower.endsWith('.m4v') ||
    currentType === 'video/quicktime'
  ) {
    if (currentType !== 'video/mp4') {
      return new Blob([blob], { type: 'video/mp4' });
    }
  } else if (nameLower.endsWith('.webm') && currentType !== 'video/webm') {
    return new Blob([blob], { type: 'video/webm' });
  } else if (nameLower.endsWith('.pdf') && currentType !== 'application/pdf') {
    return new Blob([blob], { type: 'application/pdf' });
  } else if (nameLower.endsWith('.png') && currentType !== 'image/png') {
    return new Blob([blob], { type: 'image/png' });
  } else if ((nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) && currentType !== 'image/jpeg') {
    return new Blob([blob], { type: 'image/jpeg' });
  } else if (nameLower.endsWith('.gif') && currentType !== 'image/gif') {
    return new Blob([blob], { type: 'image/gif' });
  } else if (nameLower.endsWith('.webp') && currentType !== 'image/webp') {
    return new Blob([blob], { type: 'image/webp' });
  }
  return blob;
}

function openMediaDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves a File/Blob or data URL to IndexedDB.
 * Can be called as:
 *   saveMediaBlobToIndexedDB(file) -> auto-generates key and returns the `idb://...` key string
 *   saveMediaBlobToIndexedDB(key, file, optionalTitle) -> saves under `key` and returns `key`
 */
  export async function saveMediaBlobToIndexedDB(keyOrFile, maybeFile, optionalTitle = '') {
    let key = keyOrFile;
    let fileOrDataUrl = maybeFile;
    let titleHint = optionalTitle;

    if (keyOrFile && typeof keyOrFile !== 'string') {
      fileOrDataUrl = keyOrFile;
      titleHint = typeof maybeFile === 'string' ? maybeFile : '';
      const cat = detectMediaCategory({ file: fileOrDataUrl });
      const safeName = String(fileOrDataUrl.name || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
      key = `idb://${cat}-${Date.now()}-${safeName}`;
    }

    if (!key || !fileOrDataUrl) return null;

    try {
      const db = await openMediaDB();
      const cat =
        fileOrDataUrl instanceof Blob
          ? detectMediaCategory({ file: fileOrDataUrl })
          : detectMediaCategory({ fileUrl: String(fileOrDataUrl) });

      const safeFileNameKey =
        fileOrDataUrl?.name
          ? `idb://filename/${String(fileOrDataUrl.name).trim().toLowerCase()}`
          : null;
      const safeTitleKey =
        titleHint && String(titleHint).trim()
          ? `idb://title/${String(titleHint).trim().toLowerCase().replace(/\s+/g, ' ')}`
          : null;
      const latestCatKey = cat === 'video' ? 'idb://latest/video' : null;

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(fileOrDataUrl, key);
        if (safeFileNameKey) {
          store.put(fileOrDataUrl, safeFileNameKey);
        }
        if (safeTitleKey) {
          store.put(fileOrDataUrl, safeTitleKey);
        }
        if (latestCatKey) {
          store.put(fileOrDataUrl, latestCatKey);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      if (fileOrDataUrl instanceof Blob) {
        const norm = normalizePlayableBlob(fileOrDataUrl, fileOrDataUrl.name);
        memoryBlobCache.set(key, norm);
        if (safeFileNameKey) memoryBlobCache.set(safeFileNameKey, norm);
        if (safeTitleKey) memoryBlobCache.set(safeTitleKey, norm);
        if (latestCatKey) memoryBlobCache.set(latestCatKey, norm);
      }
      return key;
    } catch (err) {
      console.warn('IndexedDB media save note:', err);
      return null;
    }
  }

    export async function getMediaBlobFromIndexedDB(key, fileNameHint = '') {
      if (!key || typeof key !== 'string') return null;
        if (memoryBlobCache.has(key)) {
          const cachedBlob = memoryBlobCache.get(key);
          if (cachedBlob instanceof Blob) {
            return URL.createObjectURL(normalizePlayableBlob(cachedBlob, fileNameHint));
          }
        }
        try {
          const db = await openMediaDB();
          const stored = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          });
          if (!stored) return null;
          if (stored instanceof Blob) {
            const norm = normalizePlayableBlob(stored, fileNameHint || stored.name);
            memoryBlobCache.set(key, norm);
            return URL.createObjectURL(norm);
          }
          if (typeof stored === 'string') {
            return stored;
          }
          return null;
        } catch {
          return null;
        }
      }

            async function dataUrlToBlobUrl(dataUrl, fileNameHint = '') {
              if (memoryBlobCache.has(dataUrl)) {
                const cached = memoryBlobCache.get(dataUrl);
                if (cached instanceof Blob) {
                  return URL.createObjectURL(normalizePlayableBlob(cached, fileNameHint));
                }
              }
                try {
                  const res = await fetch(dataUrl);
                  const rawBlob = await res.blob();
                  const norm = normalizePlayableBlob(rawBlob, fileNameHint);
                  memoryBlobCache.set(dataUrl, norm);
                  return URL.createObjectURL(norm);
                } catch {
                  try {
                    const parts = dataUrl.split(',');
                    const mimeMatch = parts[0].match(/:(.*?);/);
                    const mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
                    const bstr = atob(parts[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                      u8arr[n] = bstr.charCodeAt(n);
                    }
                    const norm = normalizePlayableBlob(new Blob([u8arr], { type: mime }), fileNameHint);
                    memoryBlobCache.set(dataUrl, norm);
                    return URL.createObjectURL(norm);
                  } catch {
                    return dataUrl;
                  }
                }
              }

/**
 * Persists a file or data URL to Supabase so that even larger videos (> 2.4 MB)
 * are stored in Supabase `materials` across chunks and accessible on any device.
 * Returns either a direct `data:...` string (for smaller files) or `sbchunk://<id>` (for chunked files).
 */
export async function saveMediaToSupabaseChunks({
  file,
  dataUrl,
  fileName = '',
  titleHint = '',
  userId = null,
  categoryId = null,
}) {
  let finalDataUrl = typeof dataUrl === 'string' && dataUrl.startsWith('data:') ? dataUrl : '';

  if (!finalDataUrl && file instanceof Blob) {
    try {
      finalDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    } catch {
      finalDataUrl = '';
    }
  }

  if (!finalDataUrl || !finalDataUrl.startsWith('data:')) {
    return null;
  }

  if (finalDataUrl.length <= 2400000) {
    return finalDataUrl;
  }

  const safeSlug = String(fileName || titleHint || 'video')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  const chunkGroupId = `${Date.now()}_${safeSlug}`;
  const chunkSize = 2000000;
  const totalChunks = Math.ceil(finalDataUrl.length / chunkSize);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const slice = finalDataUrl.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkTitle = `[MEDIA_CHUNK]::${chunkGroupId}::${String(i).padStart(4, '0')}`;
      const { error } = await supabase.from('materials').insert({
        category_id: categoryId,
        type: 'video',
        title: chunkTitle,
        age_range: '3-4',
        content_url: `chunk:${i + 1}/${totalChunks}`,
        content_text: slice,
        created_by: userId,
        status: 'approved',
      });
      if (error) {
        console.warn('Supabase media chunk insert warning:', error);
        return null;
      }
    }

    const sbChunkRef = `sbchunk://${chunkGroupId}`;
    if (file instanceof Blob) {
      await saveMediaBlobToIndexedDB(sbChunkRef, file, titleHint);
    }
    return sbChunkRef;
  } catch (err) {
    console.warn('Supabase chunk save error:', err);
    return null;
  }
}

async function loadMediaFromSupabaseChunks(sbChunkUrl, fallbackFileName = '', fallbackTitle = '') {
  if (!sbChunkUrl || !sbChunkUrl.startsWith('sbchunk://')) return null;

  const cachedLocal = await getMediaBlobFromIndexedDB(sbChunkUrl, fallbackFileName);
  if (cachedLocal && cachedLocal.startsWith('blob:')) {
    return cachedLocal;
  }

  const chunkGroupId = sbChunkUrl.replace('sbchunk://', '').trim();
  if (!chunkGroupId) return null;

  try {
    const { data, error } = await supabase
      .from('materials')
      .select('title, content_text')
      .like('title', `[MEDIA_CHUNK]::${chunkGroupId}::%`)
      .order('title', { ascending: true });

    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const fullDataUrl = data.map((row) => row.content_text || '').join('');
    if (!fullDataUrl.startsWith('data:')) return null;

    const res = await fetch(fullDataUrl);
    const rawBlob = await res.blob();
    const normBlob = normalizePlayableBlob(rawBlob, fallbackFileName);

    await saveMediaBlobToIndexedDB(sbChunkUrl, normBlob, fallbackTitle);
    return URL.createObjectURL(normBlob);
  } catch (err) {
    console.warn('Failed reassembling Supabase media chunks:', err);
    return null;
  }
}

/**
 * Converts a data: URL, sbchunk:// reference, idb:// reference, or filename/title lookup into a browser-viewable/playable URL.
 */
export async function resolveViewableMediaUrl(rawUrl, fallbackFileName = '', fallbackTitle = '') {
  const urlStr = typeof rawUrl === 'string' && rawUrl !== 'true' && rawUrl !== 'false' ? rawUrl.trim() : '';

  if (urlStr.startsWith('sbchunk://')) {
    const fromChunks = await loadMediaFromSupabaseChunks(urlStr, fallbackFileName, fallbackTitle);
    if (fromChunks) return fromChunks;
  }

  if (urlStr.startsWith('idb://')) {
                  const fromIdb = await getMediaBlobFromIndexedDB(urlStr, fallbackFileName);
                  if (fromIdb) {
                    if (fromIdb.startsWith('blob:')) return fromIdb;
                    return resolveViewableMediaUrl(fromIdb, fallbackFileName, fallbackTitle);
                  }
                }

                if (urlStr.startsWith('data:')) {
                  return dataUrlToBlobUrl(urlStr, fallbackFileName);
                }

                if (urlStr.startsWith('blob:')) {
                  try {
                    const res = await fetch(urlStr);
                    if (res.ok) {
                      const blob = await res.blob();
                      if (blob.size > 0) {
                        return URL.createObjectURL(normalizePlayableBlob(blob, fallbackFileName));
                      }
                    }
                  } catch {
                    // Expired or revoked blob URL — fall through to IndexedDB lookup
                  }
                }

                if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
                  return urlStr;
                }

                // Fallback 1: look up by filename in IndexedDB
                if (fallbackFileName) {
                  const safeFileNameKey = `idb://filename/${String(fallbackFileName).trim().toLowerCase()}`;
                  const byName = await getMediaBlobFromIndexedDB(safeFileNameKey, fallbackFileName);
                  if (byName) {
                    if (byName.startsWith('blob:')) return byName;
                    return resolveViewableMediaUrl(byName, fallbackFileName, fallbackTitle);
                  }
                }

                // Fallback 2: look up by activity title in IndexedDB
                if (fallbackTitle) {
                  const safeTitleKey = `idb://title/${String(fallbackTitle).trim().toLowerCase().replace(/\s+/g, ' ')}`;
                  const byTitle = await getMediaBlobFromIndexedDB(safeTitleKey, fallbackFileName);
                  if (byTitle) {
                    if (byTitle.startsWith('blob:')) return byTitle;
                    return resolveViewableMediaUrl(byTitle, fallbackFileName, fallbackTitle);
                  }
                }

                // Fallback 3: check latest uploaded video in IndexedDB if this item is a video
                if (
                  isVideoItem({ url: urlStr, file_name: fallbackFileName }) ||
                  String(fallbackFileName).toLowerCase().match(/\.(mp4|mov|webm|m4v)$/)
                ) {
                  const latestVid = await getMediaBlobFromIndexedDB('idb://latest/video', fallbackFileName);
                  if (latestVid) {
                    if (latestVid.startsWith('blob:')) return latestVid;
                    return resolveViewableMediaUrl(latestVid, fallbackFileName, fallbackTitle);
                  }
                }

                return null;
              }

