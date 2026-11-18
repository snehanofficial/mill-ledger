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
  if (typeof navigator !== "undefined" && navigator.onLine) {
    void processOutbox(userId);
  }

  return order;
}

export async function processOutbox(
  userId: string,
): Promise<{ processed: number; succeeded: number; conflicts: number }> {
  if (isSyncing) {
    return { processed: 0, succeeded: 0, conflicts: 0 };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
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

        if (
          status === 400 ||
          status === 403 ||
          status === 404 ||
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
