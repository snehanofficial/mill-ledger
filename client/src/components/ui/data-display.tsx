import * as React from "react";

import { cn } from "@/lib/utils";

function DataList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl className={cn("grid gap-4", className)} {...props} />;
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
        "flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-b-0",
        className,
      )}
    >
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="numeric text-right text-body-medium font-semibold text-foreground">
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
        "flex flex-col gap-1 border-l border-border pl-4",
        className,
      )}
    >
      <p className="text-caption text-muted">{label}</p>
      <p className="numeric text-section-title font-semibold">{value}</p>
      {detail ? <p className="text-caption text-muted">{detail}</p> : null}
    </div>
  );
}

export { DataItem, DataList, Metric };
