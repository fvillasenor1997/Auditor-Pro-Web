import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { inventoriesTable } from "./inventories";
import { inventoryItemsTable } from "./inventoryItems";

export const countRecordsTable = pgTable("count_records", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id")
    .notNull()
    .references(() => inventoriesTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  location: text("location").notNull(),
  cantidad: integer("cantidad").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export type CountRecord = typeof countRecordsTable.$inferSelect;
export type InsertCountRecord = typeof countRecordsTable.$inferInsert;
