
CREATE TABLE "food_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "recipient_id" uuid NOT NULL,
    "listing_id" uuid NOT NULL,
    "requested_portions" integer NOT NULL,
    "fulfillment_method" varchar(30),
    "recipient_notes" text,
    "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
    "rejection_reason" text,
    "responded_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "food_requests_portions_positive"
        CHECK ("food_requests"."requested_portions" > 0),

    CONSTRAINT "food_requests_status_valid"
        CHECK ("food_requests"."status" IN (
            'PENDING',
            'APPROVED',
            'REJECTED',
            'CANCELLED',
            'EXPIRED',
            'IN_PROGRESS',
            'COMPLETED',
            'FAILED'
        )),

    CONSTRAINT "food_requests_fulfillment_method_valid"
        CHECK (
            "food_requests"."fulfillment_method" IS NULL
            OR "food_requests"."fulfillment_method" IN (
                'SELF_PICKUP',
                'VOLUNTEER_DELIVERY'
            )
        )
);

--> statement-breakpoint

CREATE TABLE "pickup_schedules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "request_id" uuid NOT NULL,
    "scheduled_start_at" timestamp with time zone NOT NULL,
    "scheduled_end_at" timestamp with time zone NOT NULL,
    "handover_code" varchar(4),
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "pickup_schedules_valid_time_range"
        CHECK (
            "pickup_schedules"."scheduled_end_at"
            > "pickup_schedules"."scheduled_start_at"
        ),

    CONSTRAINT "pickup_schedules_handover_code_valid"
        CHECK (
            "pickup_schedules"."handover_code" IS NULL
            OR "pickup_schedules"."handover_code" ~ '^[0-9]{4}$'
        )
);

--> statement-breakpoint

ALTER TABLE "food_requests"
    ADD CONSTRAINT "food_requests_recipient_id_users_id_fk"
    FOREIGN KEY ("recipient_id")
    REFERENCES "public"."users"("id")
    ON DELETE restrict
    ON UPDATE no action;

--> statement-breakpoint

ALTER TABLE "food_requests"
    ADD CONSTRAINT "food_requests_listing_id_food_listings_id_fk"
    FOREIGN KEY ("listing_id")
    REFERENCES "public"."food_listings"("id")
    ON DELETE restrict
    ON UPDATE no action;

--> statement-breakpoint

ALTER TABLE "pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_request_id_food_requests_id_fk"
    FOREIGN KEY ("request_id")
    REFERENCES "public"."food_requests"("id")
    ON DELETE cascade
    ON UPDATE no action;

--> statement-breakpoint

CREATE INDEX "food_requests_recipient_id_idx"
    ON "food_requests" USING btree ("recipient_id");

--> statement-breakpoint

CREATE INDEX "food_requests_listing_id_idx"
    ON "food_requests" USING btree ("listing_id");

--> statement-breakpoint

CREATE INDEX "food_requests_status_idx"
    ON "food_requests" USING btree ("status");

--> statement-breakpoint

CREATE INDEX "food_requests_created_at_idx"
    ON "food_requests" USING btree ("created_at");

--> statement-breakpoint

CREATE INDEX "food_requests_recipient_status_idx"
    ON "food_requests" USING btree ("recipient_id", "status");

--> statement-breakpoint

CREATE INDEX "food_requests_listing_status_idx"
    ON "food_requests" USING btree ("listing_id", "status");

--> statement-breakpoint

CREATE UNIQUE INDEX "pickup_schedules_request_id_unique"
    ON "pickup_schedules" USING btree ("request_id");

--> statement-breakpoint

CREATE INDEX "pickup_schedules_start_at_idx"
    ON "pickup_schedules" USING btree ("scheduled_start_at");
