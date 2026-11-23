
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    verificationType: varchar("verification_type", {
      length: 100,
    }).notNull(),

    status: varchar("status", {
      length: 50,
    }).notNull().default("PENDING"),

    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    reviewedBy: uuid("reviewed_by")
      .references(() => users.id, {
        onDelete: "set null",
      }),

    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
    }),

    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("verifications_user_id_idx")
      .on(table.userId),

    index("verifications_status_idx")
      .on(table.status),

    index("verifications_reviewed_by_idx")
      .on(table.reviewedBy),
  ],
);

export const verificationDocuments = pgTable(
  "verification_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    verificationId: uuid("verification_id")
      .notNull()
      .references(() => verifications.id, {
        onDelete: "cascade",
      }),

    documentType: varchar("document_type", {
      length: 100,
    }).notNull(),

    fileUrl: text("file_url").notNull(),

    originalFilename: varchar("original_filename", {
      length: 255,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("verification_documents_verification_id_idx")
      .on(table.verificationId),
  ],
);
