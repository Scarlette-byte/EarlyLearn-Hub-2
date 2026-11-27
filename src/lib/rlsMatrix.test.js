import { describe, it, expect } from 'vitest';
import { isSuperAdminUser } from './roles.js';

describe('Role & RLS Matrix Expectations', () => {
  it('identifies superadmin users', () => {
    expect(isSuperAdminUser({ app_metadata: { role: 'superadmin' } })).toBe(true);
    expect(isSuperAdminUser({ app_metadata: { role: 'admin' } })).toBe(false);
    expect(isSuperAdminUser({ app_metadata: { role: 'teacher' } })).toBe(false);
    expect(isSuperAdminUser({ app_metadata: { role: 'parent' } })).toBe(false);
  });
});
