import { hashPassword } from 'better-auth/crypto';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from './password.js';

describe('verifyPassword', () => {
  it('verifies Better Auth password hashes', async () => {
    const hash = await hashPassword('new-password');

    await expect(verifyPassword({ hash, password: 'new-password' })).resolves.toBe(true);
    await expect(verifyPassword({ hash, password: 'wrong-password' })).resolves.toBe(false);
  });

  it('verifies Django pbkdf2_sha256 password hashes', async () => {
    const hash = 'pbkdf2_sha256$36000$legacySalt$GG9otjH9r8QBoKZDd7/L4DCcbu41jt83tRS4YRMi/tY=';

    await expect(verifyPassword({ hash, password: 'legacy-password' })).resolves.toBe(true);
    await expect(verifyPassword({ hash, password: 'wrong-password' })).resolves.toBe(false);
  });
});
