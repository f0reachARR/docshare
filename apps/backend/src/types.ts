import type { auth } from './auth.js';

export type UserContext = typeof auth.$Infer.Session.user;
export type SessionContext = typeof auth.$Infer.Session.session;
