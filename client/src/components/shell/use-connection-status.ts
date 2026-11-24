/**
 * Connection and sync status hook.
 * Tracks online/offline state and exposes a typed sync state for the shell header.
 * Dimensions are reserved in the DOM regardless of state to prevent CLS.
 */

import { useState } from "react";
import { useIsOnline } from "@/offline/use-offline";

type SyncState =
  "idle" | "syncing" | "synced" | "error" | "conflict" | "offline";

export function useConnectionStatus() {
  const isOnline = useIsOnline();
  const [internalSyncState, setInternalSyncState] = useState<SyncState>("idle");

  // Derive syncState during render without cascading effect triggers
  const syncState: SyncState = !isOnline ? "offline" : internalSyncState;

  return { isOnline, syncState, setSyncState: setInternalSyncState };
}

export type { SyncState };
