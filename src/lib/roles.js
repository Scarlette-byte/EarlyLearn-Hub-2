// Centralized role definition and superadmin governance for EarlyLearn Hub

export const ROLE_SUPERADMIN = 'superadmin';
export const ROLE_ADMIN = 'admin';
export const ROLE_TEACHER = 'teacher';
export const ROLE_STUDENT = 'student';

// Known hardcoded/default superadmin accounts
export const DEFAULT_SUPERADMIN_IDS = [
  '3cb5bc92-1742-414d-8d12-e9cc523464f6', // superadmin@earlylearn.ph
];

export const DEFAULT_SUPERADMIN_EMAILS = [
  'superadmin@earlylearn.ph',
];

const LOCAL_STORAGE_SUPERADMINS_KEY = 'earlylearn_superadmin_ids';

/**
 * Returns all recognized superadmin IDs (hardcoded defaults + dynamic additions from localStorage).
 */
export function getSuperAdminIds() {
  const ids = new Set(DEFAULT_SUPERADMIN_IDS);
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUPERADMINS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => id && ids.add(id));
      }
    }
  } catch {
    // Ignore localStorage parsing issues
  }
  return Array.from(ids);
}

/**
 * Registers an ID as superadmin in local persistent storage.
 */
export function addSuperAdminId(id) {
  if (!id) return;
  try {
    const current = getSuperAdminIds();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(LOCAL_STORAGE_SUPERADMINS_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Removes an ID from the dynamic superadmin registry (cannot remove the primary default ID).
 */
export function removeSuperAdminId(id) {
  if (!id || DEFAULT_SUPERADMIN_IDS.includes(id)) return;
  try {
    const current = getSuperAdminIds().filter((existing) => existing !== id);
    localStorage.setItem(LOCAL_STORAGE_SUPERADMINS_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Determines whether a user or profile object represents a Superadmin.
 */
export function isSuperAdminUser(userOrProfile) {
  if (!userOrProfile) return false;

  // Direct boolean flag
  if (userOrProfile.is_superadmin === true || userOrProfile.isSuperAdmin === true) return true;

  // Explicit role string
  if (userOrProfile.role === 'superadmin' || userOrProfile.role_tier === 'superadmin') return true;

  // Supabase Auth metadata checks
  if (userOrProfile.user_metadata) {
    const meta = userOrProfile.user_metadata;
    if (meta.role === 'superadmin' || meta.is_superadmin === true || meta.role_tier === 'superadmin') {
      return true;
    }
  }

  // App metadata checks
  if (userOrProfile.app_metadata) {
    const appMeta = userOrProfile.app_metadata;
    if (appMeta.role === 'superadmin' || appMeta.is_superadmin === true) {
      return true;
    }
  }

  // Recognized ID check
  if (userOrProfile.id && getSuperAdminIds().includes(userOrProfile.id)) {
    return true;
  }

  // Recognized Email check
  const email = (
    userOrProfile.email ||
    userOrProfile.user_metadata?.email ||
    ''
  ).toLowerCase().trim();
  if (email && DEFAULT_SUPERADMIN_EMAILS.includes(email)) {
    return true;
  }

  return false;
}

/**
 * Returns the effective application role:
 * 'superadmin' | 'admin' | 'teacher' | 'student'
 */
export function getEffectiveRole(userOrProfile) {
  if (!userOrProfile) return 'student';
  if (isSuperAdminUser(userOrProfile)) return 'superadmin';

  const role =
    userOrProfile.role ||
    userOrProfile.user_metadata?.role ||
    'student';

  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'teacher';
  return 'student';
}

/**
 * Returns the role value safe to write into the PostgreSQL profiles table.
 * The PostgreSQL database has `CHECK (role IN ('student', 'teacher', 'admin'))`.
 * Hence, 'superadmin' is mapped to 'admin' at the database column level, while
 * superadmin metadata is preserved in auth metadata and the superadmin registry.
 */
export function getDbRole(role) {
  if (role === 'superadmin') return 'admin';
  if (role === 'teacher') return 'teacher';
  if (role === 'admin') return 'admin';
  return 'student';
}

/**
 * Human readable label for roles
 */
export function formatRoleLabel(role) {
  switch (role) {
    case 'superadmin':
      return 'Municipal Superadmin';
    case 'admin':
      return 'MSWD ECCD Administrator';
    case 'teacher':
      return 'Daycare Worker (Teacher)';
    case 'student':
      return 'Learner / Parent';
    default:
      return role || 'User';
  }
}
