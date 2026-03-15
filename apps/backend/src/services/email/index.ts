import { env } from '../../lib/config.js';
import { ConsoleEmailService } from './console.js';
import type { EmailService } from './interface.js';
import { SendGridEmailService } from './sendgrid.js';

export const emailService: EmailService =
  env.EMAIL_PROVIDER === 'sendgrid' && env.SENDGRID_API_KEY
    ? new SendGridEmailService(env.SENDGRID_API_KEY, env.SENDGRID_FROM)
    : new ConsoleEmailService();
