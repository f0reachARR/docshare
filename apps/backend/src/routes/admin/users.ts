import { randomUUID } from 'node:crypto';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { members, organizations, users } from '../../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../../lib/pagination.js';
import type { AppVariables } from '../../middleware/auth.js';
import { getMemberById, isLastOwner } from '../../services/membership-management.js';

const userListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  isAdmin: z.boolean(),
  createdAt: z.any(),
  organizationCount: z.number(),
});

const membershipSchema = z.object({
  memberId: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: z.enum(['owner', 'member']),
  createdAt: z.any(),
});

const createdMembershipSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: z.enum(['owner', 'member']),
  createdAt: z.any(),
});

const listUserSortValues = [
  'name:asc',
  'name:desc',
  'email:asc',
  'email:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

const createMembershipBodySchema = z.object({
  organizationId: z.string().min(1),
  role: z.enum(['owner', 'member']),
});

const updateMembershipRoleBodySchema = z.object({
  role: z.enum(['owner', 'member']),
});

const isMemberUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const pgError = error as { code?: unknown; constraint?: unknown };
  return pgError.code === '23505' && pgError.constraint === 'member_org_user_unique';
};

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  request: {
    query: createPagingQuerySchema(listUserSortValues, true),
  },
  responses: {
    200: {
      description: 'ユーザー一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(userListItemSchema),
        },
      },
    },
    400: {
      description: '不正クエリ',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Invalid query') }),
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
  },
});

const listUserMembershipsRoute = createRoute({
  method: 'get',
  path: '/users/{userId}/memberships',
  request: {
    params: z.object({ userId: z.string() }),
  },
  responses: {
    200: {
      description: 'ユーザー所属一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(membershipSchema) }),
        },
      },
    },
    404: {
      description: 'ユーザー未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
  },
});

const createUserMembershipRoute = createRoute({
  method: 'post',
  path: '/users/{userId}/memberships',
  request: {
    params: z.object({ userId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: createMembershipBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '所属作成',
      content: {
        'application/json': {
          schema: z.object({ data: createdMembershipSchema }),
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
    404: {
      description: '対象未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
    409: {
      description: '重複所属',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Membership already exists') }),
        },
      },
    },
  },
});

const updateMembershipRoleRoute = createRoute({
  method: 'put',
  path: '/memberships/{memberId}/role',
  request: {
    params: z.object({ memberId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: updateMembershipRoleBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '所属ロール更新',
      content: {
        'application/json': {
          schema: z.object({ data: createdMembershipSchema }),
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
    404: {
      description: '所属未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
    409: {
      description: '最後のowner保護',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Last owner cannot be removed') }),
        },
      },
    },
  },
});

const deleteMembershipRoute = createRoute({
  method: 'delete',
  path: '/memberships/{memberId}',
  request: {
    params: z.object({ memberId: z.string() }),
  },
  responses: {
    204: {
      description: '所属解除',
    },
    404: {
      description: '所属未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
    409: {
      description: '最後のowner保護',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Last owner cannot be removed') }),
        },
      },
    },
  },
});

export const adminUserRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

adminUserRoutes.openapi(listUsersRoute, async (c) => {
  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: createPagingQuerySchema(listUserSortValues, true),
    sortValues: listUserSortValues,
    defaultSort: 'createdAt:desc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const whereClause = parsed.value.q
    ? or(ilike(users.name, `%${parsed.value.q}%`), ilike(users.email, `%${parsed.value.q}%`))
    : undefined;

  const totalRows = whereClause
    ? await db.select({ total: count() }).from(users).where(whereClause)
    : await db.select({ total: count() }).from(users);

  const sortColumn =
    parsed.value.sort.field === 'name'
      ? users.name
      : parsed.value.sort.field === 'email'
        ? users.email
        : users.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      organizationCount: count(members.id),
    })
    .from(users)
    .leftJoin(members, eq(members.userId, users.id))
    .where(whereClause)
    .groupBy(users.id, users.name, users.email, users.isAdmin, users.createdAt)
    .orderBy(mainOrder, asc(users.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  return c.json(
    {
      data: rows.map((row) => ({
        ...row,
        organizationCount: Number(row.organizationCount ?? 0),
      })),
      pagination: createPaginationMeta({
        page: parsed.value.page,
        pageSize: parsed.value.pageSize,
        total: totalRows[0]?.total ?? 0,
      }),
    },
    200,
  );
});

adminUserRoutes.openapi(listUserMembershipsRoute, async (c) => {
  const userId = c.req.param('userId');
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const rows = await db
    .select({
      memberId: members.id,
      organizationId: members.organizationId,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: members.role,
      createdAt: members.createdAt,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId))
    .orderBy(asc(organizations.name), asc(members.id));

  return c.json({ data: rows }, 200);
});

adminUserRoutes.openapi(createUserMembershipRoute, async (c) => {
  const userId = c.req.param('userId');
  const body = createMembershipBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const organizationRows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, body.data.organizationId))
    .limit(1);
  if (!organizationRows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const existing = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, body.data.organizationId)))
    .limit(1);
  if (existing[0]) {
    return c.json({ error: 'Membership already exists' as const }, 409);
  }

  try {
    const inserted = await db
      .insert(members)
      .values({
        id: randomUUID(),
        userId,
        organizationId: body.data.organizationId,
        role: body.data.role,
      })
      .returning();

    return c.json({ data: inserted[0] }, 201);
  } catch (error) {
    if (isMemberUniqueViolation(error)) {
      return c.json({ error: 'Membership already exists' as const }, 409);
    }
    throw error;
  }
});

adminUserRoutes.openapi(updateMembershipRoleRoute, async (c) => {
  const memberId = c.req.param('memberId');
  const body = updateMembershipRoleBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const targetMember = await getMemberById(memberId);
  if (!targetMember) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  if (
    targetMember.role === 'owner' &&
    body.data.role !== 'owner' &&
    (await isLastOwner(targetMember.organizationId))
  ) {
    return c.json({ error: 'Last owner cannot be removed' as const }, 409);
  }

  const updated = await db
    .update(members)
    .set({ role: body.data.role })
    .where(eq(members.id, memberId))
    .returning();

  return c.json({ data: updated[0] }, 200);
});

adminUserRoutes.openapi(deleteMembershipRoute, async (c) => {
  const memberId = c.req.param('memberId');
  const targetMember = await getMemberById(memberId);
  if (!targetMember) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  if (targetMember.role === 'owner' && (await isLastOwner(targetMember.organizationId))) {
    return c.json({ error: 'Last owner cannot be removed' as const }, 409);
  }

  await db.delete(members).where(eq(members.id, memberId));
  return c.body(null, 204);
});
