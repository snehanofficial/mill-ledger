import * as React from "react";

import { cn } from "@/lib/utils";

function DatePicker({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="date"
      data-slot="date-picker"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-control border border-input bg-background px-3 py-2 numeric text-sm text-foreground shadow-xs outline-none transition-colors",
        "hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { DatePicker };
