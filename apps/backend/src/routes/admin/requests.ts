import { randomUUID } from 'node:crypto';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  competitionEditions,
  invitations,
  organizations,
  participationRequests,
  participations,
  universityCreationRequests,
  users,
} from '../../db/schema.js';
import type { AppVariables } from '../../middleware/auth.js';
import { emailService } from '../../services/email/index.js';

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

const reviewBodySchema = z.object({
  adminNote: z.string().optional(),
});

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

const listUniversityRequestsRoute = createRoute({
  method: 'get',
  path: '/university-requests',
  responses: {
    200: {
      description: '大学追加依頼一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(universityRequestSchema) }),
        },
      },
    },
  },
});

const approveUniversityRequestRoute = createRoute({
  method: 'post',
  path: '/university-requests/{id}/approve',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: '大学追加依頼承認',
      content: {
        'application/json': {
          schema: z.object({ data: universityRequestSchema }),
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
    409: {
      description: '処理済み',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Already reviewed') }),
        },
      },
    },
  },
});

const rejectUniversityRequestRoute = createRoute({
  method: 'post',
  path: '/university-requests/{id}/reject',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: reviewBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '大学追加依頼却下',
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
    404: {
      description: '未検出',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Not found') }),
        },
      },
    },
    409: {
      description: '処理済み',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Already reviewed') }),
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
      description: '出場追加依頼一覧',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(participationRequestSchema) }),
        },
      },
    },
  },
});

const approveParticipationRequestRoute = createRoute({
  method: 'post',
  path: '/participation-requests/{id}/approve',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: '出場追加依頼承認',
      content: {
        'application/json': {
          schema: z.object({ data: participationRequestSchema }),
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
    409: {
      description: '処理済みまたは重複',
      content: {
        'application/json': {
          schema: z.object({
            error: z.union([
              z.literal('Already reviewed'),
              z.literal('Participation already exists'),
            ]),
          }),
        },
      },
    },
  },
});

const rejectParticipationRequestRoute = createRoute({
  method: 'post',
  path: '/participation-requests/{id}/reject',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: reviewBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '出場追加依頼却下',
      content: {
        'application/json': {
          schema: z.object({ data: participationRequestSchema }),
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
    409: {
      description: '処理済み',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Already reviewed') }),
        },
      },
    },
  },
});

type ReviewerMap = Map<string, { id: string; name: string; email: string }>;

const slugifyUniversityName = (name: string): string => {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'university';
};

const buildReviewerMap = async (reviewerIds: Array<string | null>): Promise<ReviewerMap> => {
  const ids = reviewerIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, ids));

  return new Map(rows.map((row) => [row.id, row]));
};

const getUniqueUniversitySlug = async (name: string): Promise<string> => {
  const base = slugifyUniversityName(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);

    if (!existing[0]) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};

const listUniversityRequestDetails = async () => {
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
      reviewedByUserId: universityCreationRequests.reviewedByUserId,
      reviewedAt: universityCreationRequests.reviewedAt,
      createdOrganizationId: universityCreationRequests.createdOrganizationId,
      createdInvitationId: universityCreationRequests.createdInvitationId,
      adminNote: universityCreationRequests.adminNote,
      createdAt: universityCreationRequests.createdAt,
      updatedAt: universityCreationRequests.updatedAt,
    })
    .from(universityCreationRequests)
    .innerJoin(users, eq(users.id, universityCreationRequests.requestedByUserId))
    .orderBy(desc(universityCreationRequests.createdAt));

  const reviewerMap = await buildReviewerMap(rows.map((row) => row.reviewedByUserId));

  return rows.map((row) => ({
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
    reviewedBy: row.reviewedByUserId ? (reviewerMap.get(row.reviewedByUserId) ?? null) : null,
    reviewedAt: row.reviewedAt,
    createdOrganizationId: row.createdOrganizationId,
    createdInvitationId: row.createdInvitationId,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

const getUniversityRequestDetail = async (requestId: string) => {
  const rows = await listUniversityRequestDetails();
  return rows.find((row) => row.id === requestId) ?? null;
};

const listParticipationRequestDetails = async () => {
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
      reviewedByUserId: participationRequests.reviewedByUserId,
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
    .orderBy(desc(participationRequests.createdAt));

  const reviewerMap = await buildReviewerMap(rows.map((row) => row.reviewedByUserId));

  return rows.map((row) => ({
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
    reviewedBy: row.reviewedByUserId ? (reviewerMap.get(row.reviewedByUserId) ?? null) : null,
    reviewedAt: row.reviewedAt,
    createdParticipationId: row.createdParticipationId,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

const getParticipationRequestDetail = async (requestId: string) => {
  const rows = await listParticipationRequestDetails();
  return rows.find((row) => row.id === requestId) ?? null;
};

export const adminRequestRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

adminRequestRoutes.openapi(listUniversityRequestsRoute, async (c) => {
  return c.json({ data: await listUniversityRequestDetails() }, 200);
});

adminRequestRoutes.openapi(approveUniversityRequestRoute, async (c) => {
  const user = c.get('currentUser');
  const requestId = c.req.param('id');
  const existing = await db
    .select()
    .from(universityCreationRequests)
    .where(eq(universityCreationRequests.id, requestId))
    .limit(1);

  const request = existing[0];
  if (!request) {
    return c.json({ error: 'Not found' as const }, 404);
  }
  if (request.status !== 'pending') {
    return c.json({ error: 'Already reviewed' as const }, 409);
  }

  const organizationId = randomUUID();
  const slug = await getUniqueUniversitySlug(request.universityName);
  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await db.insert(organizations).values({
    id: organizationId,
    name: request.universityName,
    slug,
  });

  await db.insert(invitations).values({
    id: invitationId,
    organizationId,
    email: request.representativeEmail,
    role: 'owner',
    inviterId: user.id,
    expiresAt,
  });

  await emailService.sendEmail({
    to: request.representativeEmail,
    subject: `${request.universityName} の代表者招待`,
    html: `招待リンク: invitation:${invitationId}`,
  });

  await db
    .update(universityCreationRequests)
    .set({
      status: 'approved',
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      createdOrganizationId: organizationId,
      createdInvitationId: invitationId,
      updatedAt: new Date(),
    })
    .where(eq(universityCreationRequests.id, requestId));

  const detail = await getUniversityRequestDetail(requestId);
  if (!detail) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: detail }, 200);
});

adminRequestRoutes.openapi(rejectUniversityRequestRoute, async (c) => {
  const user = c.get('currentUser');
  const requestId = c.req.param('id');
  const body = reviewBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const existing = await db
    .select()
    .from(universityCreationRequests)
    .where(eq(universityCreationRequests.id, requestId))
    .limit(1);
  const request = existing[0];
  if (!request) {
    return c.json({ error: 'Not found' as const }, 404);
  }
  if (request.status !== 'pending') {
    return c.json({ error: 'Already reviewed' as const }, 409);
  }

  await db
    .update(universityCreationRequests)
    .set({
      status: 'rejected',
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      adminNote: body.data.adminNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(universityCreationRequests.id, requestId));

  const detail = await getUniversityRequestDetail(requestId);
  if (!detail) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: detail }, 200);
});

adminRequestRoutes.openapi(listParticipationRequestsRoute, async (c) => {
  return c.json({ data: await listParticipationRequestDetails() }, 200);
});

adminRequestRoutes.openapi(approveParticipationRequestRoute, async (c) => {
  const user = c.get('currentUser');
  const requestId = c.req.param('id');
  const existing = await db
    .select()
    .from(participationRequests)
    .where(eq(participationRequests.id, requestId))
    .limit(1);

  const request = existing[0];
  if (!request) {
    return c.json({ error: 'Not found' as const }, 404);
  }
  if (request.status !== 'pending') {
    return c.json({ error: 'Already reviewed' as const }, 409);
  }

  const duplicateRows = await db
    .select({ id: participations.id })
    .from(participations)
    .where(
      and(
        eq(participations.editionId, request.editionId),
        eq(participations.universityId, request.universityId),
        request.teamName
          ? eq(participations.teamName, request.teamName)
          : isNull(participations.teamName),
      ),
    )
    .limit(1);

  if (duplicateRows[0]) {
    return c.json({ error: 'Participation already exists' as const }, 409);
  }

  const inserted = await db
    .insert(participations)
    .values({
      editionId: request.editionId,
      universityId: request.universityId,
      teamName: request.teamName,
    })
    .returning();

  await db
    .update(participationRequests)
    .set({
      status: 'approved',
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      createdParticipationId: inserted[0]?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(participationRequests.id, requestId));

  const detail = await getParticipationRequestDetail(requestId);
  if (!detail) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: detail }, 200);
});

adminRequestRoutes.openapi(rejectParticipationRequestRoute, async (c) => {
  const user = c.get('currentUser');
  const requestId = c.req.param('id');
  const body = reviewBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const existing = await db
    .select()
    .from(participationRequests)
    .where(eq(participationRequests.id, requestId))
    .limit(1);
  const request = existing[0];
  if (!request) {
    return c.json({ error: 'Not found' as const }, 404);
  }
  if (request.status !== 'pending') {
    return c.json({ error: 'Already reviewed' as const }, 409);
  }

  await db
    .update(participationRequests)
    .set({
      status: 'rejected',
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      adminNote: body.data.adminNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(participationRequests.id, requestId));

  const detail = await getParticipationRequestDetail(requestId);
  if (!detail) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: detail }, 200);
});
