import { randomUUID } from 'node:crypto';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invitations, members, organizations, users } from '../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../lib/pagination.js';
import type { AppVariables } from '../middleware/auth.js';
import { emailService } from '../services/email/index.js';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'member']),
});

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'member']),
});

const orgHeaderSchema = z.object({
  'x-organization-id': z.string(),
});

const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  role: z.enum(['owner', 'member']),
  name: z.string(),
  email: z.string().email(),
});

const listMemberSortValues = [
  'name:asc',
  'name:desc',
  'email:asc',
  'email:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

const listMemberQuerySchema = createPagingQuerySchema(listMemberSortValues, true);

const listUniversityMembersRoute = createRoute({
  method: 'get',
  path: '/university/members',
  request: {
    headers: orgHeaderSchema,
    query: listMemberQuerySchema,
  },
  responses: {
    200: {
      description: '所属メンバー一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(memberSchema),
        },
      },
    },
    400: {
      description: '組織指定不足',
      content: {
        'application/json': {
          schema: z.object({
            error: z.union([
              z.literal('x-organization-id is required'),
              z.literal('Invalid query'),
            ]),
          }),
        },
      },
    },
    422: {
      description: '不正ソート',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Invalid sort') }),
        },
      },
    },
    403: {
      description: 'オーナー限定',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Owner only') }),
        },
      },
    },
  },
});

const invitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'member']),
  inviterId: z.string(),
  expiresAt: z.any(),
  createdAt: z.any(),
});

const inviteUniversityRoute = createRoute({
  method: 'post',
  path: '/university/invite',
  request: {
    headers: orgHeaderSchema,
    body: {
      content: {
        'application/json': {
          schema: inviteSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '招待作成',
      content: {
        'application/json': {
          schema: z.object({ data: invitationSchema }),
        },
      },
    },
    400: {
      description: '不正入力',
      content: {
        'application/json': {
          schema: z.object({ error: z.any() }),
        },
      },
    },
    403: {
      description: 'オーナー限定',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Owner only') }),
        },
      },
    },
  },
});

const updateUniversityMemberRoleRoute = createRoute({
  method: 'put',
  path: '/university/members/{id}/role',
  request: {
    headers: orgHeaderSchema,
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: updateRoleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'メンバー権限更新',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.string(),
              userId: z.string(),
              role: z.enum(['owner', 'member']),
            }),
          }),
        },
      },
    },
    400: {
      description: '不正入力',
      content: {
        'application/json': {
          schema: z.object({
            error: z.union([z.literal('x-organization-id is required'), z.any()]),
          }),
        },
      },
    },
    403: {
      description: 'オーナー限定',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Owner only') }),
        },
      },
    },
    404: {
      description: '対象未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
    409: {
      description: '最後のownerの降格禁止',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Last owner cannot be removed') }),
        },
      },
    },
  },
});

const deleteUniversityMemberRoute = createRoute({
  method: 'delete',
  path: '/university/members/{id}',
  request: {
    headers: orgHeaderSchema,
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: {
      description: 'メンバー削除',
    },
    400: {
      description: '組織指定不足',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('x-organization-id is required') }),
        },
      },
    },
    403: {
      description: 'オーナー限定',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Owner only') }),
        },
      },
    },
    409: {
      description: '最後のownerの削除禁止',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Last owner cannot be removed') }),
        },
      },
    },
  },
});

export const universityRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

const canManageMembers = async (userId: string, organizationId: string): Promise<boolean> => {
  const adminRows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (adminRows[0]?.isAdmin) {
    return true;
  }

  const ownerRows = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
    .limit(1);

  return ownerRows[0]?.role === 'owner';
};

const getScopedMember = async (memberId: string, organizationId: string) => {
  const rows = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
    .limit(1);

  return rows[0] ?? null;
};

const isLastOwner = async (organizationId: string): Promise<boolean> => {
  const rows = await db
    .select({ total: count() })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.role, 'owner')));

  return (rows[0]?.total ?? 0) <= 1;
};

universityRoutes.openapi(listUniversityMembersRoute, async (c) => {
  const organizationId = c.get('organizationId');
  if (!organizationId) {
    return c.json({ error: 'x-organization-id is required' as const }, 400);
  }

  const user = c.get('currentUser');
  if (!(await canManageMembers(user.id, organizationId))) {
    return c.json({ error: 'Owner only' as const }, 403);
  }

  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: listMemberQuerySchema,
    sortValues: listMemberSortValues,
    defaultSort: 'createdAt:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const whereClause = and(
    eq(members.organizationId, organizationId),
    parsed.value.q
      ? or(ilike(users.name, `%${parsed.value.q}%`), ilike(users.email, `%${parsed.value.q}%`))
      : undefined,
  );

  const totalRows = await db
    .select({ total: count() })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(whereClause);

  const sortColumn =
    parsed.value.sort.field === 'name'
      ? users.name
      : parsed.value.sort.field === 'email'
        ? users.email
        : members.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      id: members.id,
      userId: members.userId,
      role: members.role,
      name: users.name,
      email: users.email,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(whereClause)
    .orderBy(mainOrder, asc(members.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  return c.json(
    {
      data: rows,
      pagination: createPaginationMeta({
        page: parsed.value.page,
        pageSize: parsed.value.pageSize,
        total: totalRows[0]?.total ?? 0,
      }),
    },
    200,
  );
});

universityRoutes.openapi(inviteUniversityRoute, async (c) => {
  const organizationId = c.get('organizationId');
  if (!organizationId) {
    return c.json({ error: 'x-organization-id is required' as const }, 400);
  }

  const user = c.get('currentUser');
  const body = inviteSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  if (!(await canManageMembers(user.id, organizationId))) {
    return c.json({ error: 'Owner only' as const }, 403);
  }

  const inviter = await db
    .select({ orgName: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const inserted = await db
    .insert(invitations)
    .values({
      id: invitationId,
      organizationId,
      email: body.data.email,
      role: body.data.role,
      inviterId: user.id,
      expiresAt,
    })
    .returning();

  await emailService.sendEmail({
    to: body.data.email,
    subject: `${inviter[0]?.orgName ?? organizationId} への招待`,
    html: `招待リンク: invitation:${invitationId}`,
  });

  return c.json({ data: inserted[0] }, 201);
});

universityRoutes.openapi(updateUniversityMemberRoleRoute, async (c) => {
  const organizationId = c.get('organizationId');
  if (!organizationId) {
    return c.json({ error: 'x-organization-id is required' as const }, 400);
  }

  const user = c.get('currentUser');
  const memberId = c.req.param('id');
  const body = updateRoleSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  if (!(await canManageMembers(user.id, organizationId))) {
    return c.json({ error: 'Owner only' as const }, 403);
  }

  const targetMember = await getScopedMember(memberId, organizationId);
  if (!targetMember) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  if (
    targetMember.role === 'owner' &&
    body.data.role !== 'owner' &&
    (await isLastOwner(organizationId))
  ) {
    return c.json({ error: 'Last owner cannot be removed' as const }, 409);
  }

  const updated = await db
    .update(members)
    .set({ role: body.data.role })
    .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
    .returning();

  return c.json({ data: updated[0] }, 200);
});

universityRoutes.openapi(deleteUniversityMemberRoute, async (c) => {
  const organizationId = c.get('organizationId');
  if (!organizationId) {
    return c.json({ error: 'x-organization-id is required' as const }, 400);
  }

  const user = c.get('currentUser');
  const memberId = c.req.param('id');

  if (!(await canManageMembers(user.id, organizationId))) {
    return c.json({ error: 'Owner only' as const }, 403);
  }

  const targetMember = await getScopedMember(memberId, organizationId);
  if (targetMember?.role === 'owner' && (await isLastOwner(organizationId))) {
    return c.json({ error: 'Last owner cannot be removed' as const }, 409);
  }

  await db
    .delete(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)));
  return c.body(null, 204);
});
