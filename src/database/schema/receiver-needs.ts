import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { receiverProfiles } from "./profiles.js";
import { foodCategories } from "./food-categories.js";

export const receiverNeeds = pgTable(
  "receiver_needs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    receiverProfileId: uuid("receiver_profile_id")
      .notNull()
      .references(() => receiverProfiles.id, {
        onDelete: "cascade",
      }),

    // Null berarti penerima tidak membatasi kategori.
    categoryId: uuid("category_id").references(
      () => foodCategories.id,
      {
        onDelete: "set null",
      },
    ),

    // Jumlah porsi yang dibutuhkan.
    requiredPortions: integer("required_portions")
      .notNull()
      .default(1),

    // Contoh: HALAL, NO_PEANUT, CHILD_FRIENDLY.
    specialTags: text("special_tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    notes: text("notes"),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

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
    index("receiver_needs_profile_id_idx").on(
      table.receiverProfileId,
    ),

    index("receiver_needs_category_id_idx").on(
      table.categoryId,
    ),

    index("receiver_needs_active_idx").on(
      table.receiverProfileId,
      table.isActive,
    ),

    check(
      "receiver_needs_required_portions_positive",
      sql`${table.requiredPortions} > 0`,
    ),
  ],
);