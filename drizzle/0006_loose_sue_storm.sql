CREATE TABLE "delivery_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"volunteer_id" uuid,
	"status" varchar(30) DEFAULT 'OPEN' NOT NULL,
	"assigned_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_tasks_status_valid" CHECK ("delivery_tasks"."status" IN (
        'OPEN',
        'ASSIGNED',
        'PICKED_UP',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED'
      ))
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_task_id" uuid NOT NULL,
	"actor_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"previous_status" varchar(30),
	"new_status" varchar(30),
	"proof_image_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_requests" DROP CONSTRAINT "food_requests_status_valid";--> statement-breakpoint
ALTER TABLE "food_requests" DROP CONSTRAINT "food_requests_fulfillment_method_valid";--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_request_id_food_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."food_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_volunteer_id_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_delivery_task_id_delivery_tasks_id_fk" FOREIGN KEY ("delivery_task_id") REFERENCES "public"."delivery_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tasks_request_id_unique" ON "delivery_tasks" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_volunteer_id_idx" ON "delivery_tasks" USING btree ("volunteer_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_status_idx" ON "delivery_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_tasks_expires_at_idx" ON "delivery_tasks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "delivery_tasks_volunteer_status_idx" ON "delivery_tasks" USING btree ("volunteer_id","status");--> statement-breakpoint
CREATE INDEX "delivery_tasks_status_created_at_idx" ON "delivery_tasks" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "task_events_delivery_task_id_idx" ON "task_events" USING btree ("delivery_task_id");--> statement-breakpoint
CREATE INDEX "task_events_actor_id_idx" ON "task_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "task_events_created_at_idx" ON "task_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_events_task_created_at_idx" ON "task_events" USING btree ("delivery_task_id","created_at");--> statement-breakpoint
ALTER TABLE "food_requests" ADD CONSTRAINT "food_requests_status_valid" CHECK ("food_requests"."status" IN (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED'
  ));--> statement-breakpoint
ALTER TABLE "food_requests" ADD CONSTRAINT "food_requests_fulfillment_method_valid" CHECK ("food_requests"."fulfillment_method" IS NULL OR "food_requests"."fulfillment_method" IN (
    'SELF_PICKUP',
    'VOLUNTEER_DELIVERY'
  ));