import Dexie, { type Table } from "dexie";

export interface CachedCustomer {
  id: string;
  code: string;
  name: string;
  state: string;
  gstin?: string | null;
  phone?: string | null;
  address?: string | null;
  organizationId: string;
  updatedAt: string;
}

export interface CachedProduct {
  id: string;
  sku: string;
  name: string;
  productName: string;
  defaultPrice: number;
  taxRate: number;
  uom: string;
  hsnCode?: string;
  updatedAt: string;
}

export interface OfflineOrderItem {
  productVariantId: string;
  sku: string;
  name: string;
  quantity: number;
  quotedUnitPrice: number;
}

export interface OfflineOrder {
  id: string; // Client UUID
  idempotencyKey: string;
  schemaVersion: number;
  userId: string;
  deviceId: string;
  customerId: string;
  customerName: string;
  customerState: string;
  priceListVersion?: string;
  pricedAt: string;
  notes?: string;
  items: OfflineOrderItem[];
  status: "queued" | "syncing" | "synced" | "conflict" | "failed";
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  serverOrderId?: string;
  serverOrderNumber?: string;
}

export interface MetaRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export class MillLedgerDatabase extends Dexie {
  customers!: Table<CachedCustomer, string>;
  products!: Table<CachedProduct, string>;
  outbox!: Table<OfflineOrder, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("mill_ledger_offline_db");
    this.version(1).stores({
      customers: "id, code, organizationId, updatedAt",
      products: "id, sku, updatedAt",
      outbox: "id, idempotencyKey, userId, status, createdAt, customerId",
      meta: "key, updatedAt",
    });
  }

  /**
   * Purge all sensitive cached customer PII, offline outbox, products, and metadata upon sign-out (OWASP ASVS 8.3.1 / 3.5.3)
   */
  async purgeOnSignOut(): Promise<void> {
    await this.transaction(
      "rw",
      [this.customers, this.products, this.outbox, this.meta],
      async () => {
        await Promise.all([
          this.customers.clear(),
          this.products.clear(),
          this.outbox.clear(),
          this.meta.clear(),
        ]);
      },
    );
  }
}

export const offlineDb = new MillLedgerDatabase();
