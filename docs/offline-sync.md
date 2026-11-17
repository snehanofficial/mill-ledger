# Offline Sync

## Offline scope

Allowed offline:

- Static PWA application assets
- Signed-in user's assigned customer subset
- Active product and effective price snapshot
- Local order drafts
- Durable order outbox
- Read-only cached own-order subset

Server-authoritative only:

- Approval and reservation
- Production posting
- Purchases
- Invoice numbering and posting
- Dispatch
- Payments
- Any stock or financial posting

## Storage

- Workbox/Cache Storage: static shell, fonts, icons, and deliberately selected assets only.
- Dexie/IndexedDB: user-scoped snapshots, drafts, and outbox commands.
- TanStack Query: server-state cache; not the durable business-command store.
- Session secrets: secure HttpOnly cookies only, never local storage or IndexedDB.

## Local order state

```ts
interface OfflineOrder {
  id: string;
  idempotencyKey: string;
  schemaVersion: number;
  userId: string;
  deviceId: string;
  customerId: string;
  priceListVersion?: string;
  pricedAt: string;
  items: Array<{
    productVariantId: string;
    quantity: string;
    quotedUnitPrice: string;
  }>;
  status: "queued" | "syncing" | "synced" | "conflict" | "failed";
  createdAt: string;
  attempts: number;
  lastErrorCode?: string;
}
```

The local record is a command awaiting server acceptance. It is never approved or reserved offline.

## Synchronization

1. Restore only the active user's local database.
2. Revalidate the server session.
3. Refresh authorized customer/product/price snapshots.
4. Process queued orders in creation order.
5. Send an idempotency key and schema version for each order.
6. Server recomputes policy/pricing and validates assignment/product status.
7. Server returns accepted, validation conflict, or transient failure.
8. Store the server order ID after acceptance.
9. Preserve conflicts and failed payloads for manual resolution/retry.
10. Reconcile locally accepted items with server order history.

## Conflict cases

- Revoked customer assignment
- Discontinued or changed product
- Changed price list
- Customer hold/block
- Expired session
- Response lost after server commit
- Browser reload during sync
- PWA data-schema migration
- Limited server stock

## UI and account behavior

- Clearly show `Saved on this device`, `Waiting to sync`, `Syncing`, `Synced`, `Conflict`, or `Failed`.
- Show cached price freshness and never promise live stock.
- Synchronize on app launch, online event, and manual retry.
- Background Sync is optional; do not make it the only retry mechanism.
- On logout/account switch, explain and preserve pending work for the same authorized account.
- Never silently discard unsynchronized orders.
- Browser storage eviction is possible even with persistent-storage requests.
- Service worker updates must not reload while an order is being edited.
