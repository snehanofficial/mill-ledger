import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Trash2Icon,
  RotateCcwIcon,
  DatabaseIcon,
  LayersIcon,
} from "lucide-react";
import { useSyncManager } from "@/offline/use-offline";
import { toast } from "sonner";

interface DeviceOutboxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function DeviceOutboxSheet({
  open,
  onOpenChange,
  userId,
}: DeviceOutboxSheetProps) {
  const {
    isOnline,
    syncing,
    pendingCount,
    conflictCount,
    syncedCount,
    outboxOrders,
    syncNow,
    refreshSnapshot,
    retryOrder,
    removeOrder,
    clearSynced,
  } = useSyncManager(userId);

  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  const handleRefreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    try {
      const res = await refreshSnapshot();
      toast.success(
        `Catalog refreshed: ${res?.customersCount ?? 0} customers and ${res?.productsCount ?? 0} products cached locally.`,
      );
    } catch {
      toast.error("Failed to refresh offline catalog");
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error("Cannot sync while device is offline");
      return;
    }
    toast.info("Starting outbox synchronization");
    await syncNow();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        {/* Header */}
        <div className="border-b px-5 py-4">
          <SheetHeader className="text-left space-y-1">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <DatabaseIcon className="size-4 text-primary" />
                Device Outbox
              </SheetTitle>
              <div className="flex items-center gap-1.5">
                {conflictCount > 0 && (
                  <Badge variant="danger" className="text-xs">
                    {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
                  </Badge>
                )}
                <Badge
                  variant={isOnline ? "outline" : "warning"}
                  className="text-xs"
                >
                  {isOnline ? "Connected" : "Offline"}
                </Badge>
              </div>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Local IndexedDB command queue awaiting server acceptance. No stock
              reserved until synced.
            </SheetDescription>
          </SheetHeader>

          {/* Quick Action Toolbar */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualSync}
              disabled={syncing || !isOnline || pendingCount === 0}
              className="h-8 text-xs flex-1 gap-1.5"
            >
              <RefreshCwIcon
                className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshCatalog}
              disabled={isRefreshingCatalog || !isOnline}
              className="h-8 text-xs gap-1.5"
            >
              <LayersIcon
                className={`size-3.5 ${isRefreshingCatalog ? "animate-spin" : ""}`}
              />
              Refresh catalog
            </Button>

            {syncedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSynced}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear synced
              </Button>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {outboxOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-muted-foreground">
              <CheckCircle2Icon className="size-8 stroke-1 text-emerald-600 mb-2" />
              <p className="text-sm font-semibold text-foreground">
                All orders synced
              </p>
              <p className="text-xs mt-1">
                Your device outbox is empty. Orders created offline will be
                preserved here until synchronized.
              </p>
            </div>
          ) : (
            outboxOrders.map((ord) => {
              const totalItems = ord.items.reduce(
                (sum, it) => sum + Number(it.quantity),
                0,
              );
              const totalQuoted = ord.items.reduce(
                (sum, it) =>
                  sum + Number(it.quantity) * Number(it.quotedUnitPrice),
                0,
              );

              return (
                <div
                  key={ord.id}
                  className="rounded-lg border bg-card p-3 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-foreground">
                        {ord.customerName}
                      </div>
                      <div className="text-muted-foreground text-2xs">
                        {ord.customerState} •{" "}
                        {new Date(ord.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    {/* Status Badge */}
                    {ord.status === "queued" && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                      >
                        Waiting to sync
                      </Badge>
                    )}
                    {ord.status === "syncing" && (
                      <Badge
                        variant="outline"
                        className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 animate-pulse"
                      >
                        Syncing...
                      </Badge>
                    )}
                    {ord.status === "synced" && (
                      <Badge variant="success">
                        Synced: {ord.serverOrderNumber ?? "Accepted"}
                      </Badge>
                    )}
                    {ord.status === "conflict" && (
                      <Badge variant="danger">
                        Conflict: {ord.lastErrorCode ?? "Rejected"}
                      </Badge>
                    )}
                  </div>

                  {/* Items breakdown */}
                  <div className="bg-muted/40 rounded p-2 space-y-1">
                    {ord.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>
                          {it.name || it.sku} × {it.quantity}
                        </span>
                        <span className="font-medium text-foreground">
                          ₹{(it.quantity * it.quotedUnitPrice).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-1 flex justify-between font-semibold text-foreground">
                      <span>Total ({totalItems} pkts)</span>
                      <span>₹{totalQuoted.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Conflict message if present */}
                  {ord.status === "conflict" && ord.lastErrorMessage && (
                    <div className="flex items-start gap-1.5 p-2 rounded bg-destructive/10 text-destructive border border-destructive/20">
                      <AlertTriangleIcon className="size-3.5 shrink-0 mt-0.5" />
                      <span className="leading-tight">
                        {ord.lastErrorMessage}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {ord.status === "conflict" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryOrder(ord.id)}
                        className="h-6 px-2 text-2xs gap-1"
                      >
                        <RotateCcwIcon className="size-3" />
                        Retry
                      </Button>
                    )}
                    {ord.status === "queued" && isOnline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryOrder(ord.id)}
                        className="h-6 px-2 text-2xs gap-1"
                      >
                        <RefreshCwIcon className="size-3" />
                        Sync this
                      </Button>
                    )}
                    {ord.status !== "syncing" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOrder(ord.id)}
                        className="h-6 px-2 text-2xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-3" />
                        Discard
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
