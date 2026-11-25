import { describe, it, expect, vi, afterEach } from "vitest";
import { offlineDb, requestPersistentStorage } from "./db.js";
import { authClient } from "../lib/auth-client.js";

describe("F-028: Dexie IndexedDB Purge on Sign-Out (OWASP ASVS 8.3.1 / 3.5.3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls clear() on customers, products, outbox, and meta within a read-write transaction", async () => {
    const clearMocks = {
      customers: vi.fn().mockResolvedValue(undefined),
      products: vi.fn().mockResolvedValue(undefined),
      outbox: vi.fn().mockResolvedValue(undefined),
      meta: vi.fn().mockResolvedValue(undefined),
    };

    offlineDb.customers = { clear: clearMocks.customers } as unknown as typeof offlineDb.customers;
    offlineDb.products = { clear: clearMocks.products } as unknown as typeof offlineDb.products;
    offlineDb.outbox = { clear: clearMocks.outbox } as unknown as typeof offlineDb.outbox;
    offlineDb.meta = { clear: clearMocks.meta } as unknown as typeof offlineDb.meta;
    offlineDb.transaction = vi.fn().mockImplementation(async (_mode, _tables, fn) => {
      await fn();
    }) as unknown as typeof offlineDb.transaction;

    await offlineDb.purgeOnSignOut();

    expect(offlineDb.transaction).toHaveBeenCalledWith(
      "rw",
      [offlineDb.customers, offlineDb.products, offlineDb.outbox, offlineDb.meta],
      expect.any(Function),
    );
    expect(clearMocks.customers).toHaveBeenCalledTimes(1);
    expect(clearMocks.products).toHaveBeenCalledTimes(1);
    expect(clearMocks.outbox).toHaveBeenCalledTimes(1);
    expect(clearMocks.meta).toHaveBeenCalledTimes(1);
  });

  it("automatically invokes offlineDb.purgeOnSignOut when authClient.signOut is called", async () => {
    const purgeSpy = vi.spyOn(offlineDb, "purgeOnSignOut").mockResolvedValue(undefined);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));

    await authClient.signOut();

    expect(purgeSpy).toHaveBeenCalledTimes(1);
  });

  describe("F-087: Persistent Storage Request (W3C Storage Standard)", () => {
    it("requests persistent storage via navigator.storage.persist when supported", async () => {
      const persistMock = vi.fn().mockResolvedValue(true);
      const persistedMock = vi.fn().mockResolvedValue(false);

      vi.stubGlobal("navigator", {
        storage: {
          persist: persistMock,
          persisted: persistedMock,
        },
      });

      const result = await requestPersistentStorage();
      expect(result).toBe(true);
      expect(persistedMock).toHaveBeenCalledTimes(1);
      expect(persistMock).toHaveBeenCalledTimes(1);
    });

    it("returns true immediately if storage is already persisted", async () => {
      const persistMock = vi.fn().mockResolvedValue(true);
      const persistedMock = vi.fn().mockResolvedValue(true);

      vi.stubGlobal("navigator", {
        storage: {
          persist: persistMock,
          persisted: persistedMock,
        },
      });

      const result = await requestPersistentStorage();
      expect(result).toBe(true);
      expect(persistedMock).toHaveBeenCalledTimes(1);
      expect(persistMock).not.toHaveBeenCalled();
    });

    it("returns false gracefully when navigator.storage is unavailable", async () => {
      vi.stubGlobal("navigator", {});

      const result = await requestPersistentStorage();
      expect(result).toBe(false);
    });
  });
});
