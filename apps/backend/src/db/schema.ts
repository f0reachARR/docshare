import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<'owner' | 'member'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberUnique: uniqueIndex('member_org_user_unique').on(table.organizationId, table.userId),
  }),
);

export const invitations = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').$type<'owner' | 'member'>().notNull(),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const competitionSeries = pgTable('competition_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  externalLinks: jsonb('external_links').$type<Array<{ label: string; url: string }>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const competitionEditions = pgTable(
  'competition_edition',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => competitionSeries.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    ruleDocuments:
      jsonb('rule_documents').$type<Array<{ label: string; s3_key: string; mime_type: string }>>(),
    sharingStatus: text('sharing_status')
      .$type<'draft' | 'accepting' | 'sharing' | 'closed'>()
      .notNull()
      .default('draft'),
    externalLinks: jsonb('external_links').$type<Array<{ label: string; url: string }>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    seriesYearIdx: index('competition_edition_series_year_idx').on(table.seriesId, table.year),
  }),
);

export const participations = pgTable(
  'participation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => competitionEditions.id, { onDelete: 'cascade' }),
    universityId: text('university_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    teamName: text('team_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    editionUniversityIdx: index('participation_edition_university_idx').on(
      table.editionId,
      table.universityId,
    ),
    editionUniversityTeamUnique: uniqueIndex('participation_unique').on(
      table.editionId,
      table.universityId,
      table.teamName,
    ),
  }),
);

export const submissionTemplates = pgTable('submission_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => competitionEditions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  acceptType: text('accept_type').$type<'file' | 'url'>().notNull(),
  allowedExtensions: text('allowed_extensions').array(),
  urlPattern: text('url_pattern'),
  maxFileSizeMb: integer('max_file_size_mb').notNull().default(100),
  isRequired: boolean('is_required').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  'submission',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => submissionTemplates.id, { onDelete: 'cascade' }),
    participationId: uuid('participation_id')
      .notNull()
      .references(() => participations.id, { onDelete: 'cascade' }),
    submittedBy: text('submitted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    version: integer('version').notNull().default(1),
    fileS3Key: text('file_s3_key'),
    fileName: text('file_name'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    fileMimeType: text('file_mime_type'),
    url: text('url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    templateParticipationUnique: uniqueIndex('submission_template_participation_unique').on(
      table.templateId,
      table.participationId,
    ),
    participationIdx: index('submission_participation_idx').on(table.participationId),
  }),
);

export const submissionHistories = pgTable(
  'submission_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    submittedBy: text('submitted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    fileS3Key: text('file_s3_key'),
    fileName: text('file_name'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    fileMimeType: text('file_mime_type'),
    url: text('url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    submissionVersionIdx: index('submission_history_submission_version_idx').on(
      table.submissionId,
      table.version,
    ),
  }),
);

export const comments = pgTable(
  'comment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participationId: uuid('participation_id')
      .notNull()
      .references(() => participations.id, { onDelete: 'cascade' }),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => competitionEditions.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    authorUniversityName: text('author_university_name'),
    authorTeamName: text('author_team_name'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    participationDeletedIdx: index('comment_participation_deleted_idx').on(
      table.participationId,
      table.deletedAt,
    ),
    editionDeletedIdx: index('comment_edition_deleted_idx').on(table.editionId, table.deletedAt),
  }),
);
