import Dexie, { type Table } from "dexie";
import type { InventoryItem, InventoryWithItems, Inventory } from "@workspace/api-client-react";

export interface PendingUpdate {
  id?: number;
  inventoryId: number;
  itemId: number;
  cantidadFisica: number;
  timestamp: number;
}

export interface CachedInventory {
  id: number;
  name: string;
  location: string;
  date: string;
  createdAt: string;
  cachedAt: number;
}

export interface CachedItem extends InventoryItem {
  _inventoryId: number;
}

class AuditorDB extends Dexie {
  inventories!: Table<CachedInventory, number>;
  items!: Table<CachedItem, number>;
  pendingUpdates!: Table<PendingUpdate, number>;

  constructor() {
    super("AuditorProDB");
    this.version(1).stores({
      inventories: "id, name",
      items: "id, _inventoryId",
      pendingUpdates: "++id, inventoryId, itemId, timestamp",
    });
  }
}

export const auditorDB = new AuditorDB();

export async function cacheInventory(inv: InventoryWithItems): Promise<void> {
  await auditorDB.inventories.put({
    id: inv.id,
    name: inv.name,
    location: inv.location,
    date: inv.date,
    createdAt: inv.createdAt,
    cachedAt: Date.now(),
  });

  if (inv.items.length > 0) {
    await auditorDB.items.bulkPut(
      inv.items.map((item) => ({ ...item, _inventoryId: inv.id }))
    );
  }
}

export async function getCachedItems(inventoryId: number): Promise<CachedItem[]> {
  return auditorDB.items.where("_inventoryId").equals(inventoryId).toArray();
}

export async function updateLocalItem(
  inventoryId: number,
  itemId: number,
  cantidadFisica: number
): Promise<void> {
  await auditorDB.items.update(itemId, { cantidadFisica });
}

export async function queuePendingUpdate(
  inventoryId: number,
  itemId: number,
  cantidadFisica: number
): Promise<void> {
  // Replace any existing pending update for this item (only latest value matters)
  const existing = await auditorDB.pendingUpdates
    .where("itemId")
    .equals(itemId)
    .and((u) => u.inventoryId === inventoryId)
    .first();

  if (existing?.id !== undefined) {
    await auditorDB.pendingUpdates.update(existing.id, {
      cantidadFisica,
      timestamp: Date.now(),
    });
  } else {
    await auditorDB.pendingUpdates.add({
      inventoryId,
      itemId,
      cantidadFisica,
      timestamp: Date.now(),
    });
  }
}

export async function getPendingUpdates(): Promise<PendingUpdate[]> {
  return auditorDB.pendingUpdates.orderBy("timestamp").toArray();
}

export async function removePendingUpdate(id: number): Promise<void> {
  await auditorDB.pendingUpdates.delete(id);
}

export async function getPendingCount(inventoryId: number): Promise<number> {
  return auditorDB.pendingUpdates
    .where("inventoryId")
    .equals(inventoryId)
    .count();
}
