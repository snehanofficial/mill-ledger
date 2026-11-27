import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangleIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { extractRequestId } from "@/lib/api-client";

function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation("common");
  return (
    <div
      role="status"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-6"
    >
      <Spinner className="size-5" />
      <span className="text-sm text-muted-foreground">
        {label ?? t("states.loading")}
      </span>
    </div>
  );
}

function SkeletonTable({
  rows = 5,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      data-slot="skeleton"
      aria-label="Loading table"
      role="status"
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-card p-4 space-y-3",
        className,
      )}
    >
      {/* Table header skeleton */}
      <div className="flex gap-4 border-b border-border/60 pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-5 flex-1" />
        ))}
      </div>
      {/* Table rows skeleton */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-4 items-center py-1.5">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonKPIs({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs"
        >
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-4 rounded-full" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  title,
  description,
  error,
  requestId,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  error?: unknown;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const activeRequestId = requestId || extractRequestId(error);
  const resolvedTitle = title ?? t("states.errorTitle");

  const handleCopy = () => {
    if (
      activeRequestId &&
      typeof navigator !== "undefined" &&
      navigator.clipboard
    ) {
      navigator.clipboard.writeText(activeRequestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-center",
        className,
      )}
    >
      <AlertTriangleIcon
        className="size-6 text-destructive"
        aria-hidden="true"
      />
      <div className="max-w-md">
        <p className="text-sm font-semibold text-destructive">{resolvedTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {activeRequestId && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{t("states.requestId")}</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-2xs font-mono font-medium text-foreground select-all">
              {activeRequestId}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex size-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={
                copied ? "Copied Request ID" : "Copy Request ID to clipboard"
              }
              aria-label="Copy Request ID"
            >
              {copied ? (
                <CheckIcon className="size-3 text-emerald-600" />
              ) : (
                <CopyIcon className="size-3" />
              )}
            </button>
          </div>
        )}
      </div>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1.5 mt-1 cursor-pointer"
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
          {t("states.retryAction")}
        </Button>
      ) : null}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-8 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          aria-hidden={true}
          className="size-8 stroke-1 text-muted-foreground"
        />
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
        </div>
      )}
    </div>
  );
}

export { EmptyState, ErrorState, LoadingState, SkeletonTable, SkeletonKPIs };
