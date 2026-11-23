
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    refreshTokenHash: text("refresh_token_hash")
      .notNull(),
    previousRefreshTokenHash: text("previous_refresh_token_hash"),
    userAgent: text("user_agent"),

    ipAddress: varchar("ip_address", {
      length: 45,
    }),

    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
    }),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_refresh_token_hash_unique")
      .on(table.refreshTokenHash),

    index("auth_sessions_user_id_idx")
      .on(table.userId),

    index("auth_sessions_expires_at_idx")
      .on(table.expiresAt),
  ],
);
