import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { inventoriesTable } from "./inventories";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id")
    .notNull()
    .references(() => inventoriesTable.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  descripcion: text("descripcion").notNull(),
  categoria: text("categoria").notNull(),
  cantidadTeorica: integer("cantidad_teorica").notNull(),
  cantidadFisica: integer("cantidad_fisica").default(0).notNull(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
