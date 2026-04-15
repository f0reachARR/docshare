import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { env } from './lib/config.js';
import { verifyPassword } from './lib/password.js';
import { emailService } from './services/email/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  user: {
    additionalFields: {
      isAdmin: {
        type: 'boolean',
        defaultValue: false,
        required: true,
        input: false,
      },
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.CORS_ALLOWED_ORIGINS,
  emailAndPassword: {
    enabled: true,
    password: {
      verify: verifyPassword,
    },
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
