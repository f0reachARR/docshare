import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { organizations, participations } from '../../db/schema.js';
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

const listEditionParticipationsRoute = createRoute({
  method: 'get',
  path: '/editions/{id}/participations',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: '大会の参加チーム一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(participationWithUniversitySchema) }),
        },
      },
    },
  },
});

export const adminParticipationRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

adminParticipationRoutes.openapi(listEditionParticipationsRoute, async (c) => {
  const editionId = c.req.param('id');

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
    .orderBy(asc(participations.createdAt), asc(participations.id));

  return c.json({ data: rows }, 200);
});

adminParticipationRoutes.post('/editions/:id/participations', async (c) => {
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

adminParticipationRoutes.put('/participations/:id', async (c) => {
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
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ data: updated[0] });
});

adminParticipationRoutes.delete('/participations/:id', async (c) => {
  await db.delete(participations).where(eq(participations.id, c.req.param('id')));
  return c.body(null, 204);
});
