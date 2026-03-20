import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { competitionEditions } from '../../db/schema.js';
import { env } from '../../lib/config.js';
import { editionResponseSchema, toEditionResponse } from '../../lib/edition-response.js';
import type { AppVariables } from '../../middleware/auth.js';
import { presignUpload } from '../../services/storage.js';

const schema = z.object({
  seriesId: z.string().uuid(),
  year: z.number().int(),
  name: z.string().min(1),
  description: z.string().optional(),
  sharingStatus: z.enum(['draft', 'accepting', 'sharing', 'closed']).default('draft'),
  externalLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
});

const statusSchema = z.object({
  sharingStatus: z.enum(['draft', 'accepting', 'sharing', 'closed']),
});

const rulePresignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

const ruleUpdateSchema = z.object({
  ruleDocuments: z.array(
    z.object({
      label: z.string(),
      s3_key: z.string().min(1),
      mime_type: z.string().min(1),
    }),
  ),
});

const createEditionRoute = createRoute({
  method: 'post',
  path: '/editions',
  request: {
    body: {
      content: {
        'application/json': {
          schema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '大会開催回作成',
      content: {
        'application/json': {
          schema: z.object({ data: editionResponseSchema }),
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

const updateSharingStatusRoute = createRoute({
  method: 'put',
  path: '/editions/{id}/status',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: statusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'sharing_status更新',
      content: {
        'application/json': {
          schema: z.object({ data: editionResponseSchema }),
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
  },
});

const updateEditionRoute = createRoute({
  method: 'put',
  path: '/editions/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '大会開催回更新',
      content: {
        'application/json': {
          schema: z.object({ data: editionResponseSchema }),
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
  },
});

const deleteEditionRoute = createRoute({
  method: 'delete',
  path: '/editions/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: {
      description: '大会開催回削除',
    },
  },
});

const rulePresignResponseSchema = z.object({
  presignedUrl: z.string().url(),
  s3Key: z.string(),
  expiresIn: z.number().int(),
});

const presignRuleUploadRoute = createRoute({
  method: 'post',
  path: '/editions/{id}/rules/presign',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: rulePresignSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'ルール資料アップロード署名URL発行',
      content: {
        'application/json': {
          schema: z.object({ data: rulePresignResponseSchema }),
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

const updateRulesRoute = createRoute({
  method: 'put',
  path: '/editions/{id}/rules',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: ruleUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'ルール資料更新',
      content: {
        'application/json': {
          schema: z.object({ data: editionResponseSchema }),
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
  },
});

export const adminEditionRoutes = new OpenAPIHono<{
  Variables: AppVariables;
}>();

adminEditionRoutes.openapi(createEditionRoute, async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(competitionEditions)
    .values({
      seriesId: body.data.seriesId,
      year: body.data.year,
      name: body.data.name,
      description: body.data.description,
      sharingStatus: body.data.sharingStatus,
      externalLinks: body.data.externalLinks,
    })
    .returning();

  return c.json({ data: await toEditionResponse(inserted[0]) }, 201);
});

adminEditionRoutes.openapi(updateEditionRoute, async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(competitionEditions)
    .set({
      seriesId: body.data.seriesId,
      year: body.data.year,
      name: body.data.name,
      description: body.data.description,
      sharingStatus: body.data.sharingStatus,
      externalLinks: body.data.externalLinks,
      updatedAt: new Date(),
    })
    .where(eq(competitionEditions.id, c.req.param('id')))
    .returning();

  if (!updated[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: await toEditionResponse(updated[0]) }, 200);
});

adminEditionRoutes.openapi(deleteEditionRoute, async (c) => {
  await db.delete(competitionEditions).where(eq(competitionEditions.id, c.req.param('id')));
  return c.body(null, 204);
});

adminEditionRoutes.openapi(updateSharingStatusRoute, async (c) => {
  const body = statusSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(competitionEditions)
    .set({ sharingStatus: body.data.sharingStatus, updatedAt: new Date() })
    .where(eq(competitionEditions.id, c.req.param('id')))
    .returning();

  if (!updated[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: await toEditionResponse(updated[0]) }, 200);
});

adminEditionRoutes.openapi(presignRuleUploadRoute, async (c) => {
  const editionId = c.req.param('id');
  const body = rulePresignSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const result = await presignUpload({
    bucket: env.S3_BUCKET_RULES,
    keyPrefix: `rules/${editionId}`,
    fileName: body.data.fileName,
    contentType: body.data.contentType,
  });

  return c.json({ data: result }, 200);
});

adminEditionRoutes.openapi(updateRulesRoute, async (c) => {
  const editionId = c.req.param('id');
  const body = ruleUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(competitionEditions)
    .set({ ruleDocuments: body.data.ruleDocuments, updatedAt: new Date() })
    .where(eq(competitionEditions.id, editionId))
    .returning();

  if (!updated[0]) {
    return c.json({ error: 'Not found' as const }, 404);
  }

  return c.json({ data: await toEditionResponse(updated[0]) }, 200);
});
