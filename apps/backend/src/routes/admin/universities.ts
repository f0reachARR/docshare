import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { invitations, organizations } from "../../db/schema";
import type { AppVariables } from "../../middleware/auth";
import { emailService } from "../../services/email";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  ownerEmail: z.string().email().optional(),
});

export const adminUniversityRoutes = new Hono<{ Variables: AppVariables }>();

adminUniversityRoutes.post("/universities", async (c) => {
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(organizations)
    .values({
      id: randomUUID(),
      name: body.data.name,
      slug: body.data.slug,
    })
    .returning();

  if (body.data.ownerEmail) {
    const inviter = c.get("currentUser");
    const invitationId = randomUUID();
    await db.insert(invitations).values({
      id: invitationId,
      organizationId: inserted[0].id,
      email: body.data.ownerEmail,
      role: "owner",
      invitedBy: inviter.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    await emailService.sendEmail({
      to: body.data.ownerEmail,
      subject: `${inserted[0].name} の代表者招待`,
      html: `招待ID: ${invitationId}`,
    });
  }

  return c.json({ data: inserted[0] }, 201);
});

adminUniversityRoutes.get("/universities", async (c) => {
  const rows = await db.select().from(organizations);
  return c.json({ data: rows });
});
