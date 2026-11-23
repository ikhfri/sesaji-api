
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { roles } from "./roles.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),

    fullName: varchar("full_name", {
      length: 255,
    }).notNull(),

    email: varchar("email", {
      length: 255,
    }).notNull(),

    phoneNumber: varchar("phone_number", {
      length: 30,
    }),

    passwordHash: text("password_hash").notNull(),

    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
    }),

    phoneVerifiedAt: timestamp("phone_verified_at", {
      withTimezone: true,
    }),

    accountStatus: varchar("account_status", {
      length: 50,
    }).notNull().default("PENDING"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_phone_number_unique").on(table.phoneNumber),
  ],
);
