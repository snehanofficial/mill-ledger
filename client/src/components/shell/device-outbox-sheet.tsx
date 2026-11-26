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
  ClockIcon,
  DownloadIcon,
  HardDriveIcon,
} from "lucide-react";
import { useSyncManager } from "@/offline/use-offline";
import type { OfflineOrder } from "@/offline/db";
import type { PwaStatus } from "@/hooks/use-pwa-status";
import { toast } from "sonner";
import { formatINR, formatTime } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";

interface DeviceOutboxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  pwaStatus?: PwaStatus;
}

export function DeviceOutboxSheet({
  open,
  onOpenChange,
  userId,
  pwaStatus,
}: DeviceOutboxSheetProps) {
  const { t } = useLanguage();
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
  const [orderToDiscard, setOrderToDiscard] = useState<OfflineOrder | null>(null);

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
                {t("Device Outbox")}
              </SheetTitle>
              <div className="flex items-center gap-1.5">
                {conflictCount > 0 && (
                  <Badge variant="danger" className="text-xs">
                    {conflictCount} {t("conflict")}{conflictCount > 1 ? "s" : ""}
                  </Badge>
                )}
                <Badge
                  variant={isOnline ? "outline" : "warning"}
                  className="text-xs"
                >
                  {isOnline ? t("Connected") : t("Offline")}
                </Badge>
              </div>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {t("Local IndexedDB command queue awaiting server acceptance. No stock reserved until synced.")}
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
              {syncing ? t("Syncing...") : t("Sync now")}
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
              {t("Refresh catalog")}
            </Button>

            {syncedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSynced}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                {t("Clear synced")}
              </Button>
            )}
          </div>

          {pwaStatus &&
            (pwaStatus.canInstall || pwaStatus.isStorageSupported) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HardDriveIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {pwaStatus.storagePersisted === true
                      ? t("Storage: Persistent")
                      : pwaStatus.storagePersisted === false
                        ? t("Storage: Best-effort")
                        : t("Storage: Checking...")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {pwaStatus.storagePersisted === false && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const granted = await pwaStatus.requestStoragePersistence();
                        if (granted) {
                          toast.success("Persistent offline storage enabled.");
                        } else if (!pwaStatus.isStandalone) {
                          toast.info(
                            "Open the installed MillLedger app window (not a browser tab) so the browser can grant persistent storage.",
                          );
                        } else {
                          toast.info(
                            "Browser kept best-effort storage (Chrome/Edge grant persistence automatically over HTTPS with usage, without a popup).",
                          );
                        }
                      }}
                      aria-disabled={pwaStatus.isRequestingStorage || undefined}
                      className="h-7 px-2 text-xs cursor-pointer"
                    >
                      {pwaStatus.isRequestingStorage
                        ? t("Requesting...")
                        : t("Persist storage")}
                    </Button>
                  )}
                  {pwaStatus.canInstall && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        const outcome = await pwaStatus.promptInstall();
                        if (outcome === "accepted") {
                          toast.success("MillLedger installed on this device.");
                        }
                      }}
                      aria-disabled={pwaStatus.isInstalling || undefined}
                      className="h-7 gap-1 px-2 text-xs cursor-pointer"
                    >
                      <DownloadIcon className="size-3" aria-hidden="true" />
                      {t("Install app")}
                    </Button>
                  )}
                </div>
              </div>
            )}
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
                        {ord.customerState} • {formatTime(ord.createdAt)}
                      </div>
                    </div>

                    {/* Status Badge */}
                    {ord.status === "queued" && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 flex items-center gap-1"
                      >
                        <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
                        <span>{t("Waiting to sync")}</span>
                      </Badge>
                    )}
                    {ord.status === "syncing" && (
                      <Badge
                        variant="outline"
                        className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 animate-pulse-finite flex items-center gap-1"
                      >
                        <RefreshCwIcon className="size-3 shrink-0 animate-spin" aria-hidden="true" />
                        <span>{t("Syncing...")}</span>
                      </Badge>
                    )}
                    {ord.status === "synced" && (
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle2Icon className="size-3 shrink-0" aria-hidden="true" />
                        <span>{t("Synced")}: {ord.serverOrderNumber ?? t("Accepted")}</span>
                      </Badge>
                    )}
                    {ord.status === "conflict" && (
                      <Badge variant="danger" className="flex items-center gap-1">
                        <AlertTriangleIcon className="size-3 shrink-0" aria-hidden="true" />
                        <span>{t("Conflict")}: {ord.lastErrorCode ?? t("Rejected")}</span>
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
                          {formatINR(it.quantity * it.quotedUnitPrice)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-1 flex justify-between font-semibold text-foreground">
                      <span>{t("Total")} ({totalItems} {t("term.packets", "pkts")})</span>
                      <span>{formatINR(totalQuoted)}</span>
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
                        className="h-8 min-h-[32px] px-2.5 text-xs gap-1 sm:h-7 sm:min-h-[28px] sm:px-2 sm:text-2xs"
                      >
                        <RotateCcwIcon className="size-3.5 sm:size-3" />
                        {t("Retry")}
                      </Button>
                    )}
                    {ord.status === "queued" && isOnline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryOrder(ord.id)}
                        className="h-8 min-h-[32px] px-2.5 text-xs gap-1 sm:h-7 sm:min-h-[28px] sm:px-2 sm:text-2xs"
                      >
                        <RefreshCwIcon className="size-3.5 sm:size-3" />
                        {t("action.sync_now", "Sync this")}
                      </Button>
                    )}
                    {ord.status !== "syncing" && orderToDiscard?.id !== ord.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOrderToDiscard(ord)}
                        className="h-8 min-h-[32px] min-w-[32px] px-2.5 text-xs text-muted-foreground hover:text-destructive sm:h-7 sm:min-h-[28px] sm:min-w-[28px] sm:px-2 sm:text-2xs"
                      >
                        <Trash2Icon className="size-3.5 sm:size-3" />
                        Discard
                      </Button>
                    )}
                  </div>

                  {orderToDiscard?.id === ord.id && (
                    <div
                      role="alert"
                      className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                    >
                      <p className="font-medium text-destructive">
                        Discard this offline order? It exists only on this device and cannot be recovered.
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOrderToDiscard(null)}
                          className="h-8 min-h-[32px] px-2.5 text-xs"
                        >
                          Keep Order
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            removeOrder(ord.id);
                            toast.info(`Offline order for ${ord.customerName} discarded.`);
                            setOrderToDiscard(null);
                          }}
                          className="h-8 min-h-[32px] px-2.5 text-xs"
                        >
                          Yes, Discard Order
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
