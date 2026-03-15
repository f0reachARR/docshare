import sendgridMail from "@sendgrid/mail";
import type {
  EmailService,
  SendEmailParams,
  SendEmailResult,
} from "./interface";

export class SendGridEmailService implements EmailService {
  constructor(
    apiKey: string,
    private readonly fromAddress: string,
  ) {
    sendgridMail.setApiKey(apiKey);
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const [res] = await sendgridMail.send({
      to: params.to,
      from: this.fromAddress,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return {
      success: res.statusCode >= 200 && res.statusCode < 300,
      messageId: res.headers["x-message-id"] as string | undefined,
    };
  }
}
