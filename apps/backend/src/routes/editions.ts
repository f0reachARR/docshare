import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { competitionEditions } from '../db/schema.js';
import {
  editionResponseSchema,
  toEditionResponse,
  toEditionResponses,
} from '../lib/edition-response.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../lib/pagination.js';

const listEditionSortValues = [
  'year:asc',
  'year:desc',
  'name:asc',
  'name:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

const querySchema = createPagingQuerySchema(listEditionSortValues, true).extend({
  series_id: z.string().uuid().optional(),
});

const editionListRoute = createRoute({
  method: 'get',
  path: '/editions',
  request: {
    query: querySchema,
  },
  responses: {
    200: {
      description: '大会開催回一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(editionResponseSchema),
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

const editionDetailRoute = createRoute({
  method: 'get',
  path: '/editions/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: '大会開催回詳細',
      content: {
        'application/json': {
          schema: z.object({ data: editionResponseSchema }),
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

export const editionRoutes = new OpenAPIHono();

editionRoutes.openapi(editionListRoute, async (c) => {
  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: querySchema,
    sortValues: listEditionSortValues,
    defaultSort: 'year:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const parsedQuery = querySchema.parse(c.req.query());

  const whereClauses = [
    parsed.value.q
      ? or(
          ilike(competitionEditions.name, `%${parsed.value.q}%`),
          ilike(competitionEditions.description, `%${parsed.value.q}%`),
        )
      : undefined,
    parsedQuery.series_id ? eq(competitionEditions.seriesId, parsedQuery.series_id) : undefined,
  ].filter((clause): clause is Exclude<typeof clause, undefined> => clause !== undefined);

  const whereClause =
    whereClauses.length === 0
      ? undefined
      : whereClauses.length === 1
        ? whereClauses[0]
        : and(...whereClauses);

  const totalRows = whereClause
    ? await db.select({ total: count() }).from(competitionEditions).where(whereClause)
    : await db.select({ total: count() }).from(competitionEditions);

  const sortField = parsed.value.sort.field as 'year' | 'name' | 'createdAt';
  const sortDirection = parsed.value.sort.direction;
  const sortColumn =
    sortField === 'year'
      ? competitionEditions.year
      : sortField === 'name'
        ? competitionEditions.name
        : competitionEditions.createdAt;
  const mainOrder = sortDirection === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = whereClause
    ? await db
        .select()
        .from(competitionEditions)
        .where(whereClause)
        .orderBy(mainOrder, asc(competitionEditions.id))
        .limit(parsed.value.pageSize)
        .offset(parsed.value.offset)
    : await db
        .select()
        .from(competitionEditions)
        .orderBy(mainOrder, asc(competitionEditions.id))
        .limit(parsed.value.pageSize)
        .offset(parsed.value.offset);

  return c.json(
    {
      data: await toEditionResponses(rows),
      pagination: createPaginationMeta({
        page: parsed.value.page,
        pageSize: parsed.value.pageSize,
        total: totalRows[0]?.total ?? 0,
      }),
    },
    200,
  );
});

editionRoutes.openapi(editionDetailRoute, async (c) => {
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(competitionEditions)
    .where(eq(competitionEditions.id, id))
    .limit(1);
  if (!rows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }
  return c.json({ data: await toEditionResponse(rows[0]) }, 200);
});
