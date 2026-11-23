import { sql } from "drizzle-orm";

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { foodListings } from "./food-listings.js";

import {
  FOOD_REQUEST_STATUSES,
  FULFILLMENT_METHODS,
} from "./enums.js";

export const foodRequests = pgTable(
  "food_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Penerima yang mengajukan permintaan
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    // Listing makanan yang diminta
    listingId: uuid("listing_id")
      .notNull()
      .references(() => foodListings.id, {
        onDelete: "restrict",
      }),

    // Jumlah porsi yang diminta
    requestedPortions: integer("requested_portions").notNull(),

    // Metode pengambilan
    fulfillmentMethod: varchar("fulfillment_method", {
      length: 30,
    }),

    // Catatan penerima
    recipientNotes: text("recipient_notes"),

    // Status permintaan
    status: varchar("status", { length: 30 })
      .notNull()
      .default(FOOD_REQUEST_STATUSES.PENDING),

    // Alasan penolakan oleh donatur
    rejectionReason: text("rejection_reason"),

    // Timestamp perubahan status
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "food_requests_portions_positive",
      sql`${table.requestedPortions} > 0`,
    ),

   check(
  "food_requests_status_valid",
  sql`${table.status} IN (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED'
  )`,
),

check(
  "food_requests_fulfillment_method_valid",
  sql`${table.fulfillmentMethod} IS NULL OR ${table.fulfillmentMethod} IN (
    'SELF_PICKUP',
    'VOLUNTEER_DELIVERY'
  )`,
),
    index("food_requests_recipient_id_idx").on(table.recipientId),

    index("food_requests_listing_id_idx").on(table.listingId),

    index("food_requests_status_idx").on(table.status),

    index("food_requests_created_at_idx").on(table.createdAt),

    index("food_requests_recipient_status_idx").on(
      table.recipientId,
      table.status,
    ),

    index("food_requests_listing_status_idx").on(
      table.listingId,
      table.status,
    ),
  ],
);