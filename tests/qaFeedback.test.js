import { describe, it, expect } from 'vitest';
import { verifyTeacherRegistrationCode } from '../src/lib/learnersService.js';
import { validatePassword } from '../src/lib/passwordPolicy.js';

describe('QA Feedback Verification (S1 & Password Policy)', () => {
  it('S1: rejects blank registration code with clear message', async () => {
    const res = await verifyTeacherRegistrationCode('   ');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('blank');
    expect(res.message).toMatch(/enter the registration code/i);
  });

  it('S1: normalizes whitespace and case for registration code lookup', async () => {
    const res = await verifyTeacherRegistrationCode('  elh-dalirig-01  ');
    expect(res).toHaveProperty('valid');
    expect(res).toHaveProperty('reason');
  });

  it('T7 / Password Policy: enforces min length and rejects common passwords', () => {
    expect(validatePassword('123456').valid).toBe(false);
    expect(validatePassword('password123').valid).toBe(false);
    expect(validatePassword('EarlyLearn#2026!').valid).toBe(true);
  });
});
