import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        neutral: "border-border bg-muted text-muted-foreground",
        success:
          "border-success-border bg-success-bg text-success dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        warning:
          "border-warning-border bg-warning-bg text-warning dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        danger:
          "border-destructive/30 bg-danger-bg text-destructive dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
        info: "border-info-border bg-info-bg text-info dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
        outline: "border-border text-foreground bg-transparent",
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

export { Badge, badgeVariants };
