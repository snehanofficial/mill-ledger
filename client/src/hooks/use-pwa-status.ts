import { useCallback, useEffect, useState } from "react";
import { requestPersistentStorage } from "@/offline/db";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type NavigatorWithInstall = Navigator & {
  install?: (options?: { manifest?: string; manifestId?: string }) => Promise<void>;
  standalone?: boolean;
};

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as NavigatorWithInstall;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    nav.standalone === true
  );
}

export function hasNativeWebInstall(): boolean {
  if (typeof window === "undefined" || typeof Navigator === "undefined") {
    return false;
  }
  return typeof (Navigator.prototype as NavigatorWithInstall).install === "function";
}

export async function triggerPwaInstall(options: {
  supportsWebInstall: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  clearDeferredPrompt: () => void;
}): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (options.supportsWebInstall) {
    const nav = window.navigator as NavigatorWithInstall;
    await nav.install?.();
    return "accepted";
  }

  const promptEvent = options.deferredPrompt;
  if (!promptEvent) {
    return "unavailable";
  }

  // Single-use event: clear before awaiting userChoice.
  options.clearDeferredPrompt();

  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  return outcome === "accepted" ? "accepted" : "dismissed";
}

// Module-level store so beforeinstallprompt is captured even before lazy routes mount.
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled = isRunningStandalone();
const listeners = new Set<() => void>();
let listenersAttached = false;

function notifyPwaListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function initPwaListeners(): void {
  if (typeof window === "undefined" || listenersAttached) return;
  listenersAttached = true;

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    globalDeferredPrompt = event as BeforeInstallPromptEvent;
    notifyPwaListeners();
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    globalIsInstalled = true;
    notifyPwaListeners();
    void requestPersistentStorage();
  });

  const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
  mediaQuery?.addEventListener?.("change", (event: MediaQueryListEvent) => {
    if (event.matches) {
      globalIsInstalled = true;
      globalDeferredPrompt = null;
      notifyPwaListeners();
    }
  });
}

if (typeof window !== "undefined") {
  initPwaListeners();
}

export interface PwaStatus {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isInstalling: boolean;
  installMessage: string | null;
  storagePersisted: boolean | null;
  isStorageSupported: boolean;
  isRequestingStorage: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  requestStoragePersistence: () => Promise<boolean>;
}

export function usePwaStatus(): PwaStatus {
  const [, setVersion] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  const isStorageSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.persist === "function";

  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [isRequestingStorage, setIsRequestingStorage] = useState(false);

  const supportsWebInstall = hasNativeWebInstall();

  const refreshStorageStatus = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      typeof navigator.storage.persisted !== "function"
    ) {
      return;
    }
    try {
      const persisted = await navigator.storage.persisted();
      setStoragePersisted(persisted);
    } catch {
      // Ignore storage inspection errors in restricted contexts
    }
  }, []);

  useEffect(() => {
    initPwaListeners();
    const onStoreChange = () => {
      setVersion((v) => v + 1);
      void refreshStorageStatus();
    };
    const onFocusOrVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void refreshStorageStatus();
    };
    listeners.add(onStoreChange);
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    // When launched in the installed standalone PWA window, re-request persistence automatically.
    if (isRunningStandalone()) {
      void requestPersistentStorage().then((granted) => {
        setStoragePersisted(granted);
      });
    } else {
      void refreshStorageStatus();
    }

    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [refreshStorageStatus]);

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (isInstalling || globalIsInstalled) return "unavailable";
    setIsInstalling(true);
    setInstallMessage(null);

    try {
      const outcome = await triggerPwaInstall({
        supportsWebInstall,
        deferredPrompt: globalDeferredPrompt,
        clearDeferredPrompt: () => {
          globalDeferredPrompt = null;
          notifyPwaListeners();
        },
      });

      if (outcome === "accepted") {
        globalIsInstalled = true;
        globalDeferredPrompt = null;
        notifyPwaListeners();
        setInstallMessage(
          supportsWebInstall ? "App installed or opened." : "App installed.",
        );
        const granted = await requestPersistentStorage();
        setStoragePersisted(granted);
        return "accepted";
      }

      if (outcome === "dismissed") {
        setInstallMessage("Installation canceled.");
        return "dismissed";
      }

      return "unavailable";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setInstallMessage("Installation canceled.");
        return "dismissed";
      }
      setInstallMessage("Installation could not start.");
      return "unavailable";
    } finally {
      setIsInstalling(false);
    }
  }, [isInstalling, supportsWebInstall]);

  const requestStoragePersistence = useCallback(async (): Promise<boolean> => {
    if (isRequestingStorage) return Boolean(storagePersisted);
    setIsRequestingStorage(true);
    try {
      const granted = await requestPersistentStorage();
      setStoragePersisted(granted);
      return granted;
    } finally {
      setIsRequestingStorage(false);
    }
  }, [isRequestingStorage, storagePersisted]);

  const canInstall =
    !globalIsInstalled && (supportsWebInstall || globalDeferredPrompt !== null);

  return {
    canInstall,
    isInstalled: globalIsInstalled,
    isStandalone: isRunningStandalone(),
    isInstalling,
    installMessage,
    storagePersisted,
    isStorageSupported,
    isRequestingStorage,
    promptInstall,
    requestStoragePersistence,
  };
}
