import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { processOutbox } from "../../client/src/offline/sync-engine.js";
import { offlineDb } from "../../client/src/offline/db.js";
import { apiClient } from "../../client/src/lib/api-client.js";

describe("F-082 Regression: Corrupt Outbox Queue Entry Head-of-Line Blocking Prevention", () => {
  const syncEnginePath = path.resolve(
    __dirname,
    "../../client/src/offline/sync-engine.ts",
  );

  it("verifies structural code patterns in sync-engine.ts preventing head-of-line blocking", () => {
    const source = fs.readFileSync(syncEnginePath, "utf8");

    // Must have client-side pre-flight validation
    expect(source).toContain("Client-side structural pre-flight validation (F-082)");
    expect(source).toContain("CLIENT_VALIDATION_ERROR");
    expect(source).toContain("Corrupt or malformed outbox payload");

    // Pre-flight check must continue, NOT break
    expect(source).toContain("conflicts += 1;");
    expect(source).toContain("continue;");

    // Must catch client runtime exceptions and quarantine as CLIENT_CORRUPTION_ERROR
    expect(source).toContain("isClientException");
    expect(source).toContain("CLIENT_CORRUPTION_ERROR");
    expect(source).toContain("err instanceof TypeError");
  });

  it("quarantines corrupt entry and successfully processes subsequent valid entries without halting queue", async () => {
    const orders: any[] = [
      // 1. Corrupt entry (missing items array)
      {
        id: "corrupt-order-1",
        userId: "test-user",
        customerId: "cust-1",
        idempotencyKey: "idem-corrupt-1",
        items: undefined, // Will fail preflight validation
        createdAt: "2026-11-24T00:00:01Z",
        status: "queued",
        attempts: 0,
      },
      // 2. Corrupt entry (missing customerId)
      {
        id: "corrupt-order-2",
        userId: "test-user",
        customerId: "",
        idempotencyKey: "idem-corrupt-2",
        items: [{ productVariantId: "p1", quantity: 2, quotedUnitPrice: 100 }],
        createdAt: "2026-11-24T00:00:02Z",
        status: "queued",
        attempts: 0,
      },
      // 3. Valid entry
      {
        id: "valid-order-3",
        userId: "test-user",
        customerId: "cust-2",
        idempotencyKey: "idem-valid-3",
        items: [{ productVariantId: "p2", quantity: 5, quotedUnitPrice: 50 }],
        createdAt: "2026-11-24T00:00:03Z",
        status: "queued",
        attempts: 0,
      },
    ];

    const updatedMap = new Map<string, any>();

    // Mock Dexie offlineDb.outbox
    const mockWhere = {
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([...orders]),
        }),
      }),
    };

    vi.spyOn(offlineDb.outbox, "where").mockReturnValue(mockWhere as any);
    vi.spyOn(offlineDb.outbox, "update").mockImplementation(async (id: any, changes: any) => {
      updatedMap.set(String(id), { ...(updatedMap.get(String(id)) || {}), ...changes });
      return 1;
    });

    // Mock apiClient.post for valid order
    vi.spyOn(apiClient, "post").mockImplementation(async (url: string, payload: any) => {
      if (url === "/sales/orders") {
        return {
          data: {
            order: {
              id: "server-ord-99",
              orderNumber: "SO-2026-99",
            },
          },
        } as any;
      }
      throw new Error("Not found");
    });

    const result = await processOutbox("test-user");

    // All 3 items should have been processed
    expect(result.processed).toBe(3);
    // 2 corrupt items quarantined as conflicts
    expect(result.conflicts).toBe(2);
    // 1 valid item succeeded
    expect(result.succeeded).toBe(1);

    // Verify corrupt order 1 state
    const corrupt1 = updatedMap.get("corrupt-order-1");
    expect(corrupt1.status).toBe("conflict");
    expect(corrupt1.lastErrorCode).toBe("CLIENT_VALIDATION_ERROR");

    // Verify corrupt order 2 state
    const corrupt2 = updatedMap.get("corrupt-order-2");
    expect(corrupt2.status).toBe("conflict");
    expect(corrupt2.lastErrorCode).toBe("CLIENT_VALIDATION_ERROR");

    // Verify valid order state
    const valid3 = updatedMap.get("valid-order-3");
    expect(valid3.status).toBe("synced");
    expect(valid3.serverOrderId).toBe("server-ord-99");
    expect(valid3.serverOrderNumber).toBe("SO-2026-99");
  });

  it("quarantines unexpected client runtime exceptions as CLIENT_CORRUPTION_ERROR without breaking the loop", async () => {
    const orders: any[] = [
      {
        id: "runtime-error-order-1",
        userId: "test-user-2",
        customerId: "cust-runtime",
        idempotencyKey: "idem-runtime-1",
        items: [{ productVariantId: "p1", quantity: 1, quotedUnitPrice: 100 }],
        createdAt: "2026-11-24T00:00:01Z",
        status: "queued",
        attempts: 0,
      },
      {
        id: "runtime-valid-order-2",
        userId: "test-user-2",
        customerId: "cust-runtime-valid",
        idempotencyKey: "idem-runtime-2",
        items: [{ productVariantId: "p2", quantity: 2, quotedUnitPrice: 200 }],
        createdAt: "2026-11-24T00:00:02Z",
        status: "queued",
        attempts: 0,
      },
    ];

    const updatedMap = new Map<string, any>();

    const mockWhere = {
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([...orders]),
        }),
      }),
    };

    vi.spyOn(offlineDb.outbox, "where").mockReturnValue(mockWhere as any);
    vi.spyOn(offlineDb.outbox, "update").mockImplementation(async (id: any, changes: any) => {
      updatedMap.set(String(id), { ...(updatedMap.get(String(id)) || {}), ...changes });
      return 1;
    });

    // Mock apiClient to throw a client TypeError on the first order
    vi.spyOn(apiClient, "post").mockImplementation(async (url: string, payload: any) => {
      if (payload.customerId === "cust-runtime") {
        throw new TypeError("Simulated client TypeError during network request preparation");
      }
      return {
        data: {
          order: {
            id: "server-ord-100",
            orderNumber: "SO-2026-100",
          },
        },
      } as any;
    });

    const result = await processOutbox("test-user-2");

    expect(result.processed).toBe(2);
    expect(result.conflicts).toBe(1);
    expect(result.succeeded).toBe(1);

    const runtimeErrOrder = updatedMap.get("runtime-error-order-1");
    expect(runtimeErrOrder.status).toBe("conflict");
    expect(runtimeErrOrder.lastErrorCode).toBe("CLIENT_CORRUPTION_ERROR");

    const validOrder = updatedMap.get("runtime-valid-order-2");
    expect(validOrder.status).toBe("synced");
  });
});
