import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { auth } from '../auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { UserContext } from '../types.js';

export type AppVariables = {
  currentUser: UserContext;
  organizationId: string | null;
  sessionActiveOrganizationId: string | null;
};

type BetterAuthSession = {
  user?: {
    id?: string;
  };
  session?: {
    activeOrganizationId?: string | null;
  };
};

const parseSession = (value: unknown): BetterAuthSession | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as BetterAuthSession;
};

export const getCurrentUser = (c: Context<{ Variables: AppVariables }>): UserContext => {
  return c.get('currentUser');
};

export const requireAuth: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  let session: BetterAuthSession | null = null;

  try {
    session = parseSession(
      await auth.api.getSession({
        headers: c.req.raw.headers,
      }),
    );
  } catch {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  const userId = session?.user?.id;

  if (!userId) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows[0]) {
    throw new HTTPException(401, { message: 'Unknown user' });
  }

  c.set('sessionActiveOrganizationId', session?.session?.activeOrganizationId ?? null);
  c.set('currentUser', rows[0]);
  await next();
};
