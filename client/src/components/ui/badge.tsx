import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-small border px-2 py-1 text-caption font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-neutral-border bg-neutral-bg text-neutral",
        success: "border-success-border bg-success-bg text-success",
        warning: "border-warning-border bg-warning-bg text-warning",
        danger: "border-destructive/30 bg-danger-bg text-destructive",
        info: "border-info-border bg-info-bg text-info",
        outline: "border-control bg-background text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge };
