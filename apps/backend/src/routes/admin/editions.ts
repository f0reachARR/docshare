import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { competitionEditions } from '../../db/schema.js';
import { env } from '../../lib/config.js';
import type { AppVariables } from '../../middleware/auth.js';
import { presignUpload } from '../../services/storage.js';

const schema = z.object({
  seriesId: z.string().uuid(),
  year: z.number().int(),
  name: z.string().min(1),
  description: z.string().optional(),
  sharingStatus: z
    .enum(["draft", "accepting", "sharing", "closed"])
    .default("draft"),
  externalLinks: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .optional(),
});

const statusSchema = z.object({
  sharingStatus: z.enum(["draft", "accepting", "sharing", "closed"]),
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

const editionSchema = z.object({
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  year: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  ruleDocuments: z
    .array(
      z.object({
        label: z.string(),
        s3_key: z.string(),
        mime_type: z.string(),
      }),
    )
    .nullable(),
  sharingStatus: z.enum(["draft", "accepting", "sharing", "closed"]),
  externalLinks: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const createEditionRoute = createRoute({
  method: "post",
  path: "/editions",
  request: {
    body: {
      content: {
        "application/json": {
          schema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "大会開催回作成",
      content: {
        "application/json": {
          schema: z.object({ data: editionSchema }),
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
  },
});

const updateSharingStatusRoute = createRoute({
  method: "put",
  path: "/editions/{id}/status",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: statusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "sharing_status更新",
      content: {
        "application/json": {
          schema: z.object({ data: editionSchema }),
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
    404: {
      description: "未検出",
      content: {
        "application/json": {
          schema: z.object({ error: z.literal("Not found") }),
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

  return c.json({ data: inserted[0] }, 201);
});

adminEditionRoutes.put("/editions/:id", async (c) => {
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
    .where(eq(competitionEditions.id, c.req.param("id")))
    .returning();

  if (!updated[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ data: updated[0] });
});

adminEditionRoutes.delete("/editions/:id", async (c) => {
  await db
    .delete(competitionEditions)
    .where(eq(competitionEditions.id, c.req.param("id")));
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
    .where(eq(competitionEditions.id, c.req.param("id")))
    .returning();

  if (!updated[0]) {
    return c.json({ error: "Not found" as const }, 404);
  }

  return c.json({ data: updated[0] }, 200);
});

adminEditionRoutes.post("/editions/:id/rules/presign", async (c) => {
  const editionId = c.req.param("id");
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

  return c.json({ data: result });
});

adminEditionRoutes.put("/editions/:id/rules", async (c) => {
  const editionId = c.req.param("id");
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
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ data: updated[0] });
});
