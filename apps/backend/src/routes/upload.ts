import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import {
  competitionEditions,
  participations,
  submissionTemplates,
  submissions,
} from "../db/schema";
import { env } from "../lib/config";
import type { AppVariables } from "../middleware/auth";
import { getUserUniversityIds, isAdmin } from "../services/permissions";
import {
  buildVersionedSubmissionKey,
  presignUploadByKey,
} from "../services/storage";
import {
  isContentTypeConsistent,
  isSubmissionMutableStatus,
} from "../services/submission-validation";

const bodySchema = z.object({
  participationId: z.string().uuid(),
  templateId: z.string().uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const uploadRoutes = new Hono<{ Variables: AppVariables }>();

uploadRoutes.post("/upload/presign", async (c) => {
  const user = c.get("currentUser");
  const body = bodySchema.safeParse(await c.req.json());

  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const templateRows = await db
    .select({ template: submissionTemplates, edition: competitionEditions })
    .from(submissionTemplates)
    .innerJoin(
      competitionEditions,
      eq(competitionEditions.id, submissionTemplates.editionId),
    )
    .where(eq(submissionTemplates.id, body.data.templateId))
    .limit(1);

  const templateContext = templateRows[0];
  if (!templateContext) {
    return c.json({ error: "Template not found" }, 404);
  }

  const template = templateContext.template;

  if (template.acceptType !== "file") {
    return c.json({ error: "Template does not accept file upload" }, 400);
  }

  if (!isSubmissionMutableStatus(templateContext.edition.sharingStatus)) {
    return c.json(
      { error: "Submissions are not accepted in current sharing_status" },
      409,
    );
  }

  const extension = body.data.fileName.split(".").pop()?.toLowerCase();
  if (
    template.allowedExtensions?.length &&
    (!extension || !template.allowedExtensions.includes(extension))
  ) {
    return c.json({ error: "Disallowed file extension" }, 400);
  }

  if (!isContentTypeConsistent(body.data.fileName, body.data.contentType)) {
    return c.json(
      { error: "contentType is inconsistent with file extension" },
      400,
    );
  }

  const participationRows = await db
    .select({
      universityId: participations.universityId,
      editionId: participations.editionId,
    })
    .from(participations)
    .where(eq(participations.id, body.data.participationId))
    .limit(1);

  if (!participationRows[0]) {
    return c.json({ error: "Participation not found" }, 404);
  }

  if (participationRows[0].editionId !== template.editionId) {
    return c.json({ error: "Template and participation mismatch" }, 400);
  }

  if (!(await isAdmin(user.id))) {
    const organizationIds = await getUserUniversityIds(user.id);
    if (
      !participationRows[0] ||
      !organizationIds.includes(participationRows[0].universityId)
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const existingSubmission = await db
    .select({ version: submissions.version })
    .from(submissions)
    .where(
      and(
        eq(submissions.templateId, body.data.templateId),
        eq(submissions.participationId, body.data.participationId),
      ),
    )
    .limit(1);

  const nextVersion = (existingSubmission[0]?.version ?? 0) + 1;
  const key = buildVersionedSubmissionKey({
    editionId: template.editionId,
    participationId: body.data.participationId,
    templateId: body.data.templateId,
    version: nextVersion,
    fileName: body.data.fileName,
  });

  const result = await presignUploadByKey({
    bucket: env.S3_BUCKET_SUBMISSIONS,
    key,
    contentType: body.data.contentType,
  });

  return c.json({
    data: {
      presignedUrl: result.presignedUrl,
      s3Key: result.s3Key,
      expiresIn: result.expiresIn,
      templateMaxFileSizeMb: template.maxFileSizeMb,
    },
  });
});
