import { describe, expect, it } from 'vitest';
import type { SharingStatus } from './index';

describe('shared types', () => {
  it('accepts known status', () => {
    const status: SharingStatus = 'sharing';
    expect(status).toBe('sharing');
  });
});
