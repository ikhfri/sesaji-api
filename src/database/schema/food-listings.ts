import { sql } from "drizzle-orm";

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { locations } from "./locations.js";
import { foodCategories } from "./food-categories.js";

export const foodListings = pgTable(
  "food_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Donatur pemilik listing
    donorId: uuid("donor_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    // Kategori makanan
    categoryId: uuid("category_id")
      .notNull()
      .references(() => foodCategories.id, {
        onDelete: "restrict",
      }),

    // Lokasi pickup
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, {
        onDelete: "restrict",
      }),

    // Informasi makanan
    name: varchar("name", { length: 150 }).notNull(),

    description: text("description"),

    // Informasi stok
    totalPortions: integer("total_portions").notNull(),

    availablePortions: integer("available_portions").notNull(),

    // Label dan keamanan pangan
    isHalal: boolean("is_halal").notNull().default(false),

    isVegetarian: boolean("is_vegetarian").notNull().default(false),

    allergens: text("allergens").array().notNull().default([]),

    // Informasi produksi dan penyimpanan
    producedAt: timestamp("produced_at", {
      withTimezone: true,
    }).notNull(),

    storageInstructions: text("storage_instructions").notNull(),

    // Batas pengambilan
    pickupDeadline: timestamp("pickup_deadline", {
      withTimezone: true,
    }).notNull(),

    // Catatan tambahan
    notes: text("notes"),

    // Status listing
    status: varchar("status", { length: 30 })
      .notNull()
      .default("ACTIVE"),

    // Waktu listing
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

    closedAt: timestamp("closed_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    // Validasi stok
    check(
      "food_listings_total_portions_positive",
      sql`${table.totalPortions} > 0`,
    ),

    check(
      "food_listings_available_portions_non_negative",
      sql`${table.availablePortions} >= 0`,
    ),

    check(
      "food_listings_available_not_exceed_total",
      sql`${table.availablePortions} <= ${table.totalPortions}`,
    ),

    // Validasi waktu
    check(
      "food_listings_pickup_after_production",
      sql`${table.pickupDeadline} > ${table.producedAt}`,
    ),

    // Index pencarian dan filtering
    index("food_listings_donor_id_idx").on(table.donorId),

    index("food_listings_category_id_idx").on(table.categoryId),

    index("food_listings_location_id_idx").on(table.locationId),

    index("food_listings_status_idx").on(table.status),

    index("food_listings_pickup_deadline_idx").on(table.pickupDeadline),

    index("food_listings_created_at_idx").on(table.createdAt),

    index("food_listings_explore_idx").on(
      table.status,
      table.categoryId,
      table.pickupDeadline,
    ),
  ],
);