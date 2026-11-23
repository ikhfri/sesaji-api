import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    type: varchar("type", { length: 50 }).notNull(),

    title: varchar("title", { length: 150 }).notNull(),

    body: text("body").notNull(),

    // Data tambahan untuk deep link / navigasi frontend.
    data: jsonb("data").$type<Record<string, unknown>>(),

    readAt: timestamp("read_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),

    index("notifications_user_read_idx").on(
      table.userId,
      table.readAt,
    ),

    index("notifications_created_at_idx").on(table.createdAt),

    check(
      "notifications_type_valid",
      sql`${table.type} IN (
        'NEW_FOOD_REQUEST',
        'REQUEST_APPROVED',
        'REQUEST_REJECTED',
        'NEW_DELIVERY_TASK',
        'DELIVERY_STATUS_UPDATED',
        'DONATION_COMPLETED',
        'LISTING_EXPIRING',
        'SYSTEM'
      )`,
    ),
  ],
);