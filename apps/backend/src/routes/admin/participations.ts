import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { participations } from "../../db/schema";
import type { AppVariables } from "../../middleware/auth";

const createSchema = z.object({
  universityId: z.string().min(1),
  teamName: z.string().optional(),
});

const updateSchema = z.object({
  teamName: z.string().nullable().optional(),
});

export const adminParticipationRoutes = new Hono<{ Variables: AppVariables }>();

adminParticipationRoutes.post("/editions/:id/participations", async (c) => {
  const editionId = c.req.param("id");
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(participations)
    .values({
      editionId,
      universityId: body.data.universityId,
      teamName: body.data.teamName,
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

adminParticipationRoutes.put("/participations/:id", async (c) => {
  const body = updateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const updated = await db
    .update(participations)
    .set({ teamName: body.data.teamName ?? null })
    .where(eq(participations.id, c.req.param("id")))
    .returning();

  if (!updated[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ data: updated[0] });
});

adminParticipationRoutes.delete("/participations/:id", async (c) => {
  await db
    .delete(participations)
    .where(eq(participations.id, c.req.param("id")));
  return c.body(null, 204);
});
