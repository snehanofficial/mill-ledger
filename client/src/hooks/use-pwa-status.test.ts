import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isRunningStandalone,
  triggerPwaInstall,
  type BeforeInstallPromptEvent,
} from "./use-pwa-status.js";

describe("use-pwa-status helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("detects standalone display mode", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
      navigator: {},
    });
    expect(isRunningStandalone()).toBe(true);
  });

  it("triggers deferred beforeinstallprompt and clears single-use event before userChoice", async () => {
    let cleared = false;
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const deferredPrompt = {
      platforms: ["web"],
      prompt: promptMock,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    } as unknown as BeforeInstallPromptEvent;

    const outcome = await triggerPwaInstall({
      supportsWebInstall: false,
      deferredPrompt,
      clearDeferredPrompt: () => {
        cleared = true;
      },
    });

    expect(cleared).toBe(true);
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(outcome).toBe("accepted");
  });

  it("uses navigator.install when native Web Install API is supported", async () => {
    const installMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      navigator: {
        install: installMock,
      },
    });

    const outcome = await triggerPwaInstall({
      supportsWebInstall: true,
      deferredPrompt: null,
      clearDeferredPrompt: vi.fn(),
    });

    expect(installMock).toHaveBeenCalledTimes(1);
    expect(outcome).toBe("accepted");
  });

  it("returns unavailable when neither mechanism is present", async () => {
    const outcome = await triggerPwaInstall({
      supportsWebInstall: false,
      deferredPrompt: null,
      clearDeferredPrompt: vi.fn(),
    });

    expect(outcome).toBe("unavailable");
  });
});
