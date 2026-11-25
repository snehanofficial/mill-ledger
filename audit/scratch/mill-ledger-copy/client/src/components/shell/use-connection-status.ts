/**
 * Connection and sync status hook.
 * Tracks online/offline state and exposes a typed sync state for the shell header.
 * Dimensions are reserved in the DOM regardless of state to prevent CLS.
 */

import { useState, useSyncExternalStore } from "react";

type SyncState =
  "idle" | "syncing" | "synced" | "error" | "conflict" | "offline";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function useConnectionStatus() {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    () => true,
  );
  const [internalSyncState, setInternalSyncState] = useState<SyncState>("idle");

  // Derive syncState during render without cascading effect triggers
  const syncState: SyncState = !isOnline ? "offline" : internalSyncState;

  return { isOnline, syncState, setSyncState: setInternalSyncState };
}

export type { SyncState };
