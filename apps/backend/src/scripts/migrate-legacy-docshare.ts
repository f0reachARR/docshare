import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getDbClient } from '../db/index.js';
import { env } from '../lib/config.js';
import { buildVersionedSubmissionKey } from '../services/storage.js';

type LegacyUser = {
  id: number;
  password: string;
  username: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
};

type LegacyCompetition = {
  id: number;
  name: string;
  year: number;
};

type LegacyDocument = {
  id: number;
  doc0: string;
  doc1: string;
  video1: string;
  doc2: string;
  video2: string;
  video3: string;
  competitionId: number;
  userId: number;
};

type FieldKey = 'doc0' | 'doc1' | 'video1' | 'doc2' | 'video2' | 'video3';

type TemplateDefinition = {
  key: FieldKey;
  name: string;
  acceptType: 'file' | 'url';
  sortOrder: number;
  allowedExtensions?: string[];
};

type LegacyData = {
  users: LegacyUser[];
  competitions: LegacyCompetition[];
  documents: LegacyDocument[];
};

type SubmissionPayload = {
  fileS3Key: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileMimeType: string | null;
  url: string | null;
};

type UploadJob = {
  localPath: string;
  key: string;
  contentType: string;
  contentLength: number;
};

const findMigrationSourceRoot = (): string => {
  let current = resolve(process.cwd());

  while (true) {
    const candidate = join(current, 'migration_source');
    if (existsSync(join(candidate, 'docshare.sql'))) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error('migration_source/docshare.sql was not found from the current directory.');
    }
    current = parent;
  }
};

const sourceRoot = findMigrationSourceRoot();
const sqlPath = join(sourceRoot, 'docshare.sql');
const documentsRoot = join(sourceRoot, 'documents');

const templates: TemplateDefinition[] = [
  {
    key: 'doc0',
    name: '書類審査資料',
    acceptType: 'file',
    sortOrder: 10,
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  },
  {
    key: 'doc1',
    name: '第1次ビデオ補足資料',
    acceptType: 'file',
    sortOrder: 20,
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  },
  { key: 'video1', name: '第1次ビデオリンク', acceptType: 'url', sortOrder: 30 },
  {
    key: 'doc2',
    name: '第2次ビデオ補足資料',
    acceptType: 'file',
    sortOrder: 40,
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  },
  { key: 'video2', name: '第2次ビデオリンク', acceptType: 'url', sortOrder: 50 },
  { key: 'video3', name: '第3次ビデオリンク', acceptType: 'url', sortOrder: 60 },
];

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

const normalizeSlug = (value: string, fallback: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const toDate = (value: string): Date => {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const readValue = (value: string | undefined): string => {
  return value ?? '';
};

const parseInteger = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid integer value: ${value ?? '<missing>'}`);
  }
  return parsed;
};

const requireMapValue = <Key, Value>(map: Map<Key, Value>, key: Key, label: string): Value => {
  const value = map.get(key);
  if (!value) {
    throw new Error(`${label} is missing for ${String(key)}.`);
  }

  return value;
};

const extractInsertStatements = (sql: string, table: string): string[] => {
  const prefix = `INSERT INTO \`${table}\` VALUES `;
  const statements: string[] = [];
  let index = 0;

  while (index < sql.length) {
    const start = sql.indexOf(prefix, index);
    if (start === -1) {
      break;
    }

    let cursor = start + prefix.length;
    let quote: "'" | null = null;
    let escaped = false;

    while (cursor < sql.length) {
      const char = sql[cursor];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
      } else if (char === "'") {
        quote = "'";
      } else if (char === ';') {
        break;
      }
      cursor += 1;
    }

    statements.push(sql.slice(start + prefix.length, cursor));
    index = cursor + 1;
  }

  return statements;
};

const unescapeSqlString = (value: string): string => {
  return value.replace(/\\([0bnrtZ'"\\])/g, (_match: string, escaped: string) => {
    const replacements: Record<string, string> = {
      '0': '\0',
      b: '\b',
      n: '\n',
      r: '\r',
      t: '\t',
      Z: '\u001A',
      "'": "'",
      '"': '"',
      '\\': '\\',
    };

    return replacements[escaped] ?? escaped;
  });
};

const parseTuples = (input: string): string[][] => {
  const rows: string[][] = [];
  let cursor = 0;

  const skipWhitespace = (): void => {
    while (/\s/.test(input[cursor] ?? '')) {
      cursor += 1;
    }
  };

  while (cursor < input.length) {
    skipWhitespace();
    if (input[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (input[cursor] !== '(') {
      break;
    }
    cursor += 1;

    const row: string[] = [];
    while (cursor < input.length) {
      skipWhitespace();
      if (input[cursor] === "'") {
        cursor += 1;
        let value = '';
        let escaped = false;
        while (cursor < input.length) {
          const char = input[cursor] ?? '';
          cursor += 1;
          if (escaped) {
            value += `\\${char}`;
            escaped = false;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            continue;
          }
          if (char === "'") {
            break;
          }
          value += char;
        }
        row.push(unescapeSqlString(value));
      } else {
        const start = cursor;
        while (cursor < input.length && input[cursor] !== ',' && input[cursor] !== ')') {
          cursor += 1;
        }
        const raw = input.slice(start, cursor).trim();
        row.push(raw.toUpperCase() === 'NULL' ? '' : raw);
      }

      skipWhitespace();
      if (input[cursor] === ',') {
        cursor += 1;
        continue;
      }
      if (input[cursor] === ')') {
        cursor += 1;
        rows.push(row);
        break;
      }
    }
  }

  return rows;
};

const parseLegacyData = async (): Promise<LegacyData> => {
  const sql = await readFile(sqlPath, 'utf8');

  const users = extractInsertStatements(sql, 'auth_user')
    .flatMap(parseTuples)
    .map((row): LegacyUser => {
      return {
        id: parseInteger(row[0]),
        password: readValue(row[1]),
        username: readValue(row[4]),
        name: readValue(row[5]) || readValue(row[4]),
        email: readValue(row[7]),
        isAdmin: row[3] === '1' || row[8] === '1',
        isActive: row[9] === '1',
        createdAt: toDate(readValue(row[10])),
      };
    });

  const competitions = extractInsertStatements(sql, 'docshare_competition')
    .flatMap(parseTuples)
    .map((row): LegacyCompetition => {
      const name = readValue(row[1]);
      const yearText = name.match(/\d{4}/)?.[0];
      if (!yearText) {
        throw new Error(`Competition year is missing: ${name}`);
      }

      return {
        id: parseInteger(row[0]),
        name,
        year: parseInteger(yearText),
      };
    });

  const documents = extractInsertStatements(sql, 'docshare_document')
    .flatMap(parseTuples)
    .map((row): LegacyDocument => {
      return {
        id: parseInteger(row[0]),
        doc0: readValue(row[1]),
        doc1: readValue(row[2]),
        video1: readValue(row[3]),
        doc2: readValue(row[4]),
        video2: readValue(row[5]),
        video3: readValue(row[6]),
        competitionId: parseInteger(row[7]),
        userId: parseInteger(row[8]),
      };
    });

  return { users, competitions, documents };
};

const createEmailByLegacyUser = (users: LegacyUser[]): Map<number, string> => {
  const emailCounts = new Map<string, number>();
  for (const user of users) {
    const normalized = user.email.trim().toLowerCase();
    if (normalized) {
      emailCounts.set(normalized, (emailCounts.get(normalized) ?? 0) + 1);
    }
  }

  return new Map(
    users.map((user) => {
      const normalized = user.email.trim().toLowerCase();
      const email =
        normalized && emailCounts.get(normalized) === 1
          ? normalized
          : `legacy-${normalizeSlug(user.username, String(user.id))}@legacy.local`;

      return [user.id, email];
    }),
  );
};

const fieldValue = (document: LegacyDocument, key: FieldKey): string => {
  return document[key].trim();
};

const toPublicUrl = (value: string): string => {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `https://www.youtube.com/watch?v=${value}`;
};

const contentTypeByPath = (path: string): string => {
  const extension = extname(path).toLowerCase();
  const contentTypes = new Map<string, string>([
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['.xls', 'application/vnd.ms-excel'],
    ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['.ppt', 'application/vnd.ms-powerpoint'],
    ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ]);

  return contentTypes.get(extension) ?? 'application/octet-stream';
};

const toSubmissionPayloadValues = (payload: SubmissionPayload): unknown[] => {
  return [
    payload.fileS3Key,
    payload.fileName,
    payload.fileSizeBytes,
    payload.fileMimeType,
    payload.url,
  ];
};

const prepareLegacyFilePayload = async (params: {
  legacyPath: string;
  editionId: string;
  participationId: string;
  templateId: string;
  version: number;
  uploadJobs: UploadJob[];
  skipFiles: boolean;
}): Promise<SubmissionPayload> => {
  const localPath = join(documentsRoot, params.legacyPath);
  const metadata = await stat(localPath);
  const fileName = basename(params.legacyPath);
  const key = buildVersionedSubmissionKey({
    editionId: params.editionId,
    participationId: params.participationId,
    templateId: params.templateId,
    version: params.version,
    fileName,
  });
  const mimeType = contentTypeByPath(params.legacyPath);

  if (!params.skipFiles) {
    params.uploadJobs.push({
      localPath,
      key,
      contentType: mimeType,
      contentLength: metadata.size,
    });
  }

  return {
    fileS3Key: key,
    fileName,
    fileSizeBytes: metadata.size,
    fileMimeType: mimeType,
    url: null,
  };
};

const uploadPreparedFile = async (job: UploadJob): Promise<void> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_SUBMISSIONS,
      Key: job.key,
      Body: createReadStream(job.localPath),
      ContentType: job.contentType,
      ContentLength: job.contentLength,
    }),
  );
};

const run = async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const skipFiles = process.argv.includes('--skip-files');
  const data = await parseLegacyData();
  const emailByLegacyUser = createEmailByLegacyUser(data.users);
  const client = dryRun ? null : await getDbClient();
  const documentsByParticipation = new Map<string, LegacyDocument[]>();

  for (const document of data.documents) {
    const key = `${document.competitionId}:${document.userId}`;
    const documents = documentsByParticipation.get(key) ?? [];
    documents.push(document);
    documentsByParticipation.set(key, documents);
  }

  console.info(
    [
      `legacy users: ${data.users.length}`,
      `legacy competitions: ${data.competitions.length}`,
      `legacy document rows: ${data.documents.length}`,
      `legacy participations: ${documentsByParticipation.size}`,
    ].join('\n'),
  );

  if (dryRun) {
    return;
  }

  if (!client) {
    throw new Error('Database client was not created.');
  }

  const seriesId = randomUUID();
  const editionIdByCompetition = new Map(
    data.competitions.map((competition) => [competition.id, randomUUID()]),
  );
  const userIdByLegacyUser = new Map(data.users.map((user) => [user.id, randomUUID()]));
  const organizationIdByLegacyUser = new Map(data.users.map((user) => [user.id, randomUUID()]));
  const templateIdByCompetitionAndField = new Map<string, string>();
  const participationIdByKey = new Map(
    [...documentsByParticipation.keys()].map((key) => [key, randomUUID()]),
  );
  const uploadJobs: UploadJob[] = [];

  for (const competition of data.competitions) {
    for (const template of templates) {
      templateIdByCompetitionAndField.set(`${competition.id}:${template.key}`, randomUUID());
    }
  }

  let committed = false;

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO competition_series (id, name, description, external_links)
        VALUES ($1, $2, $3, $4)
      `,
      [
        seriesId,
        'NHK学生ロボコン',
        '旧製本企画から移行したNHK学生ロボコンの資料共有データです。',
        JSON.stringify([]),
      ],
    );

    for (const competition of data.competitions) {
      const editionId = requireMapValue(
        editionIdByCompetition,
        competition.id,
        'Competition edition ID',
      );
      await client.query(
        `
          INSERT INTO competition_edition (id, series_id, year, name, description, sharing_status)
          VALUES ($1, $2, $3, $4, $5, 'sharing')
        `,
        [
          editionId,
          seriesId,
          competition.year,
          `NHK学生ロボコン${competition.year}`,
          `旧製本企画の ${competition.name} から移行した資料です。`,
        ],
      );

      for (const template of templates) {
        const templateId = requireMapValue(
          templateIdByCompetitionAndField,
          `${competition.id}:${template.key}`,
          'Submission template ID',
        );

        await client.query(
          `
            INSERT INTO submission_template (
              id,
              edition_id,
              name,
              accept_type,
              allowed_extensions,
              sort_order,
              max_file_size_mb
            )
            VALUES ($1, $2, $3, $4, $5, $6, 1024)
          `,
          [
            templateId,
            editionId,
            template.name,
            template.acceptType,
            template.allowedExtensions ?? null,
            template.sortOrder,
          ],
        );
      }
    }

    for (const user of data.users) {
      const userId = requireMapValue(userIdByLegacyUser, user.id, 'User ID');
      const organizationId = requireMapValue(
        organizationIdByLegacyUser,
        user.id,
        'Organization ID',
      );
      const slug = normalizeSlug(user.username, `legacy-org-${user.id}`);
      const email = emailByLegacyUser.get(user.id);

      if (!email) {
        throw new Error(`Email mapping is missing for legacy user ${user.id}.`);
      }

      await client.query(
        `
          INSERT INTO "user" (id, email, name, email_verified, is_admin, created_at, updated_at)
          VALUES ($1, $2, $3, false, $4, $5, $5)
        `,
        [userId, email, user.name, user.isAdmin, user.createdAt],
      );

      await client.query(
        `
          INSERT INTO organization (id, name, slug, metadata)
          VALUES ($1, $2, $3, $4)
        `,
        [
          organizationId,
          user.name,
          slug,
          JSON.stringify({ legacyUserId: user.id, legacyUsername: user.username }),
        ],
      );

      await client.query(
        `
          INSERT INTO member (id, organization_id, user_id, role, created_at)
          VALUES ($1, $2, $3, 'owner', $4)
        `,
        [randomUUID(), organizationId, userId, user.createdAt],
      );

      if (user.password && user.isActive) {
        await client.query(
          `
            INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES ($1, $2, 'credential', $2, $3, $4, $4)
          `,
          [randomUUID(), userId, user.password, user.createdAt],
        );
      }
    }

    for (const [key, documents] of documentsByParticipation.entries()) {
      const [competitionIdText, userIdText] = key.split(':');
      const competitionId = parseInteger(competitionIdText);
      const userId = parseInteger(userIdText);
      const editionId = requireMapValue(editionIdByCompetition, competitionId, 'Edition ID');
      const participationId = requireMapValue(participationIdByKey, key, 'Participation ID');
      const user = data.users.find((candidate) => candidate.id === userId);
      const organizationId = requireMapValue(organizationIdByLegacyUser, userId, 'Organization ID');

      await client.query(
        `
          INSERT INTO participation (id, edition_id, university_id, team_name)
          VALUES ($1, $2, $3, null)
        `,
        [participationId, editionId, organizationId],
      );

      for (const template of templates) {
        const revisions = documents
          .sort((left, right) => left.id - right.id)
          .map((document) => ({ document, value: fieldValue(document, template.key) }))
          .filter((revision) => revision.value.length > 0);

        if (revisions.length === 0) {
          continue;
        }

        const templateId = requireMapValue(
          templateIdByCompetitionAndField,
          `${competitionId}:${template.key}`,
          'Submission template ID',
        );
        const submissionId = randomUUID();
        const submittedBy = requireMapValue(userIdByLegacyUser, userId, 'Submitted user ID');
        const latestVersion = revisions.length;

        const preparedRevisions = await Promise.all(
          revisions.map(async (revision, index) => {
            const version = index + 1;
            const payload: SubmissionPayload =
              template.acceptType === 'url'
                ? {
                    fileS3Key: null,
                    fileName: null,
                    fileSizeBytes: null,
                    fileMimeType: null,
                    url: toPublicUrl(revision.value),
                  }
                : await prepareLegacyFilePayload({
                    legacyPath: revision.value,
                    editionId,
                    participationId,
                    templateId,
                    version,
                    uploadJobs,
                    skipFiles,
                  });

            return {
              document: revision.document,
              payload,
              version,
            };
          }),
        );
        const latestPrepared = preparedRevisions[preparedRevisions.length - 1];

        if (!latestPrepared) {
          continue;
        }

        await client.query(
          `
            INSERT INTO submission (
              id,
              template_id,
              participation_id,
              submitted_by,
              version,
              file_s3_key,
              file_name,
              file_size_bytes,
              file_mime_type,
              url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            submissionId,
            templateId,
            participationId,
            submittedBy,
            latestVersion,
            ...toSubmissionPayloadValues(latestPrepared.payload),
          ],
        );

        for (const revision of preparedRevisions) {
          await client.query(
            `
              INSERT INTO submission_history (
                id,
                submission_id,
                version,
                submitted_by,
                file_s3_key,
                file_name,
                file_size_bytes,
                file_mime_type,
                url
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
              randomUUID(),
              submissionId,
              revision.version,
              user ? requireMapValue(userIdByLegacyUser, user.id, 'History user ID') : submittedBy,
              ...toSubmissionPayloadValues(revision.payload),
            ],
          );
        }
      }
    }

    await client.query('COMMIT');
    committed = true;

    if (uploadJobs.length > 0) {
      console.info(`Uploading ${uploadJobs.length} legacy files after database commit...`);
      for (const job of uploadJobs) {
        await uploadPreparedFile(job);
      }
    }

    console.info('Legacy docshare migration completed.');
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
};

await run();
