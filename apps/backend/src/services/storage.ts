import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
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
  expiresIn?: number;
};

type PresignUploadByKeyInput = {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn?: number;
};

const encodeName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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

export const presignUpload = async (
  input: PresignUploadInput,
): Promise<{ presignedUrl: string; s3Key: string; expiresIn: number }> => {
  const expiresIn = input.expiresIn ?? 300;
  const key = `${input.keyPrefix}/${randomUUID()}_${encodeName(input.fileName)}`;

  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: key,
    ContentType: input.contentType,
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
