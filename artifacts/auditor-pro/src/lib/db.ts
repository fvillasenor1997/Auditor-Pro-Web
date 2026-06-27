import Dexie, { type Table } from "dexie";
import type { InventoryItem, InventoryWithItems } from "@workspace/api-client-react";

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

export interface LocalCountRecord {
  id?: number;
  inventoryId: number;
  itemId: number;
  username: string;
  location: string;
  cantidad: number;
  timestamp: number;
  synced?: boolean;
}

class AuditorDB extends Dexie {
  inventories!: Table<CachedInventory, number>;
  items!: Table<CachedItem, number>;
  pendingUpdates!: Table<PendingUpdate, number>;
  countRecords!: Table<LocalCountRecord, number>;
  pendingCountRecords!: Table<LocalCountRecord, number>;

  constructor() {
    super("AuditorProDB");
    this.version(1).stores({
      inventories: "id, name",
      items: "id, _inventoryId",
      pendingUpdates: "++id, inventoryId, itemId, timestamp",
    });
    this.version(2).stores({
      countRecords: "++id, itemId, inventoryId, username, timestamp",
      pendingCountRecords: "++id, inventoryId, itemId, timestamp",
    });
  }
}

export const auditorDB = new AuditorDB();

// ─── Inventory cache ───────────────────────────────────────────────────────────

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

// ─── Pending PATCH updates ─────────────────────────────────────────────────────

export async function queuePendingUpdate(
  inventoryId: number,
  itemId: number,
  cantidadFisica: number
): Promise<void> {
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

// ─── Count records ─────────────────────────────────────────────────────────────

export async function addLocalCountRecord(record: Omit<LocalCountRecord, "id">): Promise<number> {
  return auditorDB.countRecords.add({ ...record, synced: false });
}

export async function markCountRecordSynced(id: number): Promise<void> {
  await auditorDB.countRecords.update(id, { synced: true });
}

export async function getCountRecordsForItem(
  inventoryId: number,
  itemId: number
): Promise<LocalCountRecord[]> {
  return auditorDB.countRecords
    .where("itemId")
    .equals(itemId)
    .and((r) => r.inventoryId === inventoryId)
    .sortBy("timestamp");
}

// ─── Pending count records (offline queue) ─────────────────────────────────────

export async function queuePendingCountRecord(
  record: Omit<LocalCountRecord, "id">
): Promise<number> {
  return auditorDB.pendingCountRecords.add({ ...record });
}

export async function getPendingCountRecords(): Promise<LocalCountRecord[]> {
  return auditorDB.pendingCountRecords.orderBy("timestamp").toArray();
}

export async function removePendingCountRecord(id: number): Promise<void> {
  await auditorDB.pendingCountRecords.delete(id);
}
