import { describe, expect, it } from 'vitest';
import { hashPassword, validateNewPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Correct horse 42', 1000);
    expect(hash).toMatch(/^pbkdf2\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword('Correct horse 42', hash)).toBe(true);
    expect(await verifyPassword('correct horse 42', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('uses a random salt (same password, different hashes)', async () => {
    const a = await hashPassword('same-pass-1', 1000);
    const b = await hashPassword('same-pass-1', 1000);
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-pass-1', b)).toBe(true);
  });

  it('rejects malformed or missing hashes', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'plain-text')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$999999999$AA==$AA==')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$1000$!!$!!')).toBe(false);
  });

  it('never stores the password itself', async () => {
    const hash = await hashPassword('Temp-pass-77', 1000);
    expect(hash).not.toContain('Temp-pass-77');
  });
});

describe('new password rules', () => {
  it('requires 8+ characters with a letter and a number', () => {
    expect(validateNewPassword('short1')).toMatch(/at least 8/);
    expect(validateNewPassword('onlyletters')).toMatch(/letter and one number/);
    expect(validateNewPassword('12345678901')).toMatch(/letter and one number/);
    expect(validateNewPassword('Kandy2026!')).toBeNull();
  });

  it('blocks reusing the temporary password and obvious ones', () => {
    expect(validateNewPassword('Temp-pass-77', { current: 'Temp-pass-77' })).toMatch(/different/);
    expect(validateNewPassword('Password1')).toMatch(/too easy/);
    expect(validateNewPassword('qwerty123')).toMatch(/too easy/);
    expect(validateNewPassword('Kandy2026!', { current: 'Kandy2026!' })).toMatch(/different/);
  });

  it('does not allow the username inside the password', () => {
    expect(validateNewPassword('bawanthamadushan18x', { username: 'bawanthamadushan18' })).toMatch(
      /username/,
    );
  });
});
