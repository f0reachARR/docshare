export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult = {
  success: boolean;
  messageId?: string;
};

export interface EmailService {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}
