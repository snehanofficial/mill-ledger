import { apiClient } from "@/lib/api-client";
import {
  offlineDb,
  type CachedCustomer,
  type CachedProduct,
  type OfflineOrder,
  type OfflineOrderItem,
} from "./db";

let isSyncing = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSync(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-device";
  let id = localStorage.getItem("mill_ledger_device_id");
  if (!id) {
    id = `dev-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem("mill_ledger_device_id", id);
  }
  return id;
}

export async function refreshMasterDataSnapshot(
  userId: string,
): Promise<{ customersCount: number; productsCount: number }> {
  try {
    const [custRes, prodRes] = await Promise.all([
      apiClient.get<{ customers: Array<any> }>("/sales/customers"),
      apiClient.get<{ products: Array<any> }>("/sales/products"),
    ]);

    const now = new Date().toISOString();

    const customers: CachedCustomer[] = custRes.data.customers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      state: c.state,
      gstin: c.gstin ?? null,
      phone: c.phone ?? null,
      address: c.address ?? null,
      organizationId: c.organizationId ?? "MILL",
      updatedAt: now,
    }));

    const products: CachedProduct[] = prodRes.data.products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      productName: p.productName ?? p.name,
      defaultPrice: Number(p.defaultPrice ?? 50),
      taxRate: Number(p.taxRate ?? 5),
      uom: p.uom ?? "PACKET",
      hsnCode: p.hsnCode,
      updatedAt: now,
    }));

    await offlineDb.transaction(
      "rw",
      [offlineDb.customers, offlineDb.products, offlineDb.meta],
      async () => {
        await offlineDb.customers.clear();
        await offlineDb.customers.bulkPut(customers);

        await offlineDb.products.clear();
        await offlineDb.products.bulkPut(products);

        await offlineDb.meta.put({
          key: `master_data_synced_${userId}`,
          value: now,
          updatedAt: now,
        });
      },
    );

    notifyListeners();
    return {
      customersCount: customers.length,
      productsCount: products.length,
    };
  } catch (error) {
    console.warn("Failed to refresh master data snapshot", error);
    return { customersCount: 0, productsCount: 0 };
  }
}

export async function queueOfflineOrder(
  input: {
    customerId: string;
    customerName: string;
    customerState: string;
    notes?: string;
    items: OfflineOrderItem[];
  },
  userId: string,
): Promise<OfflineOrder> {
  const now = new Date().toISOString();
  const id = `local-ord-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const idempotencyKey = `idem-offline-${id}`;

  const order: OfflineOrder = {
    id,
    idempotencyKey,
    schemaVersion: 1,
    userId,
    deviceId: getDeviceId(),
    customerId: input.customerId,
    customerName: input.customerName,
    customerState: input.customerState,
    pricedAt: now,
    notes: input.notes,
    items: input.items,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
  };

  await offlineDb.outbox.put(order);
  notifyListeners();

  // If online, immediately try to sync outbox
  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    void processOutbox(userId);
  }

  return order;
}

export async function processOutbox(
  userId: string,
): Promise<{ processed: number; succeeded: number; conflicts: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { processed: 0, succeeded: 0, conflicts: 0 };
  }

  // Cross-tab Web Locks Mutex (MLD-015)
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return await navigator.locks.request(
      "mill-ledger-outbox-sync",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          // Another tab is actively processing the outbox
          return { processed: 0, succeeded: 0, conflicts: 0 };
        }
        return await executeSyncLoop(userId);
      },
    );
  }

  // Fallback for environments without navigator.locks (e.g. Node tests, older browsers)
  if (isSyncing) {
    return { processed: 0, succeeded: 0, conflicts: 0 };
  }

  return await executeSyncLoop(userId);
}

async function executeSyncLoop(
  userId: string,
): Promise<{ processed: number; succeeded: number; conflicts: number }> {
  if (isSyncing) {
    return { processed: 0, succeeded: 0, conflicts: 0 };
  }

  isSyncing = true;
  notifyListeners();

  let processed = 0;
  let succeeded = 0;
  let conflicts = 0;

  try {
    const pendingOrders = await offlineDb.outbox
      .where("userId")
      .equals(userId)
      .filter((o) => o.status === "queued" || o.status === "syncing")
      .sortBy("createdAt");

    for (const order of pendingOrders) {
      processed += 1;

      // 1. Client-side structural pre-flight validation (F-082)
      // If order payload is malformed or corrupt, quarantine immediately to prevent head-of-line blocking
      if (
        !order ||
        !order.customerId ||
        !order.idempotencyKey ||
        !Array.isArray(order.items) ||
        order.items.length === 0 ||
        order.items.some(
          (it) =>
            !it ||
            !it.productVariantId ||
            typeof it.quantity !== "number" ||
            isNaN(it.quantity) ||
            it.quantity <= 0,
        )
      ) {
        conflicts += 1;
        await offlineDb.outbox.update(order.id, {
          status: "conflict",
          lastErrorCode: "CLIENT_VALIDATION_ERROR",
          lastErrorMessage:
            "Corrupt or malformed outbox payload: missing customer or valid item lines",
          updatedAt: new Date().toISOString(),
        });
        notifyListeners();
        continue;
      }

      // Mark status as syncing
      await offlineDb.outbox.update(order.id, {
        status: "syncing",
        updatedAt: new Date().toISOString(),
      });
      notifyListeners();

      try {
        const payload = {
          organizationId: "MILL",
          customerId: order.customerId,
          notes: order.notes,
          idempotencyKey: order.idempotencyKey,
          lines: order.items.map((it) => ({
            productVariantId: it.productVariantId,
            quantity: it.quantity,
            unitPrice: it.quotedUnitPrice,
          })),
        };

        const response = await apiClient.post("/sales/orders", payload);
        const serverData = response.data.order || response.data;
        const shortages: Array<{ productVariantId: string; shortage: number }> =
          response.data.shortages || [];
        const activeShortages = shortages.filter((s) => s.shortage > 0);

        // Explicit Conflict Queue triage for insufficient stock at sync time (F-083, REQ-052, OD-09)
        if (activeShortages.length > 0) {
          conflicts += 1;
          const totalShortage = activeShortages.reduce(
            (sum, s) => sum + s.shortage,
            0,
          );
          await offlineDb.outbox.update(order.id, {
            status: "conflict",
            serverOrderId: serverData.id,
            serverOrderNumber: serverData.orderNumber,
            lastErrorCode: "STOCK_INSUFFICIENT",
            lastErrorMessage: `Stock insufficient: shortage of ${totalShortage} units detected at synchronization time`,
            updatedAt: new Date().toISOString(),
          });
          notifyListeners();
          continue;
        }

        await offlineDb.outbox.update(order.id, {
          status: "synced",
          serverOrderId: serverData.id,
          serverOrderNumber: serverData.orderNumber,
          lastErrorCode: undefined,
          lastErrorMessage: undefined,
          updatedAt: new Date().toISOString(),
        });

        succeeded += 1;
        notifyListeners();
      } catch (err: any) {
        const status = err.response?.status;
        const errorMessage =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to sync order";

        // If duplicate conflict error occurred (e.g. another concurrent tab landed the order),
        // resolve cleanly as synced
        if (
          status === 409 &&
          (errorMessage.toLowerCase().includes("idempotency") ||
            errorMessage.toLowerCase().includes("already") ||
            errorMessage.toLowerCase().includes("unique"))
        ) {
          succeeded += 1;
          await offlineDb.outbox.update(order.id, {
            status: "synced",
            lastErrorCode: undefined,
            lastErrorMessage: undefined,
            updatedAt: new Date().toISOString(),
          });
          notifyListeners();
          continue;
        }

        // Check if error is an uncaught client runtime exception rather than a network/HTTP response (F-082)
        const isClientException =
          !err.response &&
          (err instanceof TypeError ||
            err instanceof ReferenceError ||
            err instanceof SyntaxError ||
            err.name === "TypeError");

        if (isClientException) {
          conflicts += 1;
          await offlineDb.outbox.update(order.id, {
            status: "conflict",
            lastErrorCode: "CLIENT_CORRUPTION_ERROR",
            lastErrorMessage: errorMessage,
            updatedAt: new Date().toISOString(),
          });
          notifyListeners();
          continue;
        }

        if (
          status === 400 ||
          status === 403 ||
          status === 404 ||
          status === 409 ||
          status === 422
        ) {
          // Permanent validation or authorization conflict
          conflicts += 1;
          await offlineDb.outbox.update(order.id, {
            status: "conflict",
            lastErrorCode: `HTTP_${status}`,
            lastErrorMessage: errorMessage,
            updatedAt: new Date().toISOString(),
          });
          notifyListeners();
          continue;
        } else {
          // Network error or 5xx server transient issue
          await offlineDb.outbox.update(order.id, {
            status: "queued",
            attempts: order.attempts + 1,
            lastErrorCode: status ? `HTTP_${status}` : "NETWORK_ERROR",
            lastErrorMessage: errorMessage,
            updatedAt: new Date().toISOString(),
          });
          notifyListeners();
          // Break so order creation sequence is strictly preserved
          break;
        }
      }
    }
  } finally {
    isSyncing = false;
    notifyListeners();
  }

  return { processed, succeeded, conflicts };
}

export async function retryOfflineOrder(orderId: string, userId: string) {
  await offlineDb.outbox.update(orderId, {
    status: "queued",
    attempts: 0,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
    updatedAt: new Date().toISOString(),
  });
  notifyListeners();
  void processOutbox(userId);
}

export async function removeOfflineOrder(orderId: string) {
  await offlineDb.outbox.delete(orderId);
  notifyListeners();
}

export async function updateOfflineOrder(
  orderId: string,
  updates: Partial<OfflineOrder>,
  userId: string,
) {
  await offlineDb.outbox.update(orderId, {
    ...updates,
    status: "queued",
    updatedAt: new Date().toISOString(),
  });
  notifyListeners();
  void processOutbox(userId);
}

export async function clearSyncedOrders(userId: string) {
  const synced = await offlineDb.outbox
    .where("userId")
    .equals(userId)
    .filter((o) => o.status === "synced")
    .toArray();

  const ids = synced.map((s) => s.id);
  await offlineDb.outbox.bulkDelete(ids);
  notifyListeners();
}

export function isOutboxSyncing(): boolean {
  return isSyncing;
}
