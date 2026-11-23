
CREATE VIEW "public"."donation_histories" AS
SELECT
    fr."id" AS "request_id",
    fl."id" AS "listing_id",
    fl."name" AS "food_name",
    fc."name" AS "category_name",

    donor."id" AS "donor_id",
    donor."full_name" AS "donor_name",
    dp."donor_type" AS "donor_type",
    dp."business_name" AS "business_name",

    recipient."id" AS "recipient_id",
    recipient."full_name" AS "recipient_name",
    rp."institution_name" AS "institution_name",
    rp."institution_type" AS "institution_type",

    fr."requested_portions" AS "requested_portions",
    fr."fulfillment_method" AS "fulfillment_method",
    fr."status" AS "request_status",

    ps."scheduled_start_at" AS "scheduled_start_at",
    ps."scheduled_end_at" AS "scheduled_end_at",

    dt."id" AS "delivery_task_id",
    volunteer."id" AS "volunteer_id",
    volunteer."full_name" AS "volunteer_name",
    dt."status" AS "delivery_task_status",

    fr."created_at" AS "requested_at",
    fr."responded_at" AS "responded_at",
    fr."completed_at" AS "completed_at"

FROM "food_requests" fr
INNER JOIN "food_listings" fl
    ON fr."listing_id" = fl."id"
INNER JOIN "users" donor
    ON fl."donor_id" = donor."id"
INNER JOIN "users" recipient
    ON fr."recipient_id" = recipient."id"
LEFT JOIN "donor_profiles" dp
    ON dp."user_id" = donor."id"
LEFT JOIN "receiver_profiles" rp
    ON rp."user_id" = recipient."id"
LEFT JOIN "food_categories" fc
    ON fc."id" = fl."category_id"
LEFT JOIN "pickup_schedules" ps
    ON ps."request_id" = fr."id"
LEFT JOIN "delivery_tasks" dt
    ON dt."request_id" = fr."id"
LEFT JOIN "users" volunteer
    ON dt."volunteer_id" = volunteer."id";
