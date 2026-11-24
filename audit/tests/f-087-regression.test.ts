import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { requestPersistentStorage } from "../../client/src/offline/db";

describe("F-087: Persistent Storage Request for Offline Outbox Queue (W3C Storage Standard & PWA Resilience)", () => {
  const dbPath = path.resolve(__dirname, "../../client/src/offline/db.ts");
  const syncEnginePath = path.resolve(__dirname, "../../client/src/offline/sync-engine.ts");
  const useOfflinePath = path.resolve(__dirname, "../../client/src/offline/use-offline.ts");

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("verifies db.ts defines and exports requestPersistentStorage using W3C navigator.storage API", () => {
    const source = fs.readFileSync(dbPath, "utf8");
    expect(source).toMatch(/export\s+async\s+function\s+requestPersistentStorage\(\)/);
    expect(source).toMatch(/navigator\.storage\.persist\(\)/);
    expect(source).toMatch(/navigator\.storage\.persisted\(\)/);
    expect(source).toMatch(/void\s+requestPersistentStorage\(\)/);
  });

  it("verifies sync-engine.ts requests persistence when queuing orders", () => {
    const source = fs.readFileSync(syncEnginePath, "utf8");
    expect(source).toMatch(/void\s+requestPersistentStorage\(\)/);
    expect(source).toMatch(/export\s*\{\s*requestPersistentStorage\s*\}\s*from\s*["']\.\/db["']/);
  });

  it("verifies use-offline.ts requests persistent storage on mount in useSyncManager", () => {
    const source = fs.readFileSync(useOfflinePath, "utf8");
    expect(source).toMatch(/import\s*\{[\s\S]*?requestPersistentStorage[\s\S]*?\}\s*from\s*["']\.\/db["']/);
    expect(source).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?void\s+requestPersistentStorage\(\);[\s\S]*?\}\s*,\s*\[\]\)/);
  });

  it("successfully resolves true when persistent storage is granted", async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(false);

    vi.stubGlobal("navigator", {
      storage: {
        persist: persistMock,
        persisted: persistedMock,
      },
    });

    const granted = await requestPersistentStorage();
    expect(granted).toBe(true);
    expect(persistedMock).toHaveBeenCalledTimes(1);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses persist call if storage was already persisted", async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(true);

    vi.stubGlobal("navigator", {
      storage: {
        persist: persistMock,
        persisted: persistedMock,
      },
    });

    const granted = await requestPersistentStorage();
    expect(granted).toBe(true);
    expect(persistedMock).toHaveBeenCalledTimes(1);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("gracefully returns false when navigator.storage is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    const granted = await requestPersistentStorage();
    expect(granted).toBe(false);
  });
});
