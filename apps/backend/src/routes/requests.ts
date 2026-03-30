import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  competitionEditions,
  organizations,
  participationRequests,
  universityCreationRequests,
  users,
} from '../db/schema.js';
import type { AppVariables } from '../middleware/auth.js';
import { getUserUniversityIds } from '../services/permissions.js';

const requestStatusSchema = z.enum(['pending', 'approved', 'rejected']);

const requesterSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const reviewerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  })
  .nullable();

const universityRequestSchema = z.object({
  id: z.string().uuid(),
  universityName: z.string(),
  representativeEmail: z.string().email(),
  message: z.string(),
  status: requestStatusSchema,
  requestedBy: requesterSchema,
  reviewedBy: reviewerSchema,
  reviewedAt: z.date().nullable(),
  createdOrganizationId: z.string().nullable(),
  createdInvitationId: z.string().nullable(),
  adminNote: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const participationRequestSchema = z.object({
  id: z.string().uuid(),
  edition: z.object({
    id: z.string().uuid(),
    name: z.string(),
    year: z.number().int(),
  }),
  university: z.object({
    id: z.string(),
    name: z.string(),
  }),
  teamName: z.string().nullable(),
  message: z.string(),
  status: requestStatusSchema,
  requestedBy: requesterSchema,
  reviewedBy: reviewerSchema,
  reviewedAt: z.date().nullable(),
  createdParticipationId: z.string().uuid().nullable(),
  adminNote: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const createUniversityRequestSchema = z.object({
  universityName: z.string().min(1),
  representativeEmail: z.string().email(),
  message: z.string().min(1),
});

const createParticipationRequestSchema = z.object({
  teamName: z.string().optional(),
  message: z.string().min(1),
});

const orgHeaderSchema = z.object({
  'x-organization-id': z.string(),
});

const listUniversityRequestsRoute = createRoute({
  method: 'get',
  path: '/university-requests',
  responses: {
    200: {
      description: '自分の大学追加依頼一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(universityRequestSchema) }),
        },
      },
    },
  },
});

const createUniversityRequestRoute = createRoute({
  method: 'post',
  path: '/university-requests',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createUniversityRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '大学追加依頼作成',
      content: {
        'application/json': {
          schema: z.object({ data: universityRequestSchema }),
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

const listParticipationRequestsRoute = createRoute({
  method: 'get',
  path: '/participation-requests',
  responses: {
    200: {
      description: '自分の出場追加依頼一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(participationRequestSchema) }),
        },
      },
    },
  },
});

const createParticipationRequestRoute = createRoute({
  method: 'post',
  path: '/editions/{id}/participation-requests',
  request: {
    params: z.object({ id: z.string().uuid() }),
    headers: orgHeaderSchema,
    body: {
      content: {
        'application/json': {
          schema: createParticipationRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '出場追加依頼作成',
      content: {
        'application/json': {
          schema: z.object({ data: participationRequestSchema }),
        },
      },
    },
    400: {
      description: '不正入力または組織指定不足',
      content: {
        'application/json': {
          schema: z.object({
            error: z.union([z.any(), z.literal('x-organization-id is required')]),
          }),
        },
      },
    },
    403: {
      description: '組織コンテキスト不正',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Invalid organization context') }),
        },
      },
    },
    404: {
      description: '大会未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
  },
});

export const requestRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

requestRoutes.openapi(listUniversityRequestsRoute, async (c) => {
  const user = c.get('currentUser');
  const rows = await db
    .select({
      id: universityCreationRequests.id,
      universityName: universityCreationRequests.universityName,
      representativeEmail: universityCreationRequests.representativeEmail,
      message: universityCreationRequests.message,
      status: universityCreationRequests.status,
      requestedById: users.id,
      requestedByName: users.name,
      requestedByEmail: users.email,
      reviewedAt: universityCreationRequests.reviewedAt,
      createdOrganizationId: universityCreationRequests.createdOrganizationId,
      createdInvitationId: universityCreationRequests.createdInvitationId,
      adminNote: universityCreationRequests.adminNote,
      createdAt: universityCreationRequests.createdAt,
      updatedAt: universityCreationRequests.updatedAt,
    })
    .from(universityCreationRequests)
    .innerJoin(users, eq(users.id, universityCreationRequests.requestedByUserId))
    .where(eq(universityCreationRequests.requestedByUserId, user.id))
    .orderBy(desc(universityCreationRequests.createdAt));

  return c.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        universityName: row.universityName,
        representativeEmail: row.representativeEmail,
        message: row.message,
        status: row.status,
        requestedBy: {
          id: row.requestedById,
          name: row.requestedByName,
          email: row.requestedByEmail,
        },
        reviewedBy: null,
        reviewedAt: row.reviewedAt,
        createdOrganizationId: row.createdOrganizationId,
        createdInvitationId: row.createdInvitationId,
        adminNote: row.adminNote,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    },
    200,
  );
});

requestRoutes.openapi(createUniversityRequestRoute, async (c) => {
  const user = c.get('currentUser');
  const body = createUniversityRequestSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(universityCreationRequests)
    .values({
      requestedByUserId: user.id,
      universityName: body.data.universityName,
      representativeEmail: body.data.representativeEmail,
      message: body.data.message,
    })
    .returning();

  const request = inserted[0];
  return c.json(
    {
      data: {
        id: request.id,
        universityName: request.universityName,
        representativeEmail: request.representativeEmail,
        message: request.message,
        status: request.status,
        requestedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        reviewedBy: null,
        reviewedAt: request.reviewedAt,
        createdOrganizationId: request.createdOrganizationId,
        createdInvitationId: request.createdInvitationId,
        adminNote: request.adminNote,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    },
    201,
  );
});

requestRoutes.openapi(listParticipationRequestsRoute, async (c) => {
  const user = c.get('currentUser');
  const rows = await db
    .select({
      id: participationRequests.id,
      editionId: competitionEditions.id,
      editionName: competitionEditions.name,
      editionYear: competitionEditions.year,
      universityId: organizations.id,
      universityName: organizations.name,
      teamName: participationRequests.teamName,
      message: participationRequests.message,
      status: participationRequests.status,
      requestedById: users.id,
      requestedByName: users.name,
      requestedByEmail: users.email,
      reviewedAt: participationRequests.reviewedAt,
      createdParticipationId: participationRequests.createdParticipationId,
      adminNote: participationRequests.adminNote,
      createdAt: participationRequests.createdAt,
      updatedAt: participationRequests.updatedAt,
    })
    .from(participationRequests)
    .innerJoin(users, eq(users.id, participationRequests.requestedByUserId))
    .innerJoin(competitionEditions, eq(competitionEditions.id, participationRequests.editionId))
    .innerJoin(organizations, eq(organizations.id, participationRequests.universityId))
    .where(eq(participationRequests.requestedByUserId, user.id))
    .orderBy(desc(participationRequests.createdAt));

  return c.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        edition: {
          id: row.editionId,
          name: row.editionName,
          year: row.editionYear,
        },
        university: {
          id: row.universityId,
          name: row.universityName,
        },
        teamName: row.teamName,
        message: row.message,
        status: row.status,
        requestedBy: {
          id: row.requestedById,
          name: row.requestedByName,
          email: row.requestedByEmail,
        },
        reviewedBy: null,
        reviewedAt: row.reviewedAt,
        createdParticipationId: row.createdParticipationId,
        adminNote: row.adminNote,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    },
    200,
  );
});

requestRoutes.openapi(createParticipationRequestRoute, async (c) => {
  const user = c.get('currentUser');
  const editionId = c.req.param('id');
  const organizationId = c.get('organizationId');
  if (!organizationId) {
    return c.json({ error: 'x-organization-id is required' as const }, 400);
  }

  const body = createParticipationRequestSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const universityIds = await getUserUniversityIds(user.id);
  if (!universityIds.includes(organizationId)) {
    return c.json({ error: 'Invalid organization context' as const }, 403);
  }

  const editionRows = await db
    .select({
      id: competitionEditions.id,
      name: competitionEditions.name,
      year: competitionEditions.year,
    })
    .from(competitionEditions)
    .where(eq(competitionEditions.id, editionId))
    .limit(1);
  const edition = editionRows[0];
  if (!edition) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const orgRows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const inserted = await db
    .insert(participationRequests)
    .values({
      editionId,
      universityId: organizationId,
      requestedByUserId: user.id,
      teamName: body.data.teamName,
      message: body.data.message,
    })
    .returning();

  const request = inserted[0];
  return c.json(
    {
      data: {
        id: request.id,
        edition: {
          id: edition.id,
          name: edition.name,
          year: edition.year,
        },
        university: {
          id: orgRows[0]?.id ?? organizationId,
          name: orgRows[0]?.name ?? organizationId,
        },
        teamName: request.teamName,
        message: request.message,
        status: request.status,
        requestedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        reviewedBy: null,
        reviewedAt: request.reviewedAt,
        createdParticipationId: request.createdParticipationId,
        adminNote: request.adminNote,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    },
    201,
  );
});
