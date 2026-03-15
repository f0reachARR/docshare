import type {
  EmailService,
  SendEmailParams,
  SendEmailResult,
} from "./interface";

export class ConsoleEmailService implements EmailService {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    console.log("[EMAIL]", JSON.stringify(params));
    return { success: true, messageId: "console" };
  }
}
