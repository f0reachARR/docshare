import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { members, organizations } from '../db/schema.js';
import type { AppVariables } from '../middleware/auth.js';

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(['owner', 'member']),
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: {
      description: 'ログイン中ユーザー情報',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string().email(),
                name: z.string(),
                isAdmin: z.boolean(),
              }),
              organizations: z.array(organizationSchema),
              activeOrganizationId: z.string().nullable(),
            }),
          }),
        },
      },
    },
    401: {
      description: '未認証',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Unauthorized') }),
        },
      },
    },
  },
});

export const meRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

meRoutes.openapi(meRoute, async (c) => {
  const user = c.get('currentUser');

  const orgRows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: members.role,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, user.id))
    .orderBy(asc(members.createdAt));

  return c.json(
    {
      data: {
        user,
        organizations: orgRows.map((row) => ({
          id: row.organizationId,
          name: row.organizationName,
          slug: row.organizationSlug,
          role: row.role,
        })),
        activeOrganizationId: c.get('organizationId'),
      },
    },
    200,
  );
});
