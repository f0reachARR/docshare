import { z } from '@hono/zod-openapi';
import type { competitionEditions } from '../db/schema.js';
import { presignDownload } from '../services/storage.js';
import { env } from './config.js';

const ruleDocumentResponseSchema = z.object({
  label: z.string(),
  s3_key: z.string(),
  mime_type: z.string(),
  url: z.string().url(),
});

export const editionResponseSchema = z.object({
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  year: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  ruleDocuments: z.array(ruleDocumentResponseSchema).nullable(),
  sharingStatus: z.enum(['draft', 'accepting', 'sharing', 'closed']),
  externalLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

type EditionRecord = typeof competitionEditions.$inferSelect;

const toRuleDocumentResponse = async (
  ruleDocument: NonNullable<EditionRecord['ruleDocuments']>[number],
): Promise<z.infer<typeof ruleDocumentResponseSchema>> => {
  const download = await presignDownload(env.S3_BUCKET_RULES, ruleDocument.s3_key);

  return {
    ...ruleDocument,
    url: download.presignedUrl,
  };
};

export const toEditionResponse = async (
  edition: EditionRecord,
): Promise<z.infer<typeof editionResponseSchema>> => {
  return {
    ...edition,
    ruleDocuments: edition.ruleDocuments
      ? await Promise.all(edition.ruleDocuments.map(toRuleDocumentResponse))
      : null,
  };
};

export const toEditionResponses = async (
  editions: EditionRecord[],
): Promise<Array<z.infer<typeof editionResponseSchema>>> => {
  return Promise.all(editions.map((edition) => toEditionResponse(edition)));
};
