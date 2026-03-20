import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { competitionSeries } from '../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../lib/pagination.js';

const seriesSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  externalLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const notFoundSchema = z.object({ error: z.literal('Not found') });

const listSeriesSortValues = ['name:asc', 'name:desc', 'createdAt:asc', 'createdAt:desc'] as const;

const listSeriesQuerySchema = createPagingQuerySchema(listSeriesSortValues, true);

const listSeriesRoute = createRoute({
  method: 'get',
  path: '/series',
  request: {
    query: listSeriesQuerySchema,
  },
  responses: {
    200: {
      description: 'シリーズ一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(seriesSchema),
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

const getSeriesRoute = createRoute({
  method: 'get',
  path: '/series/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'シリーズ詳細',
      content: {
        'application/json': {
          schema: z.object({ data: seriesSchema }),
        },
      },
    },
    404: {
      description: '未検出',
      content: {
        'application/json': {
          schema: notFoundSchema,
        },
      },
    },
  },
});

export const seriesRoutes = new OpenAPIHono();

seriesRoutes.openapi(listSeriesRoute, async (c) => {
  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: listSeriesQuerySchema,
    sortValues: listSeriesSortValues,
    defaultSort: 'createdAt:desc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const whereClause = parsed.value.q
    ? or(
        ilike(competitionSeries.name, `%${parsed.value.q}%`),
        ilike(competitionSeries.description, `%${parsed.value.q}%`),
      )
    : undefined;

  const totalRows = whereClause
    ? await db.select({ total: count() }).from(competitionSeries).where(whereClause)
    : await db.select({ total: count() }).from(competitionSeries);

  const sortColumn =
    parsed.value.sort.field === 'name' ? competitionSeries.name : competitionSeries.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = whereClause
    ? await db
        .select()
        .from(competitionSeries)
        .where(whereClause)
        .orderBy(mainOrder, asc(competitionSeries.id))
        .limit(parsed.value.pageSize)
        .offset(parsed.value.offset)
    : await db
        .select()
        .from(competitionSeries)
        .orderBy(mainOrder, asc(competitionSeries.id))
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

seriesRoutes.openapi(getSeriesRoute, async (c) => {
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(competitionSeries)
    .where(eq(competitionSeries.id, id))
    .limit(1);
  if (!rows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }
  return c.json({ data: rows[0] }, 200);
});
