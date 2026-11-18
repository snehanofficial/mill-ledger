import * as React from "react";

import { cn } from "@/lib/utils";

function DatePicker({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="date"
      data-slot="date-picker"
      className={cn(
        "h-11 w-full min-w-0 rounded-control border border-control bg-background px-3 numeric text-body text-foreground outline-none",
        "hover:border-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { DatePicker };
