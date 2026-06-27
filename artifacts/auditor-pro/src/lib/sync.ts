import {
  getPendingUpdates,
  removePendingUpdate,
  queuePendingUpdate,
  updateLocalItem,
} from "./db";

const BASE = import.meta.env.BASE_URL;

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidadFisica: update.cantidadFisica }),
        }
      );

      if (res.ok && update.id !== undefined) {
        await removePendingUpdate(update.id);
        remaining--;
        onProgress?.(remaining);
      }
    } catch {
      // Still offline, stop trying
      break;
    }
  }
}

export async function syncItemUpdate(
  inventoryId: number,
  itemId: number,
  cantidadFisica: number
): Promise<"synced" | "queued"> {
  // Always update IndexedDB first (offline-first principle)
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidadFisica }),
      }
    );

    if (!res.ok) throw new Error("API error");
    return "synced";
  } catch {
    // Network error while supposedly online — queue it
    await queuePendingUpdate(inventoryId, itemId, cantidadFisica);
    return "queued";
  }
}

export async function fetchAndCacheInventory(inventoryId: number) {
  const res = await fetch(`${BASE}api/inventories/${inventoryId}`);
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}
