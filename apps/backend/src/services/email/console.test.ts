import { describe, expect, it, vi } from 'vitest';
import { ConsoleEmailService } from './console.js';

describe('ConsoleEmailService', () => {
  it('returns success', async () => {
    const service = new ConsoleEmailService();
    const result = await service.sendEmail({
      to: 'foo@example.com',
      subject: 'test',
      html: '<p>hello</p>',
    });

    expect(result.success).toBe(true);
  });

  it('resolves template-based emails before logging', async () => {
    const service = new ConsoleEmailService();
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await service.sendEmail({
      to: 'owner@example.com',
      template: 'organization-invitation',
      payload: {
        organizationName: 'DocShare University',
        inviterName: 'Admin User',
        inviteLink: 'https://app.example.test/invite/inv-1',
      },
    });

    expect(result.success).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[EMAIL]',
      expect.stringContaining('"subject":"DocShare University への招待"'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[EMAIL]',
      expect.stringContaining('Admin User さんから'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[EMAIL]',
      expect.stringContaining('"text":"DocShare University への招待'),
    );

    consoleLogSpy.mockRestore();
  });
});
