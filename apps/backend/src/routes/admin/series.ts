import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { competitionSeries } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/auth.js';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  externalLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
});

export const adminSeriesRoutes = new Hono<{ Variables: AppVariables }>();

adminSeriesRoutes.post('/series', async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(competitionSeries)
    .values({
      name: body.data.name,
      description: body.data.description,
      externalLinks: body.data.externalLinks,
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

adminSeriesRoutes.put('/series/:id', async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(competitionSeries)
    .set({
      name: body.data.name,
      description: body.data.description,
      externalLinks: body.data.externalLinks,
      updatedAt: new Date(),
    })
    .where(eq(competitionSeries.id, c.req.param('id')))
    .returning();

  if (!updated[0]) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ data: updated[0] });
});

adminSeriesRoutes.delete('/series/:id', async (c) => {
  await db.delete(competitionSeries).where(eq(competitionSeries.id, c.req.param('id')));
  return c.body(null, 204);
});
