
import {
  pgTable,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => regions.id,
      { onDelete: "restrict" },
    ),
    name: varchar("name", {
      length: 255,
    }).notNull(),
    regionType: varchar("region_type", {
      length: 100,
    }).notNull(),
  },
  (table) => [
    index("regions_parent_id_idx").on(table.parentId),
    index("regions_name_idx").on(table.name),
  ],
);
