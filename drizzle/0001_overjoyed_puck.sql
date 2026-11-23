CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"region_type" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_id" uuid,
	"address" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"postal_code" varchar(20),
	"label" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"location_type" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_regions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regions_parent_id_idx" ON "regions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "regions_name_idx" ON "regions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "locations_region_id_idx" ON "locations" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_locations_user_location_unique" ON "user_locations" USING btree ("user_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_locations_single_default_unique" ON "user_locations" USING btree ("user_id") WHERE "user_locations"."is_default" = true;--> statement-breakpoint
CREATE INDEX "user_locations_user_id_idx" ON "user_locations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_locations_location_id_idx" ON "user_locations" USING btree ("location_id");--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_default_user_location_id_user_locations_id_fk" FOREIGN KEY ("default_user_location_id") REFERENCES "public"."user_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiver_profiles" ADD CONSTRAINT "receiver_profiles_default_user_location_id_user_locations_id_fk" FOREIGN KEY ("default_user_location_id") REFERENCES "public"."user_locations"("id") ON DELETE set null ON UPDATE no action;