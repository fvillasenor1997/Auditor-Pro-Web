import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { inventoriesTable } from "./inventories";

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id")
    .notNull()
    .references(() => inventoriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = typeof locationsTable.$inferInsert;
