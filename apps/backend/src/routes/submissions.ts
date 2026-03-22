import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import {
  competitionEditions,
  organizations,
  participations,
  submissionHistories,
  submissionTemplates,
  submissions,
  users,
} from '../db/schema.js';
import { env } from '../lib/config.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../lib/pagination.js';
import type { AppVariables } from '../middleware/auth.js';
import {
  canDeleteSubmission,
  canViewOtherSubmissionsByTemplate,
  canViewParticipationWithReason,
  getUserUniversityIds,
  isAdmin,
  publicForbiddenReasonCodes,
  toPublicForbiddenReason,
} from '../services/permissions.js';
import { getObjectMetadata, presignDownload } from '../services/storage.js';
import { validateUploadedFileReference } from '../services/submission-files.js';
import {
  isContentTypeConsistent,
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
  fileName: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  fileMimeType: z.string().nullable(),
  url: z.string().nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const createSubmissionRoute = createRoute({
  method: 'post',
  path: '/submissions',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createSubmissionSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '提出作成',
      content: {
        'application/json': {
          schema: z.object({ data: submissionSchema }),
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
    409: {
      description: '状態または重複エラー',
      content: {
        'application/json': {
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
    universityName: z.string(),
    teamName: z.string().nullable(),
    createdAt: z.any(),
  }),
});

const submissionMatrixTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  acceptType: z.enum(['file', 'url']),
  sortOrder: z.number().int(),
});

const submissionMatrixRowSchema = z.object({
  participation: z.object({
    id: z.string().uuid(),
    editionId: z.string().uuid(),
    universityId: z.string(),
    universityName: z.string(),
    teamName: z.string().nullable(),
    createdAt: z.any(),
  }),
  cells: z.array(
    z.object({
      submitted: z.boolean(),
      viewable: z.boolean(),
      denyReason: z.enum(publicForbiddenReasonCodes).nullable(),
      submission: submissionSchema.nullable(),
    }),
  ),
});

const forbiddenResponseSchema = z.object({
  error: z.literal('Forbidden'),
  reason: z.enum(publicForbiddenReasonCodes),
});

const historySchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  version: z.number().int(),
  submittedBy: z.string(),
  submittedByUser: z.object({
    id: z.string(),
    name: z.string(),
  }),
  fileName: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  fileMimeType: z.string().nullable(),
  url: z.string().nullable(),
  createdAt: z.any(),
});

const listEditionSubmissionSortValues = [
  'createdAt:asc',
  'createdAt:desc',
  'updatedAt:asc',
  'updatedAt:desc',
  'teamName:asc',
  'teamName:desc',
] as const;

const listEditionSubmissionMatrixSortValues = [
  'createdAt:asc',
  'createdAt:desc',
  'teamName:asc',
  'teamName:desc',
  'universityName:asc',
  'universityName:desc',
] as const;

const listHistorySortValues = [
  'version:asc',
  'version:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

const listEditionSubmissionsRoute = createRoute({
  method: 'get',
  path: '/editions/{id}/submissions',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: createPagingQuerySchema(listEditionSubmissionSortValues, true).extend({
      templateId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: '他大学提出一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(editionSubmissionRowSchema),
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
          schema: forbiddenResponseSchema,
        },
      },
    },
  },
});

const listSubmissionHistoriesRoute = createRoute({
  method: 'get',
  path: '/submissions/{id}/history',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: createPagingQuerySchema(listHistorySortValues, true),
  },
  responses: {
    200: {
      description: '提出履歴一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(historySchema),
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
          schema: forbiddenResponseSchema,
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

const listEditionSubmissionMatrixRoute = createRoute({
  method: 'get',
  path: '/editions/{id}/submission-matrix',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: createPagingQuerySchema(listEditionSubmissionMatrixSortValues, true),
  },
  responses: {
    200: {
      description: '他大学提出マトリクス',
      content: {
        'application/json': {
          schema: z.object({
            templates: z.array(submissionMatrixTemplateSchema),
            rows: z.array(submissionMatrixRowSchema),
            pagination: z.object({
              page: z.number().int(),
              pageSize: z.number().int(),
              total: z.number().int(),
              totalPages: z.number().int(),
              hasNext: z.boolean(),
              hasPrev: z.boolean(),
            }),
          }),
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
          schema: forbiddenResponseSchema,
        },
      },
    },
  },
});

const updateSubmissionRoute = createRoute({
  method: 'put',
  path: '/submissions/{id}',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: updateSubmissionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '提出更新',
      content: {
        'application/json': {
          schema: z.object({ data: submissionSchema }),
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
      description: '提出不可状態',
      content: {
        'application/json': {
          schema: z.object({
            error: z.literal('Submissions are not accepted in current sharing_status'),
          }),
        },
      },
    },
  },
});

const deleteSubmissionRoute = createRoute({
  method: 'delete',
  path: '/submissions/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: {
      description: '提出削除',
    },
    403: {
      description: '権限なし',
      content: {
        'application/json': {
          schema: forbiddenResponseSchema,
        },
      },
    },
  },
});

const downloadSchema = z.object({
  presignedUrl: z.string().url(),
  expiresIn: z.number().int(),
});

const downloadSubmissionRoute = createRoute({
  method: 'get',
  path: '/submissions/{id}/download',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: '提出ファイルダウンロードURL発行',
      content: {
        'application/json': {
          schema: z.object({ data: downloadSchema }),
        },
      },
    },
    400: {
      description: 'ファイル提出なし',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('File submission not found') }),
        },
      },
    },
    403: {
      description: '権限なし',
      content: {
        'application/json': {
          schema: forbiddenResponseSchema,
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

const downloadSubmissionHistoryRoute = createRoute({
  method: 'get',
  path: '/submission-history/{historyId}/download',
  request: {
    params: z.object({ historyId: z.string() }),
  },
  responses: {
    200: {
      description: '提出履歴ファイルダウンロードURL発行',
      content: {
        'application/json': {
          schema: z.object({ data: downloadSchema }),
        },
      },
    },
    400: {
      description: 'ファイル提出なし',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('No file in this history entry') }),
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

export const submissionRoutes = new OpenAPIHono<{ Variables: AppVariables }>();

const toPublicSubmission = (submission: typeof submissions.$inferSelect) => {
  const { fileS3Key: _fileS3Key, ...publicSubmission } = submission;
  return publicSubmission;
};

const normalizeSubmissionHistory = (
  history: Omit<typeof submissionHistories.$inferSelect, 'fileS3Key'> & {
    submittedByUser: {
      id: string;
      name: string;
    };
  },
) => {
  return history;
};

const validateUploadedFileOrReject = async (params: {
  template: typeof submissionTemplates.$inferSelect;
  editionId: string;
  participationId: string;
  templateId: string;
  version: number;
  payload: {
    s3Key?: string;
    fileName?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    url?: string;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (params.template.acceptType !== 'file') {
    return { ok: true };
  }

  const { s3Key, fileName, fileSizeBytes, mimeType } = params.payload;
  if (!s3Key || !fileName || !fileSizeBytes || !mimeType) {
    return { ok: false, error: 'Missing file fields for file template' };
  }

  if (!isContentTypeConsistent(fileName, mimeType)) {
    return { ok: false, error: 'mimeType is inconsistent with file extension' };
  }

  let metadata: { contentLength: number | null; contentType: string | null };
  try {
    metadata = await getObjectMetadata(env.S3_BUCKET_SUBMISSIONS, s3Key);
  } catch {
    return { ok: false, error: 'Uploaded file not found' };
  }

  return validateUploadedFileReference({
    template: params.template,
    metadata,
    editionId: params.editionId,
    participationId: params.participationId,
    templateId: params.templateId,
    version: params.version,
    s3Key,
    fileName,
    fileSizeBytes,
    mimeType,
  });
};

const assertCanMutateParticipation = async (
  userId: string,
  participationId: string,
): Promise<void> => {
  if (await isAdmin(userId)) {
    return;
  }

  const universityIds = await getUserUniversityIds(userId);
  if (universityIds.length === 0) {
    throw new HTTPException(403, { message: 'Forbidden' });
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
    throw new HTTPException(403, { message: 'Forbidden' });
  }
};

submissionRoutes.openapi(createSubmissionRoute, async (c) => {
  const user = c.get('currentUser');
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
    .innerJoin(competitionEditions, eq(competitionEditions.id, submissionTemplates.editionId))
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
    return c.json({ error: 'Template and participation mismatch' }, 400);
  }

  if (!isSubmissionMutableStatus(templateParticipationRows[0].edition.sharingStatus)) {
    return c.json({ error: 'Submissions are not accepted in current sharing_status' }, 409);
  }

  const validation = validateSubmissionPayload(templateParticipationRows[0].template, body.data);
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
    return c.json({ error: 'Already exists for this template and participation' }, 409);
  }

  const uploadedFileValidation = await validateUploadedFileOrReject({
    template: templateParticipationRows[0].template,
    editionId: templateParticipationRows[0].edition.id,
    participationId: body.data.participationId,
    templateId: body.data.templateId,
    version: 1,
    payload: body.data,
  });
  if (!uploadedFileValidation.ok) {
    return c.json({ error: uploadedFileValidation.error }, 400);
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

  return c.json({ data: toPublicSubmission(inserted[0]) }, 201);
});

submissionRoutes.openapi(updateSubmissionRoute, async (c) => {
  const user = c.get('currentUser');
  const submissionId = c.req.param('id');
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
    return c.json({ error: 'Not found' as const }, 404);
  }

  await assertCanMutateParticipation(user.id, existing.participationId);

  const contextRows = await db
    .select({
      template: submissionTemplates,
      edition: competitionEditions,
    })
    .from(submissions)
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .innerJoin(competitionEditions, eq(competitionEditions.id, submissionTemplates.editionId))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!contextRows[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  if (!isSubmissionMutableStatus(contextRows[0].edition.sharingStatus)) {
    return c.json(
      { error: 'Submissions are not accepted in current sharing_status' as const },
      409,
    );
  }

  const validation = validateSubmissionPayload(contextRows[0].template, body.data);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const uploadedFileValidation = await validateUploadedFileOrReject({
    template: contextRows[0].template,
    editionId: contextRows[0].edition.id,
    participationId: existing.participationId,
    templateId: existing.templateId,
    version: existing.version + 1,
    payload: body.data,
  });
  if (!uploadedFileValidation.ok) {
    return c.json({ error: uploadedFileValidation.error }, 400);
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

  return c.json({ data: toPublicSubmission(updated) }, 200);
});

submissionRoutes.openapi(deleteSubmissionRoute, async (c) => {
  const user = c.get('currentUser');
  const submissionId = c.req.param('id');

  const allowed = await canDeleteSubmission(user.id, submissionId, c.get('organizationId'));
  if (!allowed) {
    return c.json({ error: 'Forbidden' as const }, 403);
  }

  await db.delete(submissions).where(eq(submissions.id, submissionId));
  return c.body(null, 204);
});

submissionRoutes.openapi(listEditionSubmissionsRoute, async (c) => {
  const user = c.get('currentUser');
  const editionId = c.req.param('id');

  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: createPagingQuerySchema(listEditionSubmissionSortValues, true).extend({
      templateId: z.string().uuid(),
    }),
    sortValues: listEditionSubmissionSortValues,
    defaultSort: 'createdAt:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const templateId = c.req.query('templateId') as string;

  const decision = await canViewOtherSubmissionsByTemplate(
    user.id,
    editionId,
    templateId,
    c.get('organizationId'),
  );
  if (!decision.allowed) {
    return c.json(
      { error: 'Forbidden' as const, reason: toPublicForbiddenReason(decision.reason) },
      403,
    );
  }

  const whereClause = and(
    eq(submissionTemplates.editionId, editionId),
    templateId ? eq(submissionTemplates.id, templateId) : undefined,
    parsed.value.q
      ? or(
          ilike(submissions.fileName, `%${parsed.value.q}%`),
          ilike(submissions.url, `%${parsed.value.q}%`),
          ilike(participations.teamName, `%${parsed.value.q}%`),
        )
      : undefined,
  );

  const totalRows = await db
    .select({ total: count() })
    .from(submissions)
    .innerJoin(participations, eq(participations.id, submissions.participationId))
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .where(whereClause);

  const sortColumn =
    parsed.value.sort.field === 'updatedAt'
      ? submissions.updatedAt
      : parsed.value.sort.field === 'teamName'
        ? participations.teamName
        : submissions.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      submission: submissions,
      participation: {
        id: participations.id,
        editionId: participations.editionId,
        universityId: participations.universityId,
        universityName: organizations.name,
        teamName: participations.teamName,
        createdAt: participations.createdAt,
      },
    })
    .from(submissions)
    .innerJoin(participations, eq(participations.id, submissions.participationId))
    .innerJoin(organizations, eq(organizations.id, participations.universityId))
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .where(whereClause)
    .orderBy(mainOrder, asc(submissions.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  return c.json(
    {
      data: rows.map((row) => ({
        ...row,
        submission: toPublicSubmission(row.submission),
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

submissionRoutes.openapi(listEditionSubmissionMatrixRoute, async (c) => {
  const user = c.get('currentUser');
  const editionId = c.req.param('id');

  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: createPagingQuerySchema(listEditionSubmissionMatrixSortValues, true),
    sortValues: listEditionSubmissionMatrixSortValues,
    defaultSort: 'createdAt:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const participationWhereClause = and(
    eq(participations.editionId, editionId),
    parsed.value.q
      ? or(
          ilike(participations.teamName, `%${parsed.value.q}%`),
          ilike(organizations.name, `%${parsed.value.q}%`),
        )
      : undefined,
  );

  const totalRows = await db
    .select({ total: count() })
    .from(participations)
    .innerJoin(organizations, eq(organizations.id, participations.universityId))
    .where(participationWhereClause);

  const sortColumn =
    parsed.value.sort.field === 'teamName'
      ? participations.teamName
      : parsed.value.sort.field === 'universityName'
        ? organizations.name
        : participations.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const participationRows = await db
    .select({
      participation: {
        id: participations.id,
        editionId: participations.editionId,
        universityId: participations.universityId,
        universityName: organizations.name,
        teamName: participations.teamName,
        createdAt: participations.createdAt,
      },
    })
    .from(participations)
    .innerJoin(organizations, eq(organizations.id, participations.universityId))
    .where(participationWhereClause)
    .orderBy(mainOrder, asc(participations.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  const templates = await db
    .select({
      template: {
        id: submissionTemplates.id,
        name: submissionTemplates.name,
        acceptType: submissionTemplates.acceptType,
        sortOrder: submissionTemplates.sortOrder,
      },
    })
    .from(submissionTemplates)
    .where(eq(submissionTemplates.editionId, editionId))
    .orderBy(asc(submissionTemplates.sortOrder), asc(submissionTemplates.id));

  const participationIds = participationRows.map((row) => row.participation.id);
  const templateIds = templates.map((row) => row.template.id);

  const submissionRows =
    participationIds.length === 0 || templateIds.length === 0
      ? []
      : ((await db
          .select({
            id: submissions.id,
            templateId: submissions.templateId,
            participationId: submissions.participationId,
            submittedBy: submissions.submittedBy,
            version: submissions.version,
            fileS3Key: submissions.fileS3Key,
            fileName: submissions.fileName,
            fileSizeBytes: submissions.fileSizeBytes,
            fileMimeType: submissions.fileMimeType,
            url: submissions.url,
            createdAt: submissions.createdAt,
            updatedAt: submissions.updatedAt,
          })
          .from(submissions)
          .where(
            and(
              inArray(submissions.participationId, participationIds),
              inArray(submissions.templateId, templateIds),
            ),
          )) ?? []);

  const submissionMap = new Map<string, (typeof submissionRows)[number]>();
  for (const row of submissionRows) {
    submissionMap.set(`${row.participationId}:${row.templateId}`, row);
  }

  const currentOrganizationId = c.get('organizationId');
  const userUniversityIds = user.isAdmin ? [] : await getUserUniversityIds(user.id);
  const templatePermissionMap = new Map<
    string,
    Awaited<ReturnType<typeof canViewOtherSubmissionsByTemplate>>
  >();

  for (const template of templates) {
    templatePermissionMap.set(
      template.template.id,
      await canViewOtherSubmissionsByTemplate(
        user.id,
        editionId,
        template.template.id,
        currentOrganizationId,
      ),
    );
  }

  return c.json(
    {
      templates: templates.map((row) => row.template),
      rows: participationRows.map((row) => ({
        participation: row.participation,
        cells: templates.map((template) => {
          const key = `${row.participation.id}:${template.template.id}`;
          const submission = submissionMap.get(key) ?? null;
          const isOwnParticipation = userUniversityIds.includes(row.participation.universityId);
          const templateDecision = templatePermissionMap.get(template.template.id) ?? {
            allowed: false as const,
            reason: 'template_not_submitted' as const,
          };
          const canViewSubmission = user.isAdmin || isOwnParticipation || templateDecision.allowed;

          return {
            submitted: submission !== null,
            viewable: canViewSubmission,
            denyReason:
              submission && !canViewSubmission && !templateDecision.allowed
                ? toPublicForbiddenReason(templateDecision.reason)
                : null,
            submission: submission && canViewSubmission ? toPublicSubmission(submission) : null,
          };
        }),
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

submissionRoutes.openapi(downloadSubmissionRoute, async (c) => {
  const user = c.get('currentUser');
  const submissionId = c.req.param('id');

  const row = await db
    .select({
      submission: submissions,
      editionId: competitionEditions.id,
      participationId: participations.id,
    })
    .from(submissions)
    .innerJoin(participations, eq(participations.id, submissions.participationId))
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .innerJoin(competitionEditions, eq(competitionEditions.id, submissionTemplates.editionId))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!row[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const canView = await canViewParticipationWithReason(
    user.id,
    row[0].participationId,
    c.get('organizationId'),
    row[0].submission.templateId,
  );
  if (!canView.allowed) {
    return c.json(
      { error: 'Forbidden' as const, reason: toPublicForbiddenReason(canView.reason) },
      403,
    );
  }

  if (!row[0].submission.fileS3Key) {
    return c.json({ error: 'File submission not found' as const }, 400);
  }

  const download = await presignDownload(env.S3_BUCKET_SUBMISSIONS, row[0].submission.fileS3Key);
  return c.json({ data: download }, 200);
});

submissionRoutes.openapi(listSubmissionHistoriesRoute, async (c) => {
  const user = c.get('currentUser');
  const submissionId = c.req.param('id');

  const row = await db
    .select({ participationId: submissions.participationId, templateId: submissions.templateId })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!row[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const canView = await canViewParticipationWithReason(
    user.id,
    row[0].participationId,
    c.get('organizationId'),
    row[0].templateId,
  );
  if (!canView.allowed) {
    return c.json(
      { error: 'Forbidden' as const, reason: toPublicForbiddenReason(canView.reason) },
      403,
    );
  }

  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: createPagingQuerySchema(listHistorySortValues, true),
    sortValues: listHistorySortValues,
    defaultSort: 'version:desc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const whereClause = and(
    eq(submissionHistories.submissionId, submissionId),
    parsed.value.q
      ? or(
          ilike(submissionHistories.fileName, `%${parsed.value.q}%`),
          ilike(submissionHistories.url, `%${parsed.value.q}%`),
        )
      : undefined,
  );

  const totalRows = await db
    .select({ total: count() })
    .from(submissionHistories)
    .where(whereClause);

  const sortColumn =
    parsed.value.sort.field === 'createdAt'
      ? submissionHistories.createdAt
      : submissionHistories.version;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const histories = await db
    .select({
      id: submissionHistories.id,
      submissionId: submissionHistories.submissionId,
      version: submissionHistories.version,
      submittedBy: submissionHistories.submittedBy,
      submittedByUser: {
        id: users.id,
        name: users.name,
      },
      fileName: submissionHistories.fileName,
      fileSizeBytes: submissionHistories.fileSizeBytes,
      fileMimeType: submissionHistories.fileMimeType,
      url: submissionHistories.url,
      createdAt: submissionHistories.createdAt,
    })
    .from(submissionHistories)
    .innerJoin(users, eq(users.id, submissionHistories.submittedBy))
    .where(whereClause)
    .orderBy(mainOrder, asc(submissionHistories.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  return c.json(
    {
      data: histories.map((history) => normalizeSubmissionHistory(history)),
      pagination: createPaginationMeta({
        page: parsed.value.page,
        pageSize: parsed.value.pageSize,
        total: totalRows[0]?.total ?? 0,
      }),
    },
    200,
  );
});

submissionRoutes.openapi(downloadSubmissionHistoryRoute, async (c) => {
  const user = c.get('currentUser');
  const historyId = c.req.param('historyId');

  const row = await db
    .select({
      history: submissionHistories,
      participationId: submissions.participationId,
      templateId: submissions.templateId,
    })
    .from(submissionHistories)
    .innerJoin(submissions, eq(submissions.id, submissionHistories.submissionId))
    .where(eq(submissionHistories.id, historyId))
    .limit(1);

  if (!row[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  const canView = await canViewParticipationWithReason(
    user.id,
    row[0].participationId,
    c.get('organizationId'),
    row[0].templateId,
  );
  if (!canView.allowed) {
    return c.json(
      { error: 'Forbidden' as const, reason: toPublicForbiddenReason(canView.reason) },
      403,
    );
  }

  if (!row[0].history.fileS3Key) {
    return c.json({ error: 'No file in this history entry' as const }, 400);
  }

  const download = await presignDownload(env.S3_BUCKET_SUBMISSIONS, row[0].history.fileS3Key);
  return c.json({ data: download }, 200);
});
