import * as React from "react";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1.5 sm:gap-2", className)}
      {...props}
    />
  );
}

function BreadcrumbItem(props: React.ComponentProps<"li">) {
  return (
    <li className="inline-flex items-center gap-1.5 sm:gap-2" {...props} />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  children,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ className?: string }>,
      {
        className: cn(
          "transition-colors hover:text-foreground text-muted-foreground font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm inline-flex items-center min-h-6 min-w-6 py-0.5",
          (children.props as { className?: string }).className,
          className,
        ),
      },
    );
  }
  return (
    <a
      className={cn(
        "transition-colors hover:text-foreground text-muted-foreground font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm inline-flex items-center min-h-6 min-w-6 py-0.5",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn(
        "inline-flex items-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      <ChevronRightIcon className="size-3.5" />
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-label="More breadcrumb items"
      className={cn(
        "inline-flex size-9 items-center justify-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
