import { useState, useEffect, useCallback, useRef } from "react";
import type { InventoryItem, InventoryWithItems } from "@workspace/api-client-react";
import {
  cacheInventory,
  getCachedItems,
  getPendingCount,
  type CachedItem,
} from "@/lib/db";
import { syncItemUpdate, fetchAndCacheInventory, flushPendingUpdates, flushPendingCountRecords } from "@/lib/sync";

export type SyncStatus = "loading" | "online" | "offline" | "syncing" | "error";

interface UseInventorySyncResult {
  items: CachedItem[];
  inventory: InventoryWithItems | null;
  status: SyncStatus;
  pendingCount: number;
  updateCount: (item: CachedItem, delta: number) => Promise<void>;
  forceSync: () => Promise<void>;
}

export function useInventorySync(inventoryId: number): UseInventorySyncResult {
  const [items, setItems] = useState<CachedItem[]>([]);
  const [inventory, setInventory] = useState<InventoryWithItems | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount(inventoryId);
    setPendingCount(count);
  }, [inventoryId]);

  // Load data: IndexedDB first, then fetch from API in background
  useEffect(() => {
    if (isNaN(inventoryId)) return;

    let cancelled = false;

    async function load() {
      setStatus("loading");

      // Step 1: Load from IndexedDB immediately (instant UX)
      const cached = await getCachedItems(inventoryId);
      if (!cancelled && cached.length > 0) {
        setItems(cached);
        setStatus(navigator.onLine ? "online" : "offline");
      }

      // Step 2: Fetch fresh data from API in background
      if (navigator.onLine) {
        try {
          const fresh: InventoryWithItems = await fetchAndCacheInventory(inventoryId);
          if (!cancelled) {
            await cacheInventory(fresh);
            // Merge: keep local cantidadFisica for any pending items
            const pending = await getCachedItems(inventoryId);
            setInventory(fresh);
            setItems(pending.length > 0 ? pending : fresh.items.map((i) => ({ ...i, _inventoryId: inventoryId })));
            setStatus("online");
          }
        } catch {
          if (!cancelled) {
            if (cached.length === 0) setStatus("error");
            else setStatus("offline");
          }
        }
      } else {
        if (!cancelled) {
          if (cached.length === 0) setStatus("error");
          else setStatus("offline");
        }
      }

      if (!cancelled) await refreshPendingCount();
    }

    load();
    return () => { cancelled = true; };
  }, [inventoryId, refreshPendingCount]);

  // Flush pending updates when coming back online
  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setStatus("syncing");

    try {
      await flushPendingCountRecords();
      await flushPendingUpdates(async (remaining) => {
        setPendingCount(remaining);
      });
      await refreshPendingCount();
      setStatus("online");
    } catch {
      setStatus("online");
    } finally {
      flushingRef.current = false;
    }
  }, [refreshPendingCount]);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setStatus("syncing");
      flushQueue();
    };
    const handleOffline = () => {
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueue]);

  // Update count: IndexedDB first, then sync
  const updateCount = useCallback(
    async (item: CachedItem, delta: number) => {
      const newCount = Math.max(0, item.cantidadFisica + delta);

      // Optimistic UI update immediately
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, cantidadFisica: newCount } : i))
      );

      const result = await syncItemUpdate(inventoryId, item.id, newCount);
      if (result === "queued") {
        await refreshPendingCount();
      }
    },
    [inventoryId, refreshPendingCount]
  );

  const forceSync = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueue();
  }, [flushQueue]);

  return { items, inventory, status, pendingCount, updateCount, forceSync };
}
