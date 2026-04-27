import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../lib/config.js';

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

type PresignUploadInput = {
  bucket: string;
  keyPrefix: string;
  fileName: string;
  contentType: string;
  contentLength?: number;
  expiresIn?: number;
};

type PresignUploadByKeyInput = {
  bucket: string;
  key: string;
  contentType: string;
  contentLength?: number;
  expiresIn?: number;
};

type ObjectMetadata = {
  contentLength: number | null;
  contentType: string | null;
};

type GetObjectMetadataOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchMetadata?: (bucket: string, key: string) => Promise<ObjectMetadata>;
};

const encodeName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const buildVersionedSubmissionKey = (params: {
  editionId: string;
  participationId: string;
  templateId: string;
  version: number;
  fileName: string;
}): string => {
  return `submissions/${params.editionId}/${params.participationId}/${params.templateId}/v${params.version}_${randomUUID()}_${encodeName(params.fileName)}`;
};

export const buildRuleKey = (editionId: string, fileName: string): string => {
  return `rules/${editionId}/${randomUUID()}_${encodeName(fileName)}`;
};

export const matchesVersionedSubmissionKey = (params: {
  key: string;
  editionId: string;
  participationId: string;
  templateId: string;
  version: number;
  fileName: string;
}): boolean => {
  const encodedFileName = escapeRegex(encodeName(params.fileName));
  const pattern = new RegExp(
    `^submissions/${escapeRegex(params.editionId)}/${escapeRegex(params.participationId)}/${escapeRegex(params.templateId)}/v${params.version}_[0-9a-f-]{36}_${encodedFileName}$`,
  );

  return pattern.test(params.key);
};

export const presignUpload = async (
  input: PresignUploadInput,
): Promise<{ presignedUrl: string; s3Key: string; expiresIn: number }> => {
  const expiresIn = input.expiresIn ?? 300;
  const key = `${input.keyPrefix}/${randomUUID()}_${encodeName(input.fileName)}`;

  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn });

  return {
    presignedUrl,
    s3Key: key,
    expiresIn,
  };
};

export const presignUploadByKey = async (
  input: PresignUploadByKeyInput,
): Promise<{ presignedUrl: string; s3Key: string; expiresIn: number }> => {
  const expiresIn = input.expiresIn ?? 300;

  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn });

  return {
    presignedUrl,
    s3Key: input.key,
    expiresIn,
  };
};

export const presignDownload = async (
  bucket: string,
  key: string,
  expiresIn = 300,
): Promise<{ presignedUrl: string; expiresIn: number }> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const presignedUrl = await getSignedUrl(s3, command, { expiresIn });
  return { presignedUrl, expiresIn };
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const headObject = async (bucket: string, key: string): Promise<HeadObjectCommandOutput> => {
  return await s3.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};

const toObjectMetadata = (response: HeadObjectCommandOutput): ObjectMetadata => {
  return {
    contentLength: response.ContentLength ?? null,
    contentType: response.ContentType ?? null,
  };
};

const hasCompleteObjectMetadata = (metadata: ObjectMetadata): boolean => {
  return metadata.contentLength !== null && metadata.contentType !== null;
};

const isRetryableMetadataLookupError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const metadata = (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata;
  const statusCode = metadata?.httpStatusCode;
  return statusCode === 404 || error.name === 'NotFound' || error.name === 'NoSuchKey';
};

export const getObjectMetadata = async (
  bucket: string,
  key: string,
  options: GetObjectMetadataOptions = {},
): Promise<ObjectMetadata> => {
  const maxAttempts = options.maxAttempts ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 1000;
  const wait = options.sleep ?? sleep;
  const fetchMetadata =
    options.fetchMetadata ??
    (async (innerBucket: string, innerKey: string): Promise<ObjectMetadata> => {
      return toObjectMetadata(await headObject(innerBucket, innerKey));
    });

  let lastIncompleteMetadata: ObjectMetadata | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const metadata = await fetchMetadata(bucket, key);
      if (hasCompleteObjectMetadata(metadata)) {
        return metadata;
      }

      lastIncompleteMetadata = metadata;
    } catch (error) {
      if (!isRetryableMetadataLookupError(error) || attempt === maxAttempts) {
        throw error;
      }
    }

    if (attempt < maxAttempts) {
      await wait(retryDelayMs);
    }
  }

  return lastIncompleteMetadata ?? { contentLength: null, contentType: null };
};
