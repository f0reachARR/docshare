import { and, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { members } from '../db/schema.js';
import type { AppVariables } from './auth.js';

export const resolveOrganization: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const organizationId =
    c.req.header("x-organization-id") ??
    c.get("sessionActiveOrganizationId") ??
    null;

  if (organizationId) {
    const user = c.get("currentUser");
    if (!user.isAdmin) {
      const row = await db
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.userId, user.id),
            eq(members.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!row[0]) {
        throw new HTTPException(403, {
          message: "Invalid organization context",
        });
      }
    }
  }

  c.set("organizationId", organizationId);
  await next();
};
