import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, members, organizations, participations, users } from '../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../lib/pagination.js';
import type { AppVariables } from '../middleware/auth.js';
import {
  canComment,
  canDeleteComment,
  canEditComment,
  canViewParticipation,
} from '../services/permissions.js';

const bodySchema = z.object({
  body: z.string().min(1).max(5000),
});

const commentWithAuthorSchema = z.object({
  id: z.string().uuid(),
  participationId: z.string().uuid(),
  editionId: z.string().uuid(),
  body: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
  author: z.object({
    id: z.string(),
    name: z.string(),
    universityName: z.string().nullable(),
  }),
});

const listCommentSortValues = [
  'createdAt:asc',
  'createdAt:desc',
  'updatedAt:asc',
  'updatedAt:desc',
] as const;

const listCommentQuerySchema = createPagingQuerySchema(listCommentSortValues, true);

const listCommentsRoute = createRoute({
  method: 'get',
  path: '/participations/{id}/comments',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: listCommentQuerySchema,
  },
  responses: {
    200: {
      description: 'コメント一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(commentWithAuthorSchema),
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
    403: {
      description: '権限なし',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Forbidden') }),
        },
      },
    },
  },
});

export const commentRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

commentRoutes.openapi(listCommentsRoute, async (c) => {
  const user = c.get('currentUser');
  const participationId = c.req.param('id');

  const canView = await canViewParticipation(user.id, participationId, c.get('organizationId'));
  if (!canView) {
    return c.json({ error: 'Forbidden' as const }, 403);
  }

  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: listCommentQuerySchema,
    sortValues: listCommentSortValues,
    defaultSort: 'createdAt:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const whereClause = and(
    eq(comments.participationId, participationId),
    isNull(comments.deletedAt),
    parsed.value.q ? ilike(comments.body, `%${parsed.value.q}%`) : undefined,
  );

  const totalRows = await db.select({ total: count() }).from(comments).where(whereClause);

  const sortColumn =
    parsed.value.sort.field === 'updatedAt' ? comments.updatedAt : comments.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      id: comments.id,
      participationId: comments.participationId,
      editionId: comments.editionId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(whereClause)
    .orderBy(mainOrder, asc(comments.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  const authorIds = Array.from(new Set(rows.map((row) => row.authorId)));

  const affiliations =
    authorIds.length > 0
      ? await db
          .select({
            userId: members.userId,
            universityName: organizations.name,
            joinedAt: members.createdAt,
          })
          .from(members)
          .innerJoin(organizations, eq(organizations.id, members.organizationId))
          .where(inArray(members.userId, authorIds))
          .orderBy(asc(members.createdAt))
      : [];

  const universityByAuthor = new Map<string, string>();
  for (const affiliation of affiliations) {
    if (!universityByAuthor.has(affiliation.userId)) {
      universityByAuthor.set(affiliation.userId, affiliation.universityName);
    }
  }

  return c.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        participationId: row.participationId,
        editionId: row.editionId,
        body: row.body,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        author: {
          id: row.authorId,
          name: row.authorName,
          universityName: universityByAuthor.get(row.authorId) ?? null,
        },
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

commentRoutes.post('/participations/:id/comments', async (c) => {
  const user = c.get('currentUser');
  const participationId = c.req.param('id');
  const body = bodySchema.safeParse(await c.req.json());

  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const participationRows = await db
    .select({ editionId: participations.editionId })
    .from(participations)
    .where(eq(participations.id, participationId))
    .limit(1);

  if (!participationRows[0]) {
    return c.json({ error: 'Participation not found' }, 404);
  }

  const can = await canComment(
    user.id,
    participationRows[0].editionId,
    participationId,
    c.get('organizationId'),
  );

  if (!can) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const inserted = await db
    .insert(comments)
    .values({
      participationId,
      editionId: participationRows[0].editionId,
      authorId: user.id,
      body: body.data.body,
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

commentRoutes.put('/comments/:id', async (c) => {
  const user = c.get('currentUser');
  const commentId = c.req.param('id');
  const body = bodySchema.safeParse(await c.req.json());

  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const can = await canEditComment(user.id, commentId);
  if (!can) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updated = await db
    .update(comments)
    .set({ body: body.data.body, updatedAt: new Date() })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
    .returning();

  if (!updated[0]) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ data: updated[0] });
});

commentRoutes.delete('/comments/:id', async (c) => {
  const user = c.get('currentUser');
  const commentId = c.req.param('id');

  const can = await canDeleteComment(user.id, commentId);
  if (!can) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await db
    .update(comments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(comments.id, commentId));

  return c.body(null, 204);
});
