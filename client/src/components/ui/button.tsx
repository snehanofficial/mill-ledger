/* oxlint-disable react/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-control border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:active:scale-100 aria-disabled:active:scale-100 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985]",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:bg-primary-pressed",
        secondary:
          "border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-foreground",
        outline:
          "border-border bg-background shadow-xs hover:bg-accent hover:text-foreground text-foreground",
        ghost:
          "border-transparent bg-transparent hover:bg-accent hover:text-foreground text-muted-foreground",
        tertiary:
          "border-transparent bg-transparent text-primary hover:bg-primary/10",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-hover active:bg-destructive-pressed",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-control",
        lg: "h-11 px-6 rounded-control text-base",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
