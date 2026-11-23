import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { deliveryTasks } from "./delivery-tasks.js";

export const taskEvents = pgTable(
  "task_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    deliveryTaskId: uuid("delivery_task_id")
      .notNull()
      .references(() => deliveryTasks.id, {
        onDelete: "cascade",
      }),

    // Null jika perubahan dilakukan oleh sistem.
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),

    eventType: varchar("event_type", {
      length: 50,
    }).notNull(),

    previousStatus: varchar("previous_status", {
      length: 30,
    }),

    newStatus: varchar("new_status", {
      length: 30,
    }),

    // URL foto bukti pickup atau penyerahan.
    proofImageUrl: text("proof_image_url"),

    notes: text("notes"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("task_events_delivery_task_id_idx").on(
      table.deliveryTaskId,
    ),

    index("task_events_actor_id_idx").on(
      table.actorId,
    ),

    index("task_events_created_at_idx").on(
      table.createdAt,
    ),

    index("task_events_task_created_at_idx").on(
      table.deliveryTaskId,
      table.createdAt,
    ),
  ],
);