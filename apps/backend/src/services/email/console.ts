import type { EmailService, SendEmailParams, SendEmailResult } from './interface.js';
import { resolveSendEmailParams } from './templates.js';

export class ConsoleEmailService implements EmailService {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const resolved = resolveSendEmailParams(params);
    console.log('[EMAIL]', JSON.stringify({ ...params, ...resolved }));
    return { success: true, messageId: 'console' };
  }
}
