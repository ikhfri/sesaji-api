import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users.js";
import { foodRequests } from "./food-requests.js";

export const deliveryTasks = pgTable(
  "delivery_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Satu delivery task untuk satu food request.
    requestId: uuid("request_id")
      .notNull()
      .references(() => foodRequests.id, {
        onDelete: "cascade",
      }),

    // Null selama belum ada volunteer yang mengambil task.
    volunteerId: uuid("volunteer_id").references(() => users.id, {
      onDelete: "set null",
    }),

    status: varchar("status", { length: 30 })
      .notNull()
      .default("OPEN"),

    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
    }),

    pickedUpAt: timestamp("picked_up_at", {
      withTimezone: true,
    }),

    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }),

    cancellationReason: text("cancellation_reason"),

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
    uniqueIndex("delivery_tasks_request_id_unique").on(
      table.requestId,
    ),

    index("delivery_tasks_volunteer_id_idx").on(
      table.volunteerId,
    ),

    index("delivery_tasks_status_idx").on(
      table.status,
    ),

    index("delivery_tasks_expires_at_idx").on(
      table.expiresAt,
    ),

    index("delivery_tasks_volunteer_status_idx").on(
      table.volunteerId,
      table.status,
    ),

    index("delivery_tasks_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),

    check(
      "delivery_tasks_status_valid",
      sql`${table.status} IN (
        'OPEN',
        'ASSIGNED',
        'PICKED_UP',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED'
      )`,
    ),
  ],
);