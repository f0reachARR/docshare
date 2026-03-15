CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "is_admin" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "member_org_user_unique" ON "member"("organization_id", "user_id");

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "invited_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "competition_series" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "external_links" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "competition_edition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "series_id" uuid NOT NULL REFERENCES "competition_series"("id") ON DELETE CASCADE,
  "year" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "rule_documents" jsonb,
  "sharing_status" text NOT NULL DEFAULT 'draft',
  "external_links" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "competition_edition_series_year_idx" ON "competition_edition"("series_id", "year");

CREATE TABLE IF NOT EXISTS "participation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "edition_id" uuid NOT NULL REFERENCES "competition_edition"("id") ON DELETE CASCADE,
  "university_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "team_name" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "participation_edition_university_idx" ON "participation"("edition_id", "university_id");
CREATE UNIQUE INDEX IF NOT EXISTS "participation_unique" ON "participation"("edition_id", "university_id", "team_name");

CREATE TABLE IF NOT EXISTS "submission_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "edition_id" uuid NOT NULL REFERENCES "competition_edition"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "accept_type" text NOT NULL,
  "allowed_extensions" text[],
  "url_pattern" text,
  "max_file_size_mb" integer NOT NULL DEFAULT 100,
  "is_required" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "submission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" uuid NOT NULL REFERENCES "submission_template"("id") ON DELETE CASCADE,
  "participation_id" uuid NOT NULL REFERENCES "participation"("id") ON DELETE CASCADE,
  "submitted_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL DEFAULT 1,
  "file_s3_key" text,
  "file_name" text,
  "file_size_bytes" bigint,
  "file_mime_type" text,
  "url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "submission_template_participation_unique" ON "submission"("template_id", "participation_id");
CREATE INDEX IF NOT EXISTS "submission_participation_idx" ON "submission"("participation_id");

CREATE TABLE IF NOT EXISTS "submission_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "submission_id" uuid NOT NULL REFERENCES "submission"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "submitted_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "file_s3_key" text,
  "file_name" text,
  "file_size_bytes" bigint,
  "file_mime_type" text,
  "url" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "submission_history_submission_version_idx" ON "submission_history"("submission_id", "version");

CREATE TABLE IF NOT EXISTS "comment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "participation_id" uuid NOT NULL REFERENCES "participation"("id") ON DELETE CASCADE,
  "edition_id" uuid NOT NULL REFERENCES "competition_edition"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "comment_participation_deleted_idx" ON "comment"("participation_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "comment_edition_deleted_idx" ON "comment"("edition_id", "deleted_at");
