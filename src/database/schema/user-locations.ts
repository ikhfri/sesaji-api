
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { locations } from "./locations.js";
import { sql } from "drizzle-orm";

export const userLocations = pgTable(
  "user_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, {
        onDelete: "restrict",
      }),

    locationType: varchar("location_type", {
      length: 100,
    }).notNull(),

    isDefault: boolean("is_default")
      .notNull()
      .default(false),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_locations_user_location_unique")
      .on(table.userId, table.locationId),
    uniqueIndex("user_locations_single_default_unique")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
    index("user_locations_user_id_idx")
      .on(table.userId),

    index("user_locations_location_id_idx")
      .on(table.locationId),
  ],
);
