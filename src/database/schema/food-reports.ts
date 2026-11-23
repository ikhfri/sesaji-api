import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users.js";
import { foodListings } from "./food-listings.js";
import { foodRequests } from "./food-requests.js";
import { deliveryTasks } from "./delivery-tasks.js";

export const foodReports = pgTable(
  "food_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Pengguna yang membuat laporan.
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    // Listing yang dilaporkan.
    listingId: uuid("listing_id")
      .notNull()
      .references(() => foodListings.id, {
        onDelete: "restrict",
      }),

    // Opsional: konteks permintaan dan pengantaran.
    requestId: uuid("request_id").references(() => foodRequests.id, {
      onDelete: "set null",
    }),

    deliveryTaskId: uuid("delivery_task_id").references(
      () => deliveryTasks.id,
      {
        onDelete: "set null",
      },
    ),

    type: varchar("type", { length: 30 }).notNull(),

    description: text("description").notNull(),

    // URL bukti foto di object storage.
    evidenceImageUrls: text("evidence_image_urls")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    status: varchar("status", { length: 20 })
      .notNull()
      .default("PENDING"),

    // Admin yang menangani laporan.
    reviewedById: uuid("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),

    resolutionNotes: text("resolution_notes"),

    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
    }),

    resolvedAt: timestamp("resolved_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("food_reports_reporter_id_idx").on(table.reporterId),

    index("food_reports_listing_id_idx").on(table.listingId),

    index("food_reports_request_id_idx").on(table.requestId),

    index("food_reports_delivery_task_id_idx").on(
      table.deliveryTaskId,
    ),

    index("food_reports_status_idx").on(table.status),

    index("food_reports_created_at_idx").on(table.createdAt),

    index("food_reports_reviewed_by_id_idx").on(table.reviewedById),

    check(
      "food_reports_type_valid",
      sql`${table.type} IN (
        'UNSAFE_FOOD',
        'FOOD_QUALITY',
        'DELIVERY_ISSUE',
        'MISCONDUCT',
        'OTHER'
      )`,
    ),

    check(
      "food_reports_status_valid",
      sql`${table.status} IN (
        'PENDING',
        'REVIEWING',
        'RESOLVED',
        'REJECTED'
      )`,
    ),
  ],
);