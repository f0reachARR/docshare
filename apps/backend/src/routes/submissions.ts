import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import {
  competitionEditions,
  participations,
  submissionHistories,
  submissionTemplates,
  submissions,
} from '../db/schema.js';
import type { AppVariables } from '../middleware/auth.js';
import {
  canDeleteSubmission,
  canViewOtherSubmissions,
  canViewParticipation,
  getUserUniversityIds,
  isAdmin,
} from '../services/permissions.js';
import { presignDownload } from '../services/storage.js';
import {
  isSubmissionMutableStatus,
  validateSubmissionPayload,
} from '../services/submission-validation.js';

const createSubmissionSchema = z.object({
  templateId: z.string().uuid(),
  participationId: z.string().uuid(),
  s3Key: z.string().optional(),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  url: z.string().url().optional(),
});

const updateSubmissionSchema = createSubmissionSchema.omit({
  templateId: true,
  participationId: true,
});

const submissionSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  participationId: z.string().uuid(),
  submittedBy: z.string(),
  version: z.number().int(),
  fileS3Key: z.string().nullable(),
  fileName: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  fileMimeType: z.string().nullable(),
  url: z.string().nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const createSubmissionRoute = createRoute({
  method: "post",
  path: "/submissions",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createSubmissionSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "提出作成",
      content: {
        "application/json": {
          schema: z.object({ data: submissionSchema }),
        },
      },
    },
    400: {
      description: "不正入力",
      content: {
        "application/json": {
          schema: z.object({ error: z.any() }),
        },
      },
    },
    409: {
      description: "状態または重複エラー",
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
    },
  },
});

const editionSubmissionRowSchema = z.object({
  submission: submissionSchema,
  participation: z.object({
    id: z.string().uuid(),
    editionId: z.string().uuid(),
    universityId: z.string(),
    teamName: z.string().nullable(),
    createdAt: z.any(),
  }),
});

const listEditionSubmissionsRoute = createRoute({
  method: "get",
  path: "/editions/{id}/submissions",
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "他大学提出一覧",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(editionSubmissionRowSchema) }),
        },
      },
    },
    403: {
      description: "権限なし",
      content: {
        "application/json": {
          schema: z.object({ error: z.literal("Forbidden") }),
        },
      },
    },
  },
});

export const submissionRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

const assertCanMutateParticipation = async (
  userId: string,
  participationId: string,
): Promise<void> => {
  if (await isAdmin(userId)) {
    return;
  }

  const universityIds = await getUserUniversityIds(userId);
  if (universityIds.length === 0) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  const rows = await db
    .select({ id: participations.id })
    .from(participations)
    .where(
      and(
        eq(participations.id, participationId),
        inArray(participations.universityId, universityIds),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
};

submissionRoutes.openapi(createSubmissionRoute, async (c) => {
  const user = c.get("currentUser");
  const body = createSubmissionSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  await assertCanMutateParticipation(user.id, body.data.participationId);

  const templateParticipationRows = await db
    .select({
      template: submissionTemplates,
      edition: competitionEditions,
      participationId: participations.id,
    })
    .from(submissionTemplates)
    .innerJoin(
      competitionEditions,
      eq(competitionEditions.id, submissionTemplates.editionId),
    )
    .innerJoin(
      participations,
      and(
        eq(participations.id, body.data.participationId),
        eq(participations.editionId, submissionTemplates.editionId),
      ),
    )
    .where(eq(submissionTemplates.id, body.data.templateId))
    .limit(1);

  if (!templateParticipationRows[0]) {
    return c.json({ error: "Template and participation mismatch" }, 400);
  }

  if (
    !isSubmissionMutableStatus(
      templateParticipationRows[0].edition.sharingStatus,
    )
  ) {
    return c.json(
      { error: "Submissions are not accepted in current sharing_status" },
      409,
    );
  }

  const validation = validateSubmissionPayload(
    templateParticipationRows[0].template,
    body.data,
  );
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const existing = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.templateId, body.data.templateId),
        eq(submissions.participationId, body.data.participationId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return c.json(
      { error: "Already exists for this template and participation" },
      409,
    );
  }

  const inserted = await db
    .insert(submissions)
    .values({
      templateId: body.data.templateId,
      participationId: body.data.participationId,
      submittedBy: user.id,
      fileS3Key: body.data.s3Key,
      fileName: body.data.fileName,
      fileSizeBytes: body.data.fileSizeBytes,
      fileMimeType: body.data.mimeType,
      url: body.data.url,
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

submissionRoutes.put("/submissions/:id", async (c) => {
  const user = c.get("currentUser");
  const submissionId = c.req.param("id");
  const body = updateSubmissionSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const existingRows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }

  await assertCanMutateParticipation(user.id, existing.participationId);

  const contextRows = await db
    .select({
      template: submissionTemplates,
      edition: competitionEditions,
    })
    .from(submissions)
    .innerJoin(
      submissionTemplates,
      eq(submissionTemplates.id, submissions.templateId),
    )
    .innerJoin(
      competitionEditions,
      eq(competitionEditions.id, submissionTemplates.editionId),
    )
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!contextRows[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  if (!isSubmissionMutableStatus(contextRows[0].edition.sharingStatus)) {
    return c.json(
      { error: "Submissions are not accepted in current sharing_status" },
      409,
    );
  }

  const validation = validateSubmissionPayload(
    contextRows[0].template,
    body.data,
  );
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const updated = await db.transaction(async (tx) => {
    await tx.insert(submissionHistories).values({
      submissionId: existing.id,
      version: existing.version,
      submittedBy: existing.submittedBy,
      fileS3Key: existing.fileS3Key,
      fileName: existing.fileName,
      fileSizeBytes: existing.fileSizeBytes,
      fileMimeType: existing.fileMimeType,
      url: existing.url,
    });

    const next = await tx
      .update(submissions)
      .set({
        submittedBy: user.id,
        version: existing.version + 1,
        fileS3Key: body.data.s3Key,
        fileName: body.data.fileName,
        fileSizeBytes: body.data.fileSizeBytes,
        fileMimeType: body.data.mimeType,
        url: body.data.url,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    return next[0];
  });

  return c.json({ data: updated });
});

submissionRoutes.delete("/submissions/:id", async (c) => {
  const user = c.get("currentUser");
  const submissionId = c.req.param("id");

  const allowed = await canDeleteSubmission(
    user.id,
    submissionId,
    c.get("organizationId"),
  );
  if (!allowed) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.delete(submissions).where(eq(submissions.id, submissionId));
  return c.body(null, 204);
});

submissionRoutes.openapi(listEditionSubmissionsRoute, async (c) => {
  const user = c.get("currentUser");
  const editionId = c.req.param("id");

  const canView = await canViewOtherSubmissions(user.id, editionId);
  if (!canView) {
    return c.json({ error: "Forbidden" as const }, 403);
  }

  const rows = await db
    .select({ submission: submissions, participation: participations })
    .from(submissions)
    .innerJoin(
      participations,
      eq(participations.id, submissions.participationId),
    )
    .innerJoin(
      submissionTemplates,
      eq(submissionTemplates.id, submissions.templateId),
    )
    .where(eq(submissionTemplates.editionId, editionId))
    .orderBy(asc(participations.createdAt));

  return c.json({ data: rows }, 200);
});

submissionRoutes.get("/submissions/:id/download", async (c) => {
  const user = c.get("currentUser");
  const submissionId = c.req.param("id");

  const row = await db
    .select({
      submission: submissions,
      editionId: competitionEditions.id,
      participationId: participations.id,
    })
    .from(submissions)
    .innerJoin(
      participations,
      eq(participations.id, submissions.participationId),
    )
    .innerJoin(
      submissionTemplates,
      eq(submissionTemplates.id, submissions.templateId),
    )
    .innerJoin(
      competitionEditions,
      eq(competitionEditions.id, submissionTemplates.editionId),
    )
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!row[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const canView = await canViewParticipation(
    user.id,
    row[0].participationId,
    c.get("organizationId"),
  );
  if (!canView) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!row[0].submission.fileS3Key) {
    return c.json({ error: "File submission not found" }, 400);
  }

  const download = await presignDownload(
    process.env.S3_BUCKET_SUBMISSIONS ?? "robocon-submissions",
    row[0].submission.fileS3Key,
  );
  return c.json({ data: download });
});

submissionRoutes.get("/submissions/:id/history", async (c) => {
  const user = c.get("currentUser");
  const submissionId = c.req.param("id");

  const row = await db
    .select({ participationId: submissions.participationId })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!row[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const canView = await canViewParticipation(
    user.id,
    row[0].participationId,
    c.get("organizationId"),
  );
  if (!canView) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const histories = await db
    .select()
    .from(submissionHistories)
    .where(eq(submissionHistories.submissionId, submissionId))
    .orderBy(desc(submissionHistories.version));

  return c.json({ data: histories });
});

submissionRoutes.get("/submission-history/:historyId/download", async (c) => {
  const user = c.get("currentUser");
  const historyId = c.req.param("historyId");

  const row = await db
    .select({
      history: submissionHistories,
      participationId: submissions.participationId,
    })
    .from(submissionHistories)
    .innerJoin(
      submissions,
      eq(submissions.id, submissionHistories.submissionId),
    )
    .where(eq(submissionHistories.id, historyId))
    .limit(1);

  if (!row[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const canView = await canViewParticipation(
    user.id,
    row[0].participationId,
    c.get("organizationId"),
  );
  if (!canView) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!row[0].history.fileS3Key) {
    return c.json({ error: "No file in this history entry" }, 400);
  }

  const download = await presignDownload(
    process.env.S3_BUCKET_SUBMISSIONS ?? "robocon-submissions",
    row[0].history.fileS3Key,
  );
  return c.json({ data: download });
});
