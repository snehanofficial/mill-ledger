import { describe, expect, it, vi } from "vitest";
import {
  ApiContractError,
  assertCollectionResponse,
  assertEntityResponse,
} from "./api-contracts";
import { extractErrorMessage } from "./api-client";

describe("API contract validation", () => {
  it("accepts valid populated and empty collection payloads", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const populated = assertCollectionResponse<{
      orders: Array<{ id: string }>;
      pagination: { total: number };
    }>(
      { orders: [{ id: "1" }], pagination: { total: 1 } },
      "orders",
      "/sales/orders",
    );
    expect(populated.orders).toHaveLength(1);

    const empty = assertCollectionResponse<{ orders: Array<{ id: string }> }>(
      { orders: [] },
      "orders",
      "/sales/orders",
    );
    expect(empty.orders).toEqual([]);
  });

  it("throws ApiContractError for undefined, null, or non-array collections", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (const badPayload of [
      undefined,
      null,
      [],
      "<html>error</html>",
      {},
      { orders: null },
      { orders: undefined },
      { orders: { items: [] } },
    ]) {
      expect(() =>
        assertCollectionResponse(badPayload, "orders", "/sales/orders"),
      ).toThrowError(ApiContractError);
    }

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("unwraps wrapped and unwrapped entities and validates required array fields", () => {
    const wrapped = assertEntityResponse<{
      id: string;
      lines: Array<{ id: string }>;
    }>(
      { order: { id: "ord-1", lines: [{ id: "l-1" }] } },
      "order",
      ["lines"],
      "/sales/orders/ord-1",
    );
    expect(wrapped.id).toBe("ord-1");
    expect(wrapped.lines).toHaveLength(1);

    const direct = assertEntityResponse<{
      id: string;
      lines: Array<{ id: string }>;
    }>({ id: "ord-2", lines: [] }, "order", ["lines"], "/sales/orders/ord-2");
    expect(direct.id).toBe("ord-2");
    expect(direct.lines).toEqual([]);
  });

  it("throws ApiContractError when an entity is missing required array fields", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      assertEntityResponse(
        { recentInvoices: undefined, stockItems: [] },
        null,
        ["recentInvoices", "stockItems"],
        "/dashboard",
      ),
    ).toThrowError(ApiContractError);

    expect(() =>
      assertEntityResponse(
        { order: { id: "ord-1" } },
        "order",
        ["lines"],
        "/sales/orders/ord-1",
      ),
    ).toThrowError(ApiContractError);
  });

  it("extractErrorMessage surfaces ApiContractError messages cleanly", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new ApiContractError({
      endpoint: "/payments/ledger/123",
      expected: 'array at "invoices"',
      actualType: "undefined",
    });
    expect(extractErrorMessage(err)).toContain("/payments/ledger/123");
    expect(extractErrorMessage(err)).toContain('array at "invoices"');
  });
});
