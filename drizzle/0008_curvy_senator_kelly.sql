CREATE TABLE "food_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"request_id" uuid,
	"delivery_task_id" uuid,
	"type" varchar(30) NOT NULL,
	"description" text NOT NULL,
	"evidence_image_urls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_id" uuid,
	"resolution_notes" text,
	"reviewed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_reports_type_valid" CHECK ("food_reports"."type" IN (
        'UNSAFE_FOOD',
        'FOOD_QUALITY',
        'DELIVERY_ISSUE',
        'MISCONDUCT',
        'OTHER'
      )),
	CONSTRAINT "food_reports_status_valid" CHECK ("food_reports"."status" IN (
        'PENDING',
        'REVIEWING',
        'RESOLVED',
        'REJECTED'
      ))
);
--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_listing_id_food_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."food_listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_request_id_food_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."food_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_delivery_task_id_delivery_tasks_id_fk" FOREIGN KEY ("delivery_task_id") REFERENCES "public"."delivery_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_reports_reporter_id_idx" ON "food_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "food_reports_listing_id_idx" ON "food_reports" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "food_reports_request_id_idx" ON "food_reports" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "food_reports_delivery_task_id_idx" ON "food_reports" USING btree ("delivery_task_id");--> statement-breakpoint
CREATE INDEX "food_reports_status_idx" ON "food_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "food_reports_created_at_idx" ON "food_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "food_reports_reviewed_by_id_idx" ON "food_reports" USING btree ("reviewed_by_id");