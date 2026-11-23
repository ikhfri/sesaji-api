
import {
  pgTable,
  uuid,
  text,
  varchar,
  real,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { regions } from "./regions.js";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    regionId: uuid("region_id").references(
      () => regions.id,
      { onDelete: "set null" },
    ),

    address: text("address").notNull(),

    latitude: real("latitude").notNull(),

    longitude: real("longitude").notNull(),

    postalCode: varchar("postal_code", {
      length: 20,
    }),

    label: varchar("label", {
      length: 100,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("locations_region_id_idx").on(table.regionId),
  ],
);
