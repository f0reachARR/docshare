import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { participations, submissionTemplates, submissions } from '../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  paginationSchema,
  parsePagingParams,
} from '../lib/pagination.js';
import type { AppVariables } from '../middleware/auth.js';

export const editionProtectedRoutes = new OpenAPIHono<{
  Variables: AppVariables;
}>();

const templateSchema = z.object({
  id: z.string().uuid(),
  editionId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  acceptType: z.enum(['file', 'url']),
  allowedExtensions: z.array(z.string()).nullable(),
  urlPattern: z.string().nullable(),
  maxFileSizeMb: z.number().int(),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.any(),
});

const mySubmissionSchema = z.object({
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

const templateSortValues = [
  'sortOrder:asc',
  'sortOrder:desc',
  'name:asc',
  'name:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

const mySubmissionSortValues = [
  'updatedAt:desc',
  'updatedAt:asc',
  'createdAt:desc',
  'createdAt:asc',
] as const;

const templatePagingQuerySchema = createPagingQuerySchema(templateSortValues, true);
const mySubmissionPagingQuerySchema = createPagingQuerySchema(mySubmissionSortValues, true);

const listTemplatesRoute = createRoute({
  method: 'get',
  path: '/editions/{id}/templates',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: templatePagingQuerySchema,
  },
  responses: {
    200: {
      description: '資料種別テンプレート一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(templateSchema),
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

const listMySubmissionsRoute = createRoute({
  method: 'get',
  path: '/editions/{id}/my-submissions',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: mySubmissionPagingQuerySchema,
  },
  responses: {
    200: {
      description: '自大学の提出一覧',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(mySubmissionSchema),
            organizationId: z.string(),
            pagination: paginationSchema,
          }),
        },
      },
    },
    400: {
      description: '不正クエリ',
      content: {
        'application/json': {
          schema: z.object({
            error: z.union([
              z.literal('Invalid query'),
              z.literal('x-organization-id is required'),
            ]),
          }),
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

editionProtectedRoutes.openapi(listTemplatesRoute, async (c) => {
  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: templatePagingQuerySchema,
    sortValues: templateSortValues,
    defaultSort: 'sortOrder:asc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const id = c.req.param('id');
  const whereClause = parsed.value.q
    ? and(
        eq(submissionTemplates.editionId, id),
        or(
          ilike(submissionTemplates.name, `%${parsed.value.q}%`),
          ilike(submissionTemplates.description, `%${parsed.value.q}%`),
        ),
      )
    : eq(submissionTemplates.editionId, id);

  const totalRows = await db
    .select({ total: count() })
    .from(submissionTemplates)
    .where(whereClause);

  const sortColumn =
    parsed.value.sort.field === 'sortOrder'
      ? submissionTemplates.sortOrder
      : parsed.value.sort.field === 'name'
        ? submissionTemplates.name
        : submissionTemplates.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select()
    .from(submissionTemplates)
    .where(whereClause)
    .orderBy(mainOrder, asc(submissionTemplates.id))
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

editionProtectedRoutes.openapi(listMySubmissionsRoute, async (c) => {
  const organizationId = c.get('organizationId');
  if (!organizationId) {
    return c.json({ error: 'x-organization-id is required' as const }, 400);
  }

  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: mySubmissionPagingQuerySchema,
    sortValues: mySubmissionSortValues,
    defaultSort: 'updatedAt:desc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const editionId = c.req.param('id');
  const whereClause = and(
    eq(submissionTemplates.editionId, editionId),
    eq(participations.universityId, organizationId),
    parsed.value.q
      ? or(
          ilike(submissionTemplates.name, `%${parsed.value.q}%`),
          ilike(submissions.fileName, `%${parsed.value.q}%`),
          ilike(submissions.url, `%${parsed.value.q}%`),
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
    parsed.value.sort.field === 'createdAt' ? submissions.createdAt : submissions.updatedAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const pagedRows = await db
    .select({ submission: submissions })
    .from(submissions)
    .innerJoin(participations, eq(participations.id, submissions.participationId))
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .where(whereClause)
    .orderBy(mainOrder, asc(submissions.id))
    .limit(parsed.value.pageSize)
    .offset(parsed.value.offset);

  return c.json(
    {
      data: pagedRows.map((row) => row.submission),
      organizationId,
      pagination: createPaginationMeta({
        page: parsed.value.page,
        pageSize: parsed.value.pageSize,
        total: totalRows[0]?.total ?? 0,
      }),
    },
    200,
  );
});
