import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-4 text-body-medium font-semibold whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985]",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary-hover active:bg-primary-pressed",
        secondary:
          "border-control bg-background text-foreground hover:bg-accent",
        outline:
          "border-border bg-background shadow-xs hover:bg-accent hover:text-foreground text-foreground",
        ghost:
          "border-transparent bg-transparent hover:bg-accent hover:text-foreground text-muted-foreground",
        tertiary:
          "border-transparent bg-transparent text-primary hover:bg-selection",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-pressed",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-9 p-0",
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

export { Button };
