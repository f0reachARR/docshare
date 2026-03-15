import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { competitionEditions } from "../db/schema";

const querySchema = z.object({
  series_id: z.string().uuid().optional(),
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

const editionListRoute = createRoute({
  method: "get",
  path: "/editions",
  request: {
    query: querySchema,
  },
  responses: {
    200: {
      description: "大会開催回一覧",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(editionSchema) }),
        },
      },
    },
    400: {
      description: "不正クエリ",
      content: {
        "application/json": {
          schema: z.object({ error: z.literal("Invalid query") }),
        },
      },
    },
  },
});

const editionDetailRoute = createRoute({
  method: "get",
  path: "/editions/{id}",
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "大会開催回詳細",
      content: {
        "application/json": {
          schema: z.object({ data: editionSchema }),
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

export const editionRoutes = new OpenAPIHono();

editionRoutes.openapi(editionListRoute, async (c) => {
  const parse = querySchema.safeParse(c.req.query());
  if (!parse.success) {
    return c.json({ error: "Invalid query" as const }, 400);
  }

  const rows = parse.data.series_id
    ? await db
        .select()
        .from(competitionEditions)
        .where(eq(competitionEditions.seriesId, parse.data.series_id))
        .orderBy(asc(competitionEditions.year))
    : await db
        .select()
        .from(competitionEditions)
        .orderBy(asc(competitionEditions.year));

  return c.json({ data: rows }, 200);
});

editionRoutes.openapi(editionDetailRoute, async (c) => {
  const id = c.req.param("id");
  const rows = await db
    .select()
    .from(competitionEditions)
    .where(eq(competitionEditions.id, id))
    .limit(1);
  if (!rows[0]) {
    return c.json({ error: "Not found" as const }, 404);
  }
  return c.json({ data: rows[0] }, 200);
});
