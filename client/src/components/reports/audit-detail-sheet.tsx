import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataItem, DataList } from "@/components/ui/data-display";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/formatters";
import {
  extractAuditDiff,
  formatAuditValue,
  formatRawAuditJson,
  getActionBadgeVariant,
  humanizeEntity,
  humanizeKey,
  maskSensitiveValue,
  parseAuditDetails,
  type AuditDiffEntry,
} from "@/lib/audit-formatter";

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | Record<string, unknown> | null;
  reason?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
}

interface AuditDetailSheetProps {
  log: AuditLogRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function renderStructuredValue(key: string, value: unknown): React.ReactNode {
  const safeValue = maskSensitiveValue(key, value);

  if (
    safeValue !== null &&
    typeof safeValue === "object" &&
    !Array.isArray(safeValue)
  ) {
    const entries = Object.entries(safeValue as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-muted-foreground">Empty</span>;
    }
    return (
      <dl className="mt-1 space-y-1.5 rounded-control border border-border bg-surface-muted/50 p-2.5 text-left">
        {entries.map(([subKey, subVal]) => (
          <div
            key={subKey}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <dt className="font-medium text-muted-foreground">
              {humanizeKey(subKey)}
            </dt>
            <dd className="numeric font-medium text-foreground">
              {formatAuditValue(subVal, subKey)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (Array.isArray(safeValue) && safeValue.length > 0) {
    const hasObjects = safeValue.some(
      (item) => item !== null && typeof item === "object",
    );
    if (hasObjects) {
      return (
        <ul className="mt-1 space-y-1.5 text-left">
          {safeValue.map((item, idx) => (
            <li
              key={idx}
              className="rounded-control border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs"
            >
              {typeof item === "object" && item !== null ? (
                <div className="space-y-1">
                  {Object.entries(item as Record<string, unknown>).map(
                    ([k, v]) => (
                      <div
                        key={k}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <span className="text-muted-foreground">
                          {humanizeKey(k)}
                        </span>
                        <span className="numeric font-medium text-foreground">
                          {formatAuditValue(v, k)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                formatAuditValue(item)
              )}
            </li>
          ))}
        </ul>
      );
    }
  }

  return formatAuditValue(safeValue, key);
}

function DiffList({ diffs }: { diffs: AuditDiffEntry[] }) {
  if (diffs.length === 0) {
    return (
      <p className="rounded-control border border-border bg-surface-muted/40 p-3 text-xs text-muted-foreground">
        No field-level changes detected between before and after snapshots.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-control border border-border">
      {diffs.map((diff) => (
        <div key={diff.field} className="space-y-1.5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {diff.label}
            </span>
            <Badge
              variant={
                diff.kind === "added"
                  ? "success"
                  : diff.kind === "removed"
                    ? "danger"
                    : "info"
              }
              className="text-[10px] uppercase"
            >
              {diff.kind}
            </Badge>
          </div>
          <div className="grid gap-1 text-xs">
            {(diff.kind === "removed" || diff.kind === "changed") && (
              <div className="flex items-start gap-1.5 rounded-small bg-red-500/10 px-2 py-1 text-red-900 dark:text-red-200">
                <MinusIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="line-through break-all">{diff.before}</span>
              </div>
            )}
            {(diff.kind === "added" || diff.kind === "changed") && (
              <div className="flex items-start gap-1.5 rounded-small bg-emerald-500/10 px-2 py-1 text-emerald-900 dark:text-emerald-200">
                <PlusIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="break-all">{diff.after}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditDetailSheet({
  log,
  open,
  onOpenChange,
}: AuditDetailSheetProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [log?.id, open]);

  if (!log) {
    return null;
  }

  const parsed = parseAuditDetails(log.details);
  const diffs =
    parsed.kind === "structured" ? extractAuditDiff(parsed.data) : null;
  const rawJson = formatRawAuditJson(log.details);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getActionBadgeVariant(log.action)}>
              {log.action}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {humanizeEntity(log.entity)}
            </span>
          </div>
          <SheetTitle>Audit Event Details</SheetTitle>
          <SheetDescription>
            Recorded {formatDateTime(log.timestamp)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-6">
          <section aria-labelledby="audit-meta-heading">
            <h3
              id="audit-meta-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Event Context
            </h3>
            <DataList className="rounded-control border border-border bg-card p-3.5">
              <DataItem label="Actor">{log.userEmail || "System"}</DataItem>
              <DataItem label="Entity">{humanizeEntity(log.entity)}</DataItem>
              {log.entityId ? (
                <DataItem label="Entity ID">
                  <span className="font-mono text-xs break-all">
                    {log.entityId}
                  </span>
                </DataItem>
              ) : null}
              {log.reason ? (
                <DataItem label="Reason">{log.reason}</DataItem>
              ) : null}
              {log.requestId ? (
                <DataItem label="Request ID">
                  <span className="font-mono text-xs break-all">
                    {log.requestId}
                  </span>
                </DataItem>
              ) : null}
              {log.ipAddress ? (
                <DataItem label="IP Address">
                  <span className="font-mono text-xs">{log.ipAddress}</span>
                </DataItem>
              ) : null}
            </DataList>
          </section>

          <section aria-labelledby="audit-payload-heading">
            <h3
              id="audit-payload-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Event Payload
            </h3>
            <Tabs defaultValue="formatted">
              <TabsList className="w-full">
                <TabsTrigger value="formatted" className="flex-1">
                  Formatted
                </TabsTrigger>
                <TabsTrigger value="raw" className="flex-1">
                  Raw JSON
                </TabsTrigger>
              </TabsList>

              <TabsContent value="formatted" className="mt-3">
                {parsed.kind === "empty" && (
                  <p className="rounded-control border border-border bg-surface-muted/40 p-4 text-xs text-muted-foreground">
                    No additional payload recorded for this event.
                  </p>
                )}

                {parsed.kind === "text" && (
                  <p className="rounded-control border border-border bg-card p-3.5 text-sm text-foreground break-words">
                    {parsed.text}
                  </p>
                )}

                {parsed.kind === "array" && (
                  <div className="rounded-control border border-border bg-card p-3.5">
                    {renderStructuredValue("items", parsed.data)}
                  </div>
                )}

                {parsed.kind === "structured" && diffs !== null && (
                  <DiffList diffs={diffs} />
                )}

                {parsed.kind === "structured" && diffs === null && (
                  <DataList className="rounded-control border border-border bg-card p-3.5">
                    {Object.entries(parsed.data).map(([key, value]) => (
                      <DataItem key={key} label={humanizeKey(key)}>
                        {renderStructuredValue(key, value)}
                      </DataItem>
                    ))}
                  </DataList>
                )}
              </TabsContent>

              <TabsContent value="raw" className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Machine-readable payload
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyJson}
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="size-3.5" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" aria-hidden="true" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-96 overflow-auto rounded-control border border-border bg-surface-muted p-3.5 font-mono text-xs leading-relaxed text-foreground">
                  <code>{rawJson}</code>
                </pre>
                <span className="sr-only" aria-live="polite">
                  {copied ? "Raw JSON copied to clipboard" : ""}
                </span>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
