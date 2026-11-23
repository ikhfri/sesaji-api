import { sql } from "drizzle-orm";

import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  check,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { foodRequests } from "./food-requests.js";

export const pickupSchedules = pgTable(
  "pickup_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Satu jadwal untuk satu permintaan
    requestId: uuid("request_id")
      .notNull()
      .references(() => foodRequests.id, {
        onDelete: "cascade",
      }),

    // Jendela waktu pengambilan
    scheduledStartAt: timestamp("scheduled_start_at", {
      withTimezone: true,
    }).notNull(),

    scheduledEndAt: timestamp("scheduled_end_at", {
      withTimezone: true,
    }).notNull(),

    // Kode serah-terima 4 digit (P1)
    handoverCode: varchar("handover_code", {
      length: 4,
    }),

    // Catatan jadwal
    notes: text("notes"),

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
    uniqueIndex("pickup_schedules_request_id_unique").on(
      table.requestId,
    ),

    check(
      "pickup_schedules_valid_time_range",
      sql`${table.scheduledEndAt} > ${table.scheduledStartAt}`,
    ),

    check(
      "pickup_schedules_handover_code_valid",
      sql`${table.handoverCode} IS NULL OR ${table.handoverCode} ~ '^[0-9]{4}$'`,
    ),

    index("pickup_schedules_start_at_idx").on(
      table.scheduledStartAt,
    ),
  ],
);