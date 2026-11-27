import { describe, it, expect } from 'vitest';
import {
  ROLE_SUPERADMIN,
  ROLE_ADMIN,
  ROLE_TEACHER,
  ROLE_STUDENT,
  getEffectiveRole,
  isSuperAdminUser,
  getRoleDashboardPath,
} from '../src/lib/roles.js';

describe('Role resolution & route matrix (server-trusted app_metadata)', () => {
  it('returns null when app_metadata is absent (never trusts user_metadata)', () => {
    expect(getEffectiveRole(null)).toBeNull();
    expect(getEffectiveRole({})).toBeNull();
    expect(getEffectiveRole({ user_metadata: { role: 'admin' } })).toBeNull();
  });

  it('resolves superadmin, admin, teacher, and student/parent from app_metadata', () => {
    expect(getEffectiveRole({ app_metadata: { role: 'superadmin' } })).toBe(ROLE_SUPERADMIN);
    expect(getEffectiveRole({ app_metadata: { role: 'admin', is_superadmin: true } })).toBe(ROLE_SUPERADMIN);
    expect(getEffectiveRole({ app_metadata: { role: 'admin' } })).toBe(ROLE_ADMIN);
    expect(getEffectiveRole({ app_metadata: { role: 'teacher' } })).toBe(ROLE_TEACHER);
    expect(getEffectiveRole({ app_metadata: { role: 'student' } })).toBe(ROLE_STUDENT);
    expect(getEffectiveRole({ app_metadata: { role: 'parent' } })).toBe(ROLE_STUDENT);
  });

  it('identifies superadmin strictly from app_metadata', () => {
    expect(isSuperAdminUser({ app_metadata: { role: 'superadmin' } })).toBe(true);
    expect(isSuperAdminUser({ app_metadata: { role: 'admin', is_superadmin: true } })).toBe(true);
    expect(isSuperAdminUser({ app_metadata: { role: 'admin' } })).toBe(false);
    expect(isSuperAdminUser({ user_metadata: { is_superadmin: true } })).toBe(false);
  });

  it('maps each role to its canonical dashboard route', () => {
    expect(getRoleDashboardPath(ROLE_SUPERADMIN)).toBe('/admin-dashboard');
    expect(getRoleDashboardPath(ROLE_ADMIN)).toBe('/admin-dashboard');
    expect(getRoleDashboardPath(ROLE_TEACHER)).toBe('/teacher-dashboard');
    expect(getRoleDashboardPath(ROLE_STUDENT)).toBe('/student-dashboard');
    expect(getRoleDashboardPath(null)).toBe('/login');
  });
});
