import sendgridMail from '@sendgrid/mail';
import type { EmailService, SendEmailParams, SendEmailResult } from './interface.js';
import { resolveSendEmailParams } from './templates.js';

export class SendGridEmailService implements EmailService {
  constructor(
    apiKey: string,
    private readonly fromAddress: string,
  ) {
    sendgridMail.setApiKey(apiKey);
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const resolved = resolveSendEmailParams(params);
    const [res] = await sendgridMail.send({
      to: resolved.to,
      from: this.fromAddress,
      subject: resolved.subject,
      html: resolved.html,
      text: resolved.text,
    });

    return {
      success: res.statusCode >= 200 && res.statusCode < 300,
      messageId: res.headers['x-message-id'] as string | undefined,
    };
  }
}
