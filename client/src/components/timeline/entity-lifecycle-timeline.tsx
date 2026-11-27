import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type {
  EntityTimelineResponse,
  TimelineCategory,
  TimelineEntityType,
  TimelineEvent,
  TimelineFilterType,
} from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/loading-error-empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from "lucide-react";

interface EntityLifecycleTimelineProps {
  entityType: TimelineEntityType;
  entityId: string;
  title?: string;
  description?: string;
  className?: string;
  initialLimit?: number;
}

const FILTER_LABELS: Record<TimelineFilterType, string> = {
  ALL: "All activity",
  DIRECT: "Direct changes",
  RELATED: "Related activity",
  FINANCIAL: "Financial",
  OPERATIONAL: "Operational",
};

const CATEGORY_META: Record<
  TimelineCategory,
  {
    label: string;
    badgeVariant: "neutral" | "info" | "success" | "warning" | "outline";
    dotClass: string;
  }
> = {
  DIRECT: {
    label: "Direct",
    badgeVariant: "neutral",
    dotClass: "bg-zinc-500",
  },
  LIFECYCLE: {
    label: "Lifecycle",
    badgeVariant: "success",
    dotClass: "bg-emerald-600",
  },
  RELATED: {
    label: "Related",
    badgeVariant: "info",
    dotClass: "bg-blue-600",
  },
  FINANCIAL: {
    label: "Financial",
    badgeVariant: "warning",
    dotClass: "bg-amber-600",
  },
  OPERATIONAL: {
    label: "Operational",
    badgeVariant: "info",
    dotClass: "bg-teal-600",
  },
  SYSTEM: {
    label: "Baseline",
    badgeVariant: "outline",
    dotClass: "bg-zinc-400",
  },
};

function formatDateGroupHeader(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanizeOriginType(entityType: string): string {
  return entityType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function TimelineEventRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.DIRECT;
  const hasDetailContent =
    event.changes.length > 0 ||
    event.relatedRecords.length > 0 ||
    Boolean(event.reason) ||
    Boolean(event.correlationId);

  return (
    <div className="relative pl-6 pb-5 last:pb-0">
      {/* Vertical timeline connector */}
      <span
        aria-hidden="true"
        className="absolute left-[7px] top-2 bottom-0 w-px bg-border"
      />
      {/* Status marker dot */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1.5 size-[15px] rounded-full border-2 border-card",
          meta.dotClass,
        )}
      />

      <div className="rounded-lg border border-border bg-card transition-colors hover:border-border/80">
        <div className="flex flex-col gap-2 p-3 sm:p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {event.title}
                </span>
                <Badge
                  variant={meta.badgeVariant}
                  className="text-[11px] px-2 py-0"
                >
                  {meta.label}
                </Badge>
                {event.isBaseline && (
                  <Badge variant="outline" className="text-[11px] px-2 py-0">
                    Recorded baseline
                  </Badge>
                )}
              </div>

              <p className="text-sm text-foreground/90">{event.summary}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <time
                dateTime={event.occurredAt}
                title={formatDateTime(event.occurredAt)}
                className="text-xs text-muted-foreground tabular-nums"
              >
                {formatTimeOnly(event.occurredAt)}
              </time>
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Hide" : "Show"} details for ${event.title}`}
                className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">
                  {isExpanded ? "Less" : "Details"}
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Actor:{" "}
              <span className="font-medium text-foreground">
                {event.actorName}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{event.relationshipLabel}</span>
            {event.originRoute && event.relationshipType !== "DIRECT" && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  to={event.originRoute}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {humanizeOriginType(event.originEntityType)} #
                  {event.originEntityLabel}
                  <ExternalLinkIcon className="size-3" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border bg-muted/25 px-3 py-3 sm:px-3.5 space-y-3 text-xs">
            {event.changes.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-foreground">
                  Recorded changes
                </div>
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="px-2.5 py-1.5 font-medium">Field</th>
                        <th className="px-2.5 py-1.5 font-medium">Previous</th>
                        <th className="px-2.5 py-1.5 font-medium">New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(event.changes ?? []).map((c, idx) => (
                        <tr
                          key={`${c.field}-${idx}`}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-2.5 py-1.5 font-medium text-foreground">
                            {c.label}
                          </td>
                          <td className="px-2.5 py-1.5 text-muted-foreground">
                            {c.previousValue || "None"}
                          </td>
                          <td className="px-2.5 py-1.5 font-medium text-foreground">
                            {c.newValue || "None"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Originating record</dt>
                <dd className="font-medium text-foreground">
                  {event.originRoute ? (
                    <Link
                      to={event.originRoute}
                      className="text-primary hover:underline"
                    >
                      {humanizeOriginType(event.originEntityType)} #
                      {event.originEntityLabel}
                    </Link>
                  ) : (
                    `${humanizeOriginType(event.originEntityType)} #${event.originEntityLabel}`
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Occurred at</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {formatDateTime(event.occurredAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Actor & source</dt>
                <dd className="font-medium text-foreground">
                  {event.actorName}
                  {event.actorEmail ? ` (${event.actorEmail})` : ""} ·{" "}
                  {event.source}
                </dd>
              </div>
              {event.reason && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="font-medium text-foreground">
                    {event.reason}
                  </dd>
                </div>
              )}
              {event.correlationId && (
                <div>
                  <dt className="text-muted-foreground">Correlation ID</dt>
                  <dd className="font-mono text-[11px] text-muted-foreground">
                    {event.correlationId}
                  </dd>
                </div>
              )}
            </dl>

            {(event.relatedRecords ?? []).length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-foreground">
                  Related records
                </div>
                <div className="flex flex-wrap gap-2">
                  {(event.relatedRecords ?? []).map((rel, idx) =>
                    rel.route ? (
                      <Link
                        key={`${rel.entityType}-${rel.entityId}-${idx}`}
                        to={rel.route}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
                      >
                        {humanizeOriginType(rel.entityType)}: {rel.label}
                        <ExternalLinkIcon
                          className="size-3"
                          aria-hidden="true"
                        />
                      </Link>
                    ) : (
                      <span
                        key={`${rel.entityType}-${rel.entityId}-${idx}`}
                        className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {humanizeOriginType(rel.entityType)}: {rel.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {!hasDetailContent && (
              <p className="text-muted-foreground">
                No additional field-level changes recorded for this event.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function EntityLifecycleTimeline({
  entityType,
  entityId,
  title = "Lifecycle & related activity",
  description = "Chronological history of direct edits, status transitions, and linked business records.",
  className,
  initialLimit = 15,
}: EntityLifecycleTimelineProps) {
  const [filter, setFilter] = useState<TimelineFilterType>("ALL");
  const [limit, setLimit] = useState(initialLimit);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<EntityTimelineResponse>({
      queryKey: ["entity-timeline", entityType, entityId, filter, limit],
      queryFn: async () => {
        const params = new URLSearchParams({
          filter,
          limit: String(limit),
          offset: "0",
        });
        const endpoint = `/timeline/${entityType}/${entityId}?${params.toString()}`;
        const res = await apiClient.get(endpoint);
        return assertCollectionResponse<EntityTimelineResponse>(
          res.data,
          "events",
          endpoint,
        );
      },
      enabled: Boolean(entityId),
    });

  const groupedEvents = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: TimelineEvent[] }> = [];
    const byDate = new Map<string, TimelineEvent[]>();
    for (const ev of data?.events ?? []) {
      const label = formatDateGroupHeader(ev.occurredAt);
      const list = byDate.get(label) ?? [];
      list.push(ev);
      byDate.set(label, list);
    }
    for (const [dateLabel, items] of byDate.entries()) {
      groups.push({ dateLabel, items });
    }
    return groups;
  }, [data?.events]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const availableFilters = data?.availableFilters ?? ["ALL"];

  return (
    <section
      aria-labelledby="entity-lifecycle-heading"
      className={cn(
        "rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClockIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2
              id="entity-lifecycle-heading"
              className="text-base font-semibold text-foreground"
            >
              {title}
            </h2>
            {data && (
              <span className="text-xs text-muted-foreground tabular-nums">
                ({data.pagination.total})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5 self-start min-h-[36px]"
        >
          <RefreshCwIcon
            className={cn("size-3.5", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Filter pills */}
      {availableFilters.length > 1 && (
        <div
          role="group"
          aria-label="Filter lifecycle events"
          className="flex flex-wrap items-center gap-1.5"
        >
          {availableFilters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setLimit(initialLimit);
                }}
                aria-pressed={active}
                className={cn(
                  "min-h-[34px] rounded-md border px-3 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>
      )}

      {/* Body states */}
      {isLoading ? (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="Loading lifecycle timeline"
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load lifecycle activity"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : !data || data.events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            {filter === "ALL"
              ? "No lifecycle events recorded yet"
              : `No ${FILTER_LABELS[filter].toLowerCase()} events found`}
          </p>
          <p className="text-xs text-muted-foreground">
            {filter === "ALL"
              ? "Activity will appear here as this record and its linked transactions progress."
              : "Switch back to All activity to view the full chronological story."}
          </p>
          {filter !== "ALL" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilter("ALL")}
            >
              Show all activity
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {data.coverageNote && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {data.coverageNote}
            </div>
          )}

          {groupedEvents.map((group) => (
            <div key={group.dateLabel} className="space-y-2.5">
              <div className="text-xs font-semibold text-muted-foreground">
                {group.dateLabel}
              </div>
              <div>
                {group.items.map((ev) => (
                  <TimelineEventRow
                    key={ev.id}
                    event={ev}
                    isExpanded={Boolean(expandedIds[ev.id])}
                    onToggle={() => toggleExpand(ev.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {data.pagination.hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLimit((prev) => prev + initialLimit)}
                disabled={isFetching}
              >
                {isFetching
                  ? "Loading..."
                  : `Show older events (${data.pagination.total - data.events.length} remaining)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
