import { useCallback, useEffect, useRef, useState } from "react";
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

export interface PwaStatus {
  canInstall: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  installMessage: string | null;
  storagePersisted: boolean | null;
  isStorageSupported: boolean;
  isRequestingStorage: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  requestStoragePersistence: () => Promise<boolean>;
}

export function usePwaStatus(): PwaStatus {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningStandalone());
  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  const isStorageSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.persist === "function";

  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [isRequestingStorage, setIsRequestingStorage] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
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
    void refreshStorageStatus();
  }, [refreshStorageStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setHasDeferredPrompt(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setHasDeferredPrompt(false);
      setIsInstalled(true);
      setInstallMessage("App installed.");
      void requestPersistentStorage().then((granted) => {
        setStoragePersisted(granted);
      });
    };

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
        setHasDeferredPrompt(false);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (isInstalling || isInstalled) return "unavailable";
    setIsInstalling(true);
    setInstallMessage(null);

    try {
      const outcome = await triggerPwaInstall({
        supportsWebInstall,
        deferredPrompt: deferredPromptRef.current,
        clearDeferredPrompt: () => {
          deferredPromptRef.current = null;
          setHasDeferredPrompt(false);
        },
      });

      if (outcome === "accepted") {
        setIsInstalled(true);
        setHasDeferredPrompt(false);
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
  }, [isInstalled, isInstalling, supportsWebInstall]);

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

  const canInstall = !isInstalled && (supportsWebInstall || hasDeferredPrompt);

  return {
    canInstall,
    isInstalled,
    isInstalling,
    installMessage,
    storagePersisted,
    isStorageSupported,
    isRequestingStorage,
    promptInstall,
    requestStoragePersistence,
  };
}
