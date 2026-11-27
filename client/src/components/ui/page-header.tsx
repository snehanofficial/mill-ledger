import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  asOf?: string | Date | null;
  badge?: ReactNode;
  className?: string;
}

/**
 * Standard operational page header:
 * - Single H1 + short purpose sentence
 * - Optional data freshness timestamp
 * - One visually dominant primary action + quieter secondary actions
 */
export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  asOf,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl break-words">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(asOf || secondaryActions || primaryAction) && (
        <div className="flex flex-wrap items-center gap-2 lg:max-w-[55%] lg:justify-end">
          {asOf && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>As of {formatTime(asOf)}</span>
            </span>
          )}
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </div>
  );
}

interface RecordHeaderProps {
  backTo: string;
  backLabel: string;
  reference: string;
  subtitle?: string;
  statuses?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}

/**
 * Standard record detail header for List -> Detail -> Next Action journeys.
 */
export function RecordHeader({
  backTo,
  backLabel,
  reference,
  subtitle,
  statuses,
  primaryAction,
  secondaryActions,
  className,
}: RecordHeaderProps) {
  return (
    <div className={cn("space-y-3 border-b border-border pb-4", className)}>
      <div>
        <Link
          to={backTo}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 -ml-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl break-words">
              {reference}
            </h1>
            {statuses}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {(secondaryActions || primaryAction) && (
          <div className="flex flex-wrap items-center gap-2 lg:max-w-[60%] lg:justify-end">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
}

export interface LifecycleStep {
  label: string;
  state: "completed" | "current" | "upcoming" | "blocked";
  detail?: string;
}

/**
 * Compact horizontal/vertical lifecycle progress indicator.
 * Uses text + semantic tone, never color alone.
 */
export function LifecycleSteps({
  steps,
  className,
}: {
  steps: LifecycleStep[];
  className?: string;
}) {
  return (
    <nav aria-label="Record lifecycle" className={cn("w-full", className)}>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, idx) => (
          <li
            key={step.label}
            className={cn(
              "flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs",
              step.state === "completed" &&
                "border-emerald-200 bg-emerald-50/60 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
              step.state === "current" &&
                "border-primary/40 bg-primary/5 text-foreground font-medium",
              step.state === "blocked" &&
                "border-destructive/40 bg-destructive/5 text-destructive",
              step.state === "upcoming" &&
                "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                step.state === "completed" &&
                  "bg-emerald-600 text-white dark:bg-emerald-500",
                step.state === "current" && "bg-primary text-primary-foreground",
                step.state === "blocked" &&
                  "bg-destructive text-destructive-foreground",
                step.state === "upcoming" && "bg-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-medium">{step.label}</span>
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[10px] font-normal capitalize"
                >
                  {step.state}
                </Badge>
              </div>
              {step.detail && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
