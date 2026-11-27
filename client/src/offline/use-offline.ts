import { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  offlineDb,
  type CachedCustomer,
  type CachedProduct,
  type OfflineOrder,
} from "./db";
import {
  subscribeToSync,
  isOutboxSyncing,
  processOutbox,
  refreshMasterDataSnapshot,
  queueOfflineOrder,
  retryOfflineOrder,
  removeOfflineOrder,
  clearSyncedOrders,
} from "./sync-engine";
import type { SyncState } from "@/components/shell/use-connection-status";

function subscribeOnline(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);
}

export function useOfflineCustomers(organizationId?: string) {
  return useLiveQuery(
    async () => {
      if (!organizationId) {
        return await offlineDb.customers.toArray();
      }
      return await offlineDb.customers
        .filter((c) => c.organizationId === organizationId)
        .toArray();
    },
    [organizationId],
    [] as CachedCustomer[],
  );
}

export function useOfflineProducts(organizationId?: string) {
  return useLiveQuery(
    async () => {
      if (!organizationId) {
        return await offlineDb.products.toArray();
      }
      return await offlineDb.products
        .filter((p) => !p.organizationId || p.organizationId === organizationId)
        .toArray();
    },
    [organizationId],
    [] as CachedProduct[],
  );
}

export function useOutboxOrders(userId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [];
      return await offlineDb.outbox
        .where("userId")
        .equals(userId)
        .reverse()
        .sortBy("createdAt");
    },
    [userId],
    [] as OfflineOrder[],
  );
}

const activeSyncIntervals = new Map<
  string,
  { count: number; intervalId: ReturnType<typeof setInterval> }
>();

export function useSyncManager(userId?: string) {
  const isOnline = useIsOnline();
  const [, setTick] = useState(0);

  // Subscribe to sync engine events
  useEffect(() => {
    return subscribeToSync(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Coordinate a single background sync + 5-min snapshot refresh per active userId across all hook consumers (F-077)
  useEffect(() => {
    if (!isOnline || !userId) return;

    const existing = activeSyncIntervals.get(userId);
    if (existing) {
      existing.count += 1;
    } else {
      void processOutbox(userId);
      void refreshMasterDataSnapshot(userId);

      const intervalId = setInterval(
        () => {
          void refreshMasterDataSnapshot(userId);
        },
        5 * 60 * 1000,
      );
      activeSyncIntervals.set(userId, { count: 1, intervalId });
    }

    return () => {
      const entry = activeSyncIntervals.get(userId);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count <= 0) {
        clearInterval(entry.intervalId);
        activeSyncIntervals.delete(userId);
      }
    };
  }, [isOnline, userId]);

  const outboxOrders = useOutboxOrders(userId);

  const pendingCount = outboxOrders.filter(
    (o) => o.status === "queued" || o.status === "syncing",
  ).length;

  const conflictCount = outboxOrders.filter(
    (o) => o.status === "conflict",
  ).length;

  const syncedCount = outboxOrders.filter((o) => o.status === "synced").length;

  const syncing = isOutboxSyncing();

  // Determine typed sync state for the shell header
  let derivedState: SyncState = "idle";
  if (!isOnline) {
    derivedState = "offline";
  } else if (syncing) {
    derivedState = "syncing";
  } else if (conflictCount > 0) {
    derivedState = "conflict";
  } else if (pendingCount > 0) {
    derivedState = "syncing";
  } else if (syncedCount > 0) {
    derivedState = "synced";
  }

  const syncNow = useCallback(async () => {
    if (!userId) return;
    await processOutbox(userId);
  }, [userId]);

  const refreshSnapshot = useCallback(async () => {
    if (!userId) return;
    return await refreshMasterDataSnapshot(userId);
  }, [userId]);

  const retryOrder = useCallback(
    async (orderId: string) => {
      if (!userId) return;
      await retryOfflineOrder(orderId, userId);
    },
    [userId],
  );

  const removeOrder = useCallback(async (orderId: string) => {
    await removeOfflineOrder(orderId);
  }, []);

  const clearSynced = useCallback(async () => {
    if (!userId) return;
    await clearSyncedOrders(userId);
  }, [userId]);

  return {
    isOnline,
    syncState: derivedState,
    syncing,
    pendingCount,
    conflictCount,
    syncedCount,
    outboxOrders,
    syncNow,
    refreshSnapshot,
    queueOrder: queueOfflineOrder,
    retryOrder,
    removeOrder,
    clearSynced,
  };
}
