import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-panel border border-border bg-surface"
    >
      <Spinner className="size-5" />
      <span className="text-body text-muted">{label}</span>
    </div>
  );
}

function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div
      aria-label="Loading table"
      role="status"
      className="grid gap-3 rounded-panel border border-border bg-surface p-4"
    >
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

function ErrorState({
  title = "Could not load records",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-panel border border-destructive/30 bg-danger-bg px-5 py-6 text-center"
    >
      <AlertCircleIcon className="size-5 text-destructive" aria-hidden="true" />
      <div>
        <p className="text-body-medium font-semibold text-destructive">
          {title}
        </p>
        <p className="mt-1 text-caption text-muted">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCwIcon data-icon="inline-start" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export { ErrorState, LoadingState, SkeletonTable };
