import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-y rounded-control border border-control bg-background px-3 py-3 text-body text-foreground shadow-none outline-none placeholder:text-muted-foreground",
        "hover:border-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
