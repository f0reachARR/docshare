import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { asc, count, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { organizations, participations } from '../../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../../lib/pagination.js';
import type { AppVariables } from '../../middleware/auth.js';

const createSchema = z.object({
  universityId: z.string().min(1),
  teamName: z.string().optional(),
});

const updateSchema = z.object({
  teamName: z.string().nullable().optional(),
});

const participationWithUniversitySchema = z.object({
  id: z.string().uuid(),
  editionId: z.string().uuid(),
  universityId: z.string(),
  universityName: z.string(),
  teamName: z.string().nullable(),
  createdAt: z.any(),
});

const participationSchema = z.object({
  id: z.string().uuid(),
  editionId: z.string().uuid(),
  universityId: z.string(),
  teamName: z.string().nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const listEditionParticipationSortValues = [
  'createdAt:asc',
  'createdAt:desc',
  'universityName:asc',
  'universityName:desc',
  'teamName:asc',
  'teamName:desc',
] as const;

const listEditionParticipationQuerySchema = createPagingQuerySchema(
  listEditionParticipationSortValues,
  false,
);

const listEditionParticipationsRoute = createRoute({
  method: 'get',
  path: '/editions/{id}/participations',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: listEditionParticipationQuerySchema,
  },
  responses: {
    200: {
      description: '大会の参加チーム一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(participationWithUniversitySchema),
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

const createParticipationRoute = createRoute({
  method: 'post',
  path: '/editions/{id}/participations',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: createSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '参加チーム作成',
      content: {
        'application/json': {
          schema: z.object({ data: participationSchema }),
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
  },
});

const updateParticipationRoute = createRoute({
  method: 'put',
  path: '/participations/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: updateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '参加チーム更新',
      content: {
        'application/json': {
          schema: z.object({ data: participationSchema }),
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
      description: '未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
  },
});

const deleteParticipationRoute = createRoute({
  method: 'delete',
  path: '/participations/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: {
      description: '参加チーム削除',
    },
  },
});

export const adminParticipationRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

adminParticipationRoutes.openapi(listEditionParticipationsRoute, async (c) => {
  const editionId = c.req.param('id');
  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: listEditionParticipationQuerySchema,
    sortValues: listEditionParticipationSortValues,
    defaultSort: 'createdAt:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const totalRows = await db
    .select({ total: count() })
    .from(participations)
    .innerJoin(organizations, eq(organizations.id, participations.universityId))
    .where(eq(participations.editionId, editionId));

  const sortColumn =
    parsed.value.sort.field === 'universityName'
      ? organizations.name
      : parsed.value.sort.field === 'teamName'
        ? participations.teamName
        : participations.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      id: participations.id,
      editionId: participations.editionId,
      universityId: participations.universityId,
      universityName: organizations.name,
      teamName: participations.teamName,
      createdAt: participations.createdAt,
    })
    .from(participations)
    .innerJoin(organizations, eq(organizations.id, participations.universityId))
    .where(eq(participations.editionId, editionId))
    .orderBy(mainOrder, asc(participations.id))
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

adminParticipationRoutes.openapi(createParticipationRoute, async (c) => {
  const editionId = c.req.param('id');
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(participations)
    .values({
      editionId,
      universityId: body.data.universityId,
      teamName: body.data.teamName,
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

adminParticipationRoutes.openapi(updateParticipationRoute, async (c) => {
  const body = updateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(participations)
    .set({ teamName: body.data.teamName ?? null })
    .where(eq(participations.id, c.req.param('id')))
    .returning();

  if (!updated[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: updated[0] }, 200);
});

adminParticipationRoutes.openapi(deleteParticipationRoute, async (c) => {
  await db.delete(participations).where(eq(participations.id, c.req.param('id')));
  return c.body(null, 204);
});
