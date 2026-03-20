import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizations, participations, submissionTemplates, submissions } from '../db/schema.js';
import type { AppVariables } from '../middleware/auth.js';
import { canViewParticipation } from '../services/permissions.js';

const participationSchema = z.object({
  id: z.string().uuid(),
  editionId: z.string().uuid(),
  universityId: z.string(),
  universityName: z.string(),
  teamName: z.string().nullable(),
  createdAt: z.any(),
});

const participationSubmissionSchema = z.object({
  id: z.string().uuid(),
  template: z.object({
    id: z.string().uuid(),
    name: z.string(),
    acceptType: z.enum(['file', 'url']),
  }),
  version: z.number().int(),
  fileName: z.string().nullable(),
  url: z.string().nullable(),
  updatedAt: z.any(),
});

const getParticipationRoute = createRoute({
  method: 'get',
  path: '/participations/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'participation 詳細',
      content: {
        'application/json': {
          schema: z.object({ data: participationSchema }),
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

const listParticipationSubmissionsRoute = createRoute({
  method: 'get',
  path: '/participations/{id}/submissions',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'participation 提出一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(participationSubmissionSchema) }),
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

export const participationRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

participationRoutes.openapi(getParticipationRoute, async (c) => {
  const participationId = c.req.param('id');

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
    .where(eq(participations.id, participationId))
    .limit(1);

  if (!rows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const canView = await canViewParticipation(
    c.get('currentUser').id,
    participationId,
    c.get('organizationId'),
  );
  if (!canView) {
    return c.json({ error: 'Forbidden' as const }, 403);
  }

  return c.json({ data: rows[0] }, 200);
});

participationRoutes.openapi(listParticipationSubmissionsRoute, async (c) => {
  const participationId = c.req.param('id');

  const existing = await db
    .select({ id: participations.id })
    .from(participations)
    .where(eq(participations.id, participationId))
    .limit(1);

  if (!existing[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const canView = await canViewParticipation(
    c.get('currentUser').id,
    participationId,
    c.get('organizationId'),
  );
  if (!canView) {
    return c.json({ error: 'Forbidden' as const }, 403);
  }

  const rows = await db
    .select({
      id: submissions.id,
      templateId: submissionTemplates.id,
      templateName: submissionTemplates.name,
      templateAcceptType: submissionTemplates.acceptType,
      version: submissions.version,
      fileName: submissions.fileName,
      url: submissions.url,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .where(eq(submissions.participationId, participationId))
    .orderBy(asc(submissionTemplates.sortOrder), asc(submissionTemplates.id));

  return c.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        template: {
          id: row.templateId,
          name: row.templateName,
          acceptType: row.templateAcceptType,
        },
        version: row.version,
        fileName: row.fileName,
        url: row.url,
        updatedAt: row.updatedAt,
      })),
    },
    200,
  );
});
