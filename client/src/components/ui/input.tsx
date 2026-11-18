import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-control border border-control bg-background px-3 text-body text-foreground shadow-none outline-none placeholder:text-muted-foreground",
        "hover:border-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
