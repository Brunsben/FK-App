CREATE TABLE "fw_fuehrerschein"."app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."consent_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"consent_type" text NOT NULL,
	"given" boolean DEFAULT false NOT NULL,
	"given_at" text,
	"withdrawn_at" text,
	"policy_version" text NOT NULL,
	"method" text DEFAULT 'web_form' NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."license_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"checked_by_user_id" text,
	"check_date" text NOT NULL,
	"check_type" text NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"next_check_due" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."license_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_expiring" boolean DEFAULT false NOT NULL,
	"default_check_interval_months" integer DEFAULT 6 NOT NULL,
	"default_validity_years" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "license_classes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."member_licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"license_class_id" text NOT NULL,
	"issue_date" text,
	"expiry_date" text,
	"check_interval_months" integer DEFAULT 6 NOT NULL,
	"notes" text,
	"restriction_188" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."notifications_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."uploaded_files" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"user_id" text NOT NULL,
	"file_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"side" text NOT NULL,
	"auto_delete_after" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fw_fuehrerschein"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"date_of_birth" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."license_checks" ADD CONSTRAINT "license_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."license_checks" ADD CONSTRAINT "license_checks_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."member_licenses" ADD CONSTRAINT "member_licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."member_licenses" ADD CONSTRAINT "member_licenses_license_class_id_license_classes_id_fk" FOREIGN KEY ("license_class_id") REFERENCES "fw_fuehrerschein"."license_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."notifications_log" ADD CONSTRAINT "notifications_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."uploaded_files" ADD CONSTRAINT "uploaded_files_check_id_license_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "fw_fuehrerschein"."license_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fw_fuehrerschein"."uploaded_files" ADD CONSTRAINT "uploaded_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fw_fuehrerschein"."users"("id") ON DELETE cascade ON UPDATE no action;