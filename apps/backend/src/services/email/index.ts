import { env } from "../../lib/config";
import { ConsoleEmailService } from "./console";
import type { EmailService } from "./interface";
import { SendGridEmailService } from "./sendgrid";

export const emailService: EmailService =
  env.EMAIL_PROVIDER === "sendgrid" && env.SENDGRID_API_KEY
    ? new SendGridEmailService(env.SENDGRID_API_KEY, env.SENDGRID_FROM)
    : new ConsoleEmailService();
