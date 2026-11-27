import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full min-w-0 rounded-control border border-input/45 dark:border-input bg-surface-muted/70 dark:bg-surface-muted px-4 py-2.5 text-base sm:text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground",
        "hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        "user-invalid:border-destructive user-invalid:ring-2 user-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
