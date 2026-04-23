import { env } from './config.js';

export const buildInvitationLink = (invitationId: string): string =>
  new URL(`/invite/${encodeURIComponent(invitationId)}`, env.APP_URL).toString();
