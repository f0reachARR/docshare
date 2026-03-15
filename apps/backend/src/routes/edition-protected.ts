import { OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { participations, submissionTemplates, submissions } from "../db/schema";
import type { AppVariables } from "../middleware/auth";

export const editionProtectedRoutes = new OpenAPIHono<{
  Variables: AppVariables;
}>();

editionProtectedRoutes.get("/editions/:id/templates", async (c) => {
  const id = c.req.param("id");
  const rows = await db
    .select()
    .from(submissionTemplates)
    .where(eq(submissionTemplates.editionId, id))
    .orderBy(asc(submissionTemplates.sortOrder));

  return c.json({ data: rows });
});

editionProtectedRoutes.get("/editions/:id/my-submissions", async (c) => {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "x-organization-id is required" }, 400);
  }

  const editionId = c.req.param("id");

  const rows = await db
    .select({ submission: submissions })
    .from(submissions)
    .innerJoin(
      participations,
      eq(participations.id, submissions.participationId),
    )
    .innerJoin(
      submissionTemplates,
      eq(submissionTemplates.id, submissions.templateId),
    )
    .where(
      and(
        eq(submissionTemplates.editionId, editionId),
        eq(participations.universityId, organizationId),
      ),
    );

  return c.json({ data: rows.map((row) => row.submission), organizationId });
});
