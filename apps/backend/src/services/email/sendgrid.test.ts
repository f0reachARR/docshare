import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
const setApiKeyMock = vi.fn();

vi.mock('@sendgrid/mail', () => ({
  default: {
    send: sendMock,
    setApiKey: setApiKeyMock,
  },
}));

describe('SendGridEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue([
      {
        statusCode: 202,
        headers: {
          'x-message-id': 'message-1',
        },
      },
    ]);
  });

  it('sends raw subject/html emails as-is', async () => {
    const { SendGridEmailService } = await import('./sendgrid.js');
    const service = new SendGridEmailService('test-key', 'from@example.com');

    const result = await service.sendEmail({
      to: 'owner@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
      text: 'World',
    });

    expect(setApiKeyMock).toHaveBeenCalledWith('test-key');
    expect(sendMock).toHaveBeenCalledWith({
      to: 'owner@example.com',
      from: 'from@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
      text: 'World',
    });
    expect(result).toEqual({
      success: true,
      messageId: 'message-1',
    });
  });

  it('resolves template-based emails before sending', async () => {
    const { SendGridEmailService } = await import('./sendgrid.js');
    const service = new SendGridEmailService('test-key', 'from@example.com');

    await service.sendEmail({
      to: 'owner@example.com',
      template: 'university-owner-invitation-link',
      payload: {
        universityName: 'Approve University',
        invitationLink: 'https://app.example.test/invite/invite-1',
      },
    });

    expect(sendMock).toHaveBeenCalledWith({
      to: 'owner@example.com',
      from: 'from@example.com',
      subject: 'Approve University の代表者招待',
      html: expect.stringContaining('https://app.example.test/invite/invite-1'),
      text: expect.stringContaining('代表者設定を開く: https://app.example.test/invite/invite-1'),
    });
  });
});
