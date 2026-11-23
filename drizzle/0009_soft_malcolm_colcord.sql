CREATE TABLE "receiver_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiver_profile_id" uuid NOT NULL,
	"category_id" uuid,
	"required_portions" integer DEFAULT 1 NOT NULL,
	"special_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receiver_needs_required_portions_positive" CHECK ("receiver_needs"."required_portions" > 0)
);
--> statement-breakpoint
ALTER TABLE "receiver_needs" ADD CONSTRAINT "receiver_needs_receiver_profile_id_receiver_profiles_id_fk" FOREIGN KEY ("receiver_profile_id") REFERENCES "public"."receiver_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiver_needs" ADD CONSTRAINT "receiver_needs_category_id_food_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."food_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receiver_needs_profile_id_idx" ON "receiver_needs" USING btree ("receiver_profile_id");--> statement-breakpoint
CREATE INDEX "receiver_needs_category_id_idx" ON "receiver_needs" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "receiver_needs_active_idx" ON "receiver_needs" USING btree ("receiver_profile_id","is_active");