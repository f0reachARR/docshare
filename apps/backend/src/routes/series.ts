import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { competitionSeries } from '../db/schema.js';

const seriesSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  externalLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const notFoundSchema = z.object({ error: z.literal('Not found') });

const listSeriesRoute = createRoute({
  method: 'get',
  path: '/series',
  responses: {
    200: {
      description: 'シリーズ一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(seriesSchema) }),
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
  const rows = await db.select().from(competitionSeries);
  return c.json({ data: rows }, 200);
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
