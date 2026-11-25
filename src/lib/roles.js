// Centralized server-trusted role resolution for EarlyLearn Hub.
// Role and superadmin authority are derived strictly from Supabase JWT `app_metadata`
// (populated server-side in 1C). Client-editable `user_metadata`, `localStorage`,
// and `public.profiles.role` are never trusted for authorization.

export const ROLE_SUPERADMIN = 'superadmin';
export const ROLE_ADMIN = 'admin';
export const ROLE_TEACHER = 'teacher';
export const ROLE_STUDENT = 'student';

/**
 * Decodes the `app_metadata` object from a Supabase JWT access token payload, if provided.
 * Used only as a read-side fallback alongside `user.app_metadata` (e.g. when a Custom Access
 * Token Hook injects claims directly into the JWT). Server APIs verify the JWT signature.
 */
export function decodeJwtAppMetadata(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    if (payload && typeof payload.app_metadata === 'object' && payload.app_metadata !== null) {
      return payload.app_metadata;
    }
  } catch {
    // Ignore malformed tokens
  }
  return null;
}

/**
 * Extracts server-controlled `app_metadata` from a Supabase User, Session, or wrapper object.
 */
export function getTrustedAppMetadata(subject) {
  if (!subject || typeof subject !== 'object') return null;

  const userAppMeta =
    subject.app_metadata && typeof subject.app_metadata === 'object'
      ? subject.app_metadata
      : subject.user?.app_metadata && typeof subject.user.app_metadata === 'object'
        ? subject.user.app_metadata
        : null;

  const token =
    typeof subject.access_token === 'string'
      ? subject.access_token
      : typeof subject.session?.access_token === 'string'
        ? subject.session.access_token
        : null;

  const jwtAppMeta = decodeJwtAppMetadata(token);

  if (!userAppMeta && !jwtAppMeta) return null;
  return { ...(jwtAppMeta || {}), ...(userAppMeta || {}) };
}

/**
 * Determines whether the subject carries a server-trusted Superadmin claim in `app_metadata`.
 */
export function isSuperAdminUser(subject) {
  const appMeta = getTrustedAppMetadata(subject);
  if (!appMeta) return false;

  const rawRole = String(appMeta.role || '').toLowerCase().trim();
  return rawRole === ROLE_SUPERADMIN || appMeta.is_superadmin === true;
}

/**
 * Returns the server-trusted application role from JWT `app_metadata`:
 *   'superadmin' | 'admin' | 'teacher' | 'student' | null
 * Returns `null` when no valid server `app_metadata` role claim is present.
 */
export function getEffectiveRole(subject) {
  const appMeta = getTrustedAppMetadata(subject);
  if (!appMeta) return null;

  if (isSuperAdminUser(subject)) return ROLE_SUPERADMIN;

  const rawRole = String(appMeta.role || '').toLowerCase().trim();
  if (rawRole === ROLE_ADMIN) return ROLE_ADMIN;
  if (rawRole === ROLE_TEACHER) return ROLE_TEACHER;
  if (rawRole === ROLE_STUDENT || rawRole === 'parent') return ROLE_STUDENT;

  return null;
}

/**
 * Maps a server-trusted role to its canonical dashboard route, or `/login` when absent.
 */
export function getRoleDashboardPath(role) {
  if (role === ROLE_SUPERADMIN || role === ROLE_ADMIN) return '/admin-dashboard';
  if (role === ROLE_TEACHER) return '/teacher-dashboard';
  if (role === ROLE_STUDENT || role === 'parent') return '/student-dashboard';
  return '/login';
}

/**
 * Maps an application role to the value stored in `public.profiles.role`
 * (`CHECK (role IN ('student', 'teacher', 'admin'))`).
 */
export function getDbRole(role) {
  if (role === ROLE_SUPERADMIN || role === ROLE_ADMIN) return ROLE_ADMIN;
  if (role === ROLE_TEACHER) return ROLE_TEACHER;
  return ROLE_STUDENT;
}

/**
 * Human-readable label for roles.
 */
export function formatRoleLabel(role) {
  switch (role) {
    case ROLE_SUPERADMIN:
      return 'Municipal Superadmin';
    case ROLE_ADMIN:
      return 'MSWD ECCD Administrator';
    case ROLE_TEACHER:
      return 'Daycare Worker (Teacher)';
    case ROLE_STUDENT:
      return 'Learner / Parent';
    default:
      return role || 'User';
  }
}
