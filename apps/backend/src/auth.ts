import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { db } from './db/index.js';
import { env } from './lib/config.js';
import { emailService } from './services/email/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `${env.APP_URL}/invite/${data.id}`;
        await emailService.sendEmail({
          to: data.email,
          subject: `${data.organization.name} への招待`,
          html: `${data.inviter.user.name} さんが ${data.organization.name} へ招待しました: ${inviteLink}`,
        });
      },
    }),
  ],
});
