import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-3 rounded-panel border border-border bg-surface px-5 py-8 text-center",
        className,
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-subsection-title font-semibold", className)}
      {...props}
    />
  );
}
function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("max-w-md text-body text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Empty, EmptyDescription, EmptyTitle };
