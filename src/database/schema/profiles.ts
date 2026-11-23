
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  real,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { userLocations } from "./user-locations.js";

export const donorProfiles = pgTable("donor_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),

  donorType: varchar("donor_type", {
    length: 50,
  }).notNull(),

  businessName: varchar("business_name", {
    length: 255,
  }),

  businessType: varchar("business_type", {
    length: 100,
  }),

  defaultUserLocationId: uuid("default_user_location_id")
  .references(() => userLocations.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }).defaultNow().notNull(),
});

export const receiverProfiles = pgTable(
  "receiver_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),

    institutionName: varchar("institution_name", {
      length: 255,
    }).notNull(),

    institutionType: varchar("institution_type", {
      length: 100,
    }).notNull(),

    description: text("description"),

    capacityPortions: integer("capacity_portions"),

    defaultUserLocationId: uuid("default_user_location_id")
  .references(() => userLocations.id, {
    onDelete: "set null",
  }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
);

export const volunteerProfiles = pgTable(
  "volunteer_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),

    vehicleType: varchar("vehicle_type", {
      length: 100,
    }),

    isAvailable: boolean("is_available")
      .notNull()
      .default(false),

    preferredRadiusKm: numeric("preferred_radius_km", {
      precision: 8,
      scale: 2,
    }),

    currentLatitude: real("current_latitude"),

    currentLongitude: real("current_longitude"),

    lastLocationAt: timestamp("last_location_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
);
