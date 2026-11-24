import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { processOutbox } from "../../client/src/offline/sync-engine.js";
import { offlineDb } from "../../client/src/offline/db.js";
import { apiClient } from "../../client/src/lib/api-client.js";

describe("F-083 Regression: Insufficient Stock Offline Order Conflict Queue Triage (REQ-052 / OD-09)", () => {
  const syncEnginePath = path.resolve(
    __dirname,
    "../../client/src/offline/sync-engine.ts",
  );

  it("verifies structural code in sync-engine.ts inspecting shortages and triaging to conflict queue", () => {
    const source = fs.readFileSync(syncEnginePath, "utf8");

    // Must inspect response shortages
    expect(source).toContain("response.data.shortages");
    expect(source).toContain("STOCK_INSUFFICIENT");
    expect(source).toContain("Stock insufficient: shortage of");

    // Must increment conflicts and continue, not mark synced
    expect(source).toContain("activeShortages.length > 0");
    expect(source).toContain("conflicts += 1;");
    expect(source).toContain('status: "conflict"');

    // Must also treat HTTP 409 as conflict
    expect(source).toContain("status === 409");
  });

  it("routes orders with stock shortages into the conflict queue while allowing sufficient stock orders to sync cleanly", async () => {
    const orders: any[] = [
      // 1. Order with stock shortage
      {
        id: "shortage-order-1",
        userId: "salesman-user",
        customerId: "cust-shortage-1",
        idempotencyKey: "idem-shortage-1",
        items: [
          { productVariantId: "p-murukku", quantity: 500, quotedUnitPrice: 50 },
        ],
        createdAt: "2026-11-24T00:00:01Z",
        status: "queued",
        attempts: 0,
      },
      // 2. Order with sufficient stock
      {
        id: "valid-order-2",
        userId: "salesman-user",
        customerId: "cust-valid-2",
        idempotencyKey: "idem-valid-2",
        items: [
          { productVariantId: "p-murukku", quantity: 20, quotedUnitPrice: 50 },
        ],
        createdAt: "2026-11-24T00:00:02Z",
        status: "queued",
        attempts: 0,
      },
      // 3. Order encountering HTTP 409 conflict
      {
        id: "http-conflict-order-3",
        userId: "salesman-user",
        customerId: "cust-conflict-3",
        idempotencyKey: "idem-conflict-3",
        items: [
          { productVariantId: "p-murukku", quantity: 10, quotedUnitPrice: 50 },
        ],
        createdAt: "2026-11-24T00:00:03Z",
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

    vi.spyOn(apiClient, "post").mockImplementation(async (url: string, payload: any) => {
      if (payload.customerId === "cust-shortage-1") {
        return {
          data: {
            order: {
              id: "server-so-shortage",
              orderNumber: "SO-2026-SHORTAGE",
            },
            shortages: [
              { productVariantId: "p-murukku", shortage: 450 },
            ],
          },
        } as any;
      }

      if (payload.customerId === "cust-valid-2") {
        return {
          data: {
            order: {
              id: "server-so-valid",
              orderNumber: "SO-2026-VALID",
            },
            shortages: [
              { productVariantId: "p-murukku", shortage: 0 },
            ],
          },
        } as any;
      }

      if (payload.customerId === "cust-conflict-3") {
        const error: any = new Error("Account credit limit locked");
        error.response = {
          status: 409,
          data: { error: "Account credit limit locked" },
        };
        throw error;
      }

      throw new Error("Unexpected order payload");
    });

    const result = await processOutbox("salesman-user");

    expect(result.processed).toBe(3);
    expect(result.conflicts).toBe(2);
    expect(result.succeeded).toBe(1);

    // Verify shortage order state
    const shortageOrd = updatedMap.get("shortage-order-1");
    expect(shortageOrd.status).toBe("conflict");
    expect(shortageOrd.lastErrorCode).toBe("STOCK_INSUFFICIENT");
    expect(shortageOrd.lastErrorMessage).toContain("shortage of 450 units detected");
    expect(shortageOrd.serverOrderId).toBe("server-so-shortage");
    expect(shortageOrd.serverOrderNumber).toBe("SO-2026-SHORTAGE");

    // Verify valid order state
    const validOrd = updatedMap.get("valid-order-2");
    expect(validOrd.status).toBe("synced");
    expect(validOrd.serverOrderId).toBe("server-so-valid");
    expect(validOrd.serverOrderNumber).toBe("SO-2026-VALID");

    // Verify HTTP 409 conflict order state
    const conflictOrd = updatedMap.get("http-conflict-order-3");
    expect(conflictOrd.status).toBe("conflict");
    expect(conflictOrd.lastErrorCode).toBe("HTTP_409");
  });
});
