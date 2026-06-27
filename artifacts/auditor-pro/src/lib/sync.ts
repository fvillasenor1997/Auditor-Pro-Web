import {
  getPendingUpdates,
  removePendingUpdate,
  queuePendingUpdate,
  updateLocalItem,
  getPendingCountRecords,
  removePendingCountRecord,
  queuePendingCountRecord,
  addLocalCountRecord,
  markCountRecordSynced,
  type LocalCountRecord,
} from "./db";
import { authHeaders } from "./auth";

const BASE = import.meta.env.BASE_URL;

// ─── PATCH pending updates (cantidadFisica) ───────────────────────────────────

export async function flushPendingUpdates(
  onProgress?: (remaining: number) => void
): Promise<void> {
  const updates = await getPendingUpdates();
  let remaining = updates.length;

  for (const update of updates) {
    try {
      const res = await fetch(
        `${BASE}api/inventories/${update.inventoryId}/items/${update.itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ cantidadFisica: update.cantidadFisica }),
        }
      );
      if (res.ok && update.id !== undefined) {
        await removePendingUpdate(update.id);
        remaining--;
        onProgress?.(remaining);
      }
    } catch {
      break;
    }
  }
}

export async function syncItemUpdate(
  inventoryId: number,
  itemId: number,
  cantidadFisica: number
): Promise<"synced" | "queued"> {
  await updateLocalItem(inventoryId, itemId, cantidadFisica);

  if (!navigator.onLine) {
    await queuePendingUpdate(inventoryId, itemId, cantidadFisica);
    return "queued";
  }

  try {
    const res = await fetch(
      `${BASE}api/inventories/${inventoryId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cantidadFisica }),
      }
    );
    if (!res.ok) throw new Error("API error");
    return "synced";
  } catch {
    await queuePendingUpdate(inventoryId, itemId, cantidadFisica);
    return "queued";
  }
}

export async function fetchAndCacheInventory(inventoryId: number) {
  const res = await fetch(`${BASE}api/inventories/${inventoryId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}

// ─── Count records ─────────────────────────────────────────────────────────────

export interface SyncCountResult {
  status: "synced" | "queued";
  serverId?: number;
  localId: number;
}

export async function syncCountRecord(
  record: Omit<LocalCountRecord, "id" | "synced">
): Promise<SyncCountResult> {
  const localId = await addLocalCountRecord(record);

  if (!navigator.onLine) {
    await queuePendingCountRecord(record);
    return { status: "queued", localId };
  }

  try {
    const res = await fetch(
      `${BASE}api/inventories/${record.inventoryId}/items/${record.itemId}/records`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          username: record.username,
          location: record.location,
          cantidad: record.cantidad,
          timestamp: new Date(record.timestamp).toISOString(),
        }),
      }
    );
    if (!res.ok) throw new Error("API error");
    const data = await res.json() as { id: number };
    await markCountRecordSynced(localId);
    return { status: "synced", serverId: data.id, localId };
  } catch {
    await queuePendingCountRecord(record);
    return { status: "queued", localId };
  }
}

export async function deleteCountRecord(
  inventoryId: number,
  itemId: number,
  serverId: number
): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE}api/inventories/${inventoryId}/items/${itemId}/records/${serverId}`,
      { method: "DELETE", headers: authHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function editCountRecord(
  inventoryId: number,
  itemId: number,
  serverId: number,
  cantidad: number
): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE}api/inventories/${inventoryId}/items/${itemId}/records/${serverId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cantidad }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function flushPendingCountRecords(): Promise<void> {
  const records = await getPendingCountRecords();
  for (const record of records) {
    try {
      const res = await fetch(
        `${BASE}api/inventories/${record.inventoryId}/items/${record.itemId}/records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            username: record.username,
            location: record.location,
            cantidad: record.cantidad,
            timestamp: new Date(record.timestamp).toISOString(),
          }),
        }
      );
      if (res.ok && record.id !== undefined) {
        await removePendingCountRecord(record.id);
      }
    } catch {
      break;
    }
  }
}
