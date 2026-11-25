import { describe, it, expect } from 'vitest';
import { isSuperAdminUser } from './roles.js';

describe('Role & RLS Matrix Expectations', () => {
  it('identifies superadmin users', () => {
    expect(isSuperAdminUser({ role: 'superadmin' })).toBe(true);
    expect(isSuperAdminUser({ role: 'admin' })).toBe(false);
    expect(isSuperAdminUser({ role: 'teacher' })).toBe(false);
    expect(isSuperAdminUser({ role: 'parent' })).toBe(false);
  });
});
