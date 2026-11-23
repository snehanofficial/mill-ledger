import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}
function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex list-none items-center gap-1", className)}
      {...props}
    />
  );
}
function PaginationItem(props: React.ComponentProps<"li">) {
  return <li {...props} />;
}
function PaginationLink({
  className,
  isActive,
  ...props
}: React.ComponentProps<"a"> & { isActive?: boolean }) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-control border text-body-medium font-semibold",
        isActive
          ? "border-primary bg-selection text-primary"
          : "border-control bg-background text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
function PaginationPrevious(props: React.ComponentProps<"a">) {
  return (
    <PaginationLink aria-label="Go to previous page" {...props}>
      <ChevronLeftIcon className="size-4" />
      <span className="hidden sm:inline">Previous</span>
    </PaginationLink>
  );
}
function PaginationNext(props: React.ComponentProps<"a">) {
  return (
    <PaginationLink aria-label="Go to next page" {...props}>
      <span className="hidden sm:inline">Next</span>
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  );
}
function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 items-center justify-center",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
