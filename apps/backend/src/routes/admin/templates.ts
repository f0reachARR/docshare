import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { submissionTemplates } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/auth.js';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  acceptType: z.enum(["file", "url"]),
  allowedExtensions: z.array(z.string()).optional(),
  urlPattern: z.string().optional(),
  maxFileSizeMb: z.number().int().positive().default(100),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const adminTemplateRoutes = new Hono<{ Variables: AppVariables }>();

adminTemplateRoutes.post("/editions/:id/templates", async (c) => {
  const editionId = c.req.param("id");
  const body = schema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(submissionTemplates)
    .values({
      editionId,
      name: body.data.name,
      description: body.data.description,
      acceptType: body.data.acceptType,
      allowedExtensions: body.data.allowedExtensions,
      urlPattern: body.data.urlPattern,
      maxFileSizeMb: body.data.maxFileSizeMb,
      isRequired: body.data.isRequired,
      sortOrder: body.data.sortOrder,
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

adminTemplateRoutes.put("/templates/:id", async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(submissionTemplates)
    .set({
      name: body.data.name,
      description: body.data.description,
      acceptType: body.data.acceptType,
      allowedExtensions: body.data.allowedExtensions,
      urlPattern: body.data.urlPattern,
      maxFileSizeMb: body.data.maxFileSizeMb,
      isRequired: body.data.isRequired,
      sortOrder: body.data.sortOrder,
    })
    .where(eq(submissionTemplates.id, c.req.param("id")))
    .returning();

  if (!updated[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ data: updated[0] });
});

adminTemplateRoutes.delete("/templates/:id", async (c) => {
  await db
    .delete(submissionTemplates)
    .where(eq(submissionTemplates.id, c.req.param("id")));
  return c.body(null, 204);
});

adminTemplateRoutes.post(
  "/editions/:id/templates/copy-from/:sourceEditionId",
  async (c) => {
    const editionId = c.req.param("id");
    const sourceEditionId = c.req.param("sourceEditionId");

    const source = await db
      .select()
      .from(submissionTemplates)
      .where(eq(submissionTemplates.editionId, sourceEditionId));

    if (source.length === 0) {
      return c.json({ data: [] }, 201);
    }

    const values = source.map((template) => ({
      editionId,
      name: template.name,
      description: template.description,
      acceptType: template.acceptType,
      allowedExtensions: template.allowedExtensions,
      urlPattern: template.urlPattern,
      maxFileSizeMb: template.maxFileSizeMb,
      isRequired: template.isRequired,
      sortOrder: template.sortOrder,
    }));

    const inserted = await db
      .insert(submissionTemplates)
      .values(values)
      .returning();
    return c.json({ data: inserted }, 201);
  },
);
