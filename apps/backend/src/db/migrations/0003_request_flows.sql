CREATE TABLE "university_creation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"university_name" text NOT NULL,
	"representative_email" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_organization_id" text,
	"created_invitation_id" text,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"university_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"team_name" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_participation_id" uuid,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "university_creation_request" ADD CONSTRAINT "university_creation_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "university_creation_request" ADD CONSTRAINT "university_creation_request_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "university_creation_request" ADD CONSTRAINT "university_creation_request_created_organization_id_organization_id_fk" FOREIGN KEY ("created_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "university_creation_request" ADD CONSTRAINT "university_creation_request_created_invitation_id_invitation_id_fk" FOREIGN KEY ("created_invitation_id") REFERENCES "public"."invitation"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participation_request" ADD CONSTRAINT "participation_request_edition_id_competition_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."competition_edition"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participation_request" ADD CONSTRAINT "participation_request_university_id_organization_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participation_request" ADD CONSTRAINT "participation_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participation_request" ADD CONSTRAINT "participation_request_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participation_request" ADD CONSTRAINT "participation_request_created_participation_id_participation_id_fk" FOREIGN KEY ("created_participation_id") REFERENCES "public"."participation"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "university_creation_request_requested_by_idx" ON "university_creation_request" USING btree ("requested_by_user_id");
--> statement-breakpoint
CREATE INDEX "university_creation_request_status_created_at_idx" ON "university_creation_request" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "participation_request_edition_university_idx" ON "participation_request" USING btree ("edition_id","university_id");
--> statement-breakpoint
CREATE INDEX "participation_request_requested_by_idx" ON "participation_request" USING btree ("requested_by_user_id");
--> statement-breakpoint
CREATE INDEX "participation_request_status_created_at_idx" ON "participation_request" USING btree ("status","created_at");
