// Shared File Size Limits, Validation, Video/Media Detection & IndexedDB Large-File Storage
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
 * Checks whether an activity/material or submission item is a video
 */
export function isVideoItem({ fileUrl = '', fileName = '', fileType = '', moduleType = '' } = {}) {
  const fType = String(fileType || '').toUpperCase();
  const mType = String(moduleType || '').toLowerCase();
  const url = String(fileUrl || '');
  const name = String(fileName || '');

  if (
    url.startsWith('data:video/') ||
    url.startsWith('idb://video-') ||
    /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(name || url) ||
    ['MP4', 'WEBM', 'MOV', 'OGG', 'M4V', 'VIDEO'].includes(fType) ||
    mType.includes('video') ||
    Boolean(getEmbeddedVideoUrl(url))
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether an activity/material or submission item is an image
 */
export function isImageItem({ fileUrl = '', fileName = '', fileType = '', moduleType = '' } = {}) {
  const fType = String(fileType || '').toUpperCase();
  const mType = String(moduleType || '').toLowerCase();
  const url = String(fileUrl || '');
  const name = String(fileName || '');

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
 * Checks whether an activity/material or submission item is a PDF document
 */
export function isPdfItem({ fileUrl = '', fileName = '', fileType = '' } = {}) {
  const fType = String(fileType || '').toUpperCase();
  const url = String(fileUrl || '');
  const name = String(fileName || '');

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
// localStorage 5 MB quota, with in-memory Blob URL cache for instant playback)
// ============================================================================
const DB_NAME = 'earlylearn_media_db';
const STORE_NAME = 'media_files';
const memoryBlobUrlCache = new Map();

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

export async function saveMediaBlobToIndexedDB(key, fileOrDataUrl) {
  try {
    const db = await openMediaDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(fileOrDataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (fileOrDataUrl instanceof Blob) {
      const blobUrl = URL.createObjectURL(fileOrDataUrl);
      memoryBlobUrlCache.set(key, blobUrl);
    } else if (typeof fileOrDataUrl === 'string') {
      memoryBlobUrlCache.set(key, fileOrDataUrl);
    }
    return true;
  } catch (err) {
    console.warn('IndexedDB media save note:', err);
    return false;
  }
}

export async function getMediaBlobFromIndexedDB(key) {
  if (!key) return null;
  if (memoryBlobUrlCache.has(key)) {
    return memoryBlobUrlCache.get(key);
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
      const blobUrl = URL.createObjectURL(stored);
      memoryBlobUrlCache.set(key, blobUrl);
      return blobUrl;
    }
    if (typeof stored === 'string') {
      memoryBlobUrlCache.set(key, stored);
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Converts a data: URL or idb:// reference into a browser-viewable/playable Blob URL
 */
export async function resolveViewableMediaUrl(rawUrl) {
  if (!rawUrl) return null;
  if (typeof rawUrl === 'string' && rawUrl.startsWith('idb://')) {
    const fromIdb = await getMediaBlobFromIndexedDB(rawUrl);
    if (fromIdb) {
      return resolveViewableMediaUrl(fromIdb);
    }
    return null;
  }
  if (typeof rawUrl === 'string' && rawUrl.startsWith('data:')) {
    if (memoryBlobUrlCache.has(rawUrl)) {
      return memoryBlobUrlCache.get(rawUrl);
    }
    try {
      const parts = rawUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      memoryBlobUrlCache.set(rawUrl, blobUrl);
      return blobUrl;
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

