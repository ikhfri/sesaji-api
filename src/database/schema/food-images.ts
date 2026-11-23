import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { foodListings } from "./food-listings.js";

export const foodImages = pgTable(
  "food_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    listingId: uuid("listing_id")
      .notNull()
      .references(() => foodListings.id, {
        onDelete: "cascade",
      }),

    fileUrl: text("file_url").notNull(),

    originalFilename: varchar("original_filename", {
      length: 255,
    }),

    altText: varchar("alt_text", {
      length: 255,
    }),

    isPrimary: boolean("is_primary").notNull().default(false),

    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("food_images_listing_id_idx").on(table.listingId),

    index("food_images_sort_order_idx").on(
      table.listingId,
      table.sortOrder,
    ),
  ],
);