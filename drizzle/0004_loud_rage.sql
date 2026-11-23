CREATE TABLE "food_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "food_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "food_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"total_portions" integer NOT NULL,
	"available_portions" integer NOT NULL,
	"is_halal" boolean DEFAULT false NOT NULL,
	"is_vegetarian" boolean DEFAULT false NOT NULL,
	"allergens" text[] DEFAULT '{}' NOT NULL,
	"produced_at" timestamp with time zone NOT NULL,
	"storage_instructions" text NOT NULL,
	"pickup_deadline" timestamp with time zone NOT NULL,
	"notes" text,
	"status" varchar(30) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "food_listings_total_portions_positive" CHECK ("food_listings"."total_portions" > 0),
	CONSTRAINT "food_listings_available_portions_non_negative" CHECK ("food_listings"."available_portions" >= 0),
	CONSTRAINT "food_listings_available_not_exceed_total" CHECK ("food_listings"."available_portions" <= "food_listings"."total_portions"),
	CONSTRAINT "food_listings_pickup_after_production" CHECK ("food_listings"."pickup_deadline" > "food_listings"."produced_at")
);
--> statement-breakpoint
CREATE TABLE "food_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"original_filename" varchar(255),
	"alt_text" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_listings" ADD CONSTRAINT "food_listings_donor_id_users_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_listings" ADD CONSTRAINT "food_listings_category_id_food_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."food_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_listings" ADD CONSTRAINT "food_listings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_images" ADD CONSTRAINT "food_images_listing_id_food_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."food_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_categories_is_active_idx" ON "food_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "food_listings_donor_id_idx" ON "food_listings" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "food_listings_category_id_idx" ON "food_listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "food_listings_location_id_idx" ON "food_listings" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "food_listings_status_idx" ON "food_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "food_listings_pickup_deadline_idx" ON "food_listings" USING btree ("pickup_deadline");--> statement-breakpoint
CREATE INDEX "food_listings_created_at_idx" ON "food_listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "food_listings_explore_idx" ON "food_listings" USING btree ("status","category_id","pickup_deadline");--> statement-breakpoint
CREATE INDEX "food_images_listing_id_idx" ON "food_images" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "food_images_sort_order_idx" ON "food_images" USING btree ("listing_id","sort_order");