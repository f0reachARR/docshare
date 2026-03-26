import { describe, expect, it } from 'vitest';
describe('shared types', () => {
    it('accepts known status', () => {
        const status = 'sharing';
        expect(status).toBe('sharing');
    });
});
