import * as React from "react";

import { cn } from "@/lib/utils";

function DataList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl className={cn("grid gap-3", className)} {...props} />;
}

function DataItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-border pb-2.5 last:border-b-0",
        className,
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="numeric text-right text-sm font-semibold text-foreground">
        {children}
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-panel border border-border bg-card p-4 shadow-xs transition-colors",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="numeric text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

export { DataItem, DataList, Metric };
