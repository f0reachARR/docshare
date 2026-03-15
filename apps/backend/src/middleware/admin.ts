import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppVariables } from './auth.js';

export const requireAdmin: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const user = c.get('currentUser');
  if (!user.isAdmin) {
    throw new HTTPException(403, { message: 'Admin only' });
  }

  await next();
};
