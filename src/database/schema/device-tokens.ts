import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users.js";

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    // FCM registration token.
    token: varchar("token", { length: 512 }).notNull(),

    platform: varchar("platform", { length: 20 }).notNull(),

    // Opsional: identitas perangkat dari aplikasi.
    deviceId: varchar("device_id", { length: 255 }),

    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    revokedAt: timestamp("revoked_at", {
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
    // Satu token FCM hanya boleh dimiliki satu record.
    uniqueIndex("device_tokens_token_unique").on(table.token),

    index("device_tokens_user_id_idx").on(table.userId),

    index("device_tokens_user_active_idx").on(
      table.userId,
      table.revokedAt,
    ),

    check(
      "device_tokens_platform_valid",
      sql`${table.platform} IN ('ANDROID', 'WEB')`,
    ),
  ],
);