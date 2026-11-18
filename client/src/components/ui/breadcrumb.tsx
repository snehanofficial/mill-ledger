import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-caption text-muted", className)}
      {...props}
    />
  );
}
function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
function BreadcrumbItem(props: React.ComponentProps<"li">) {
  return <li className="inline-flex items-center gap-2" {...props} />;
}
function BreadcrumbLink(props: React.ComponentProps<"a">) {
  return (
    <a
      className="hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      {...props}
    />
  );
}
function BreadcrumbPage(props: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className="font-semibold text-foreground"
      {...props}
    />
  );
}
function BreadcrumbSeparator(props: React.ComponentProps<"li">) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className="inline-flex"
      {...props}
    >
      <ChevronRightIcon className="size-4" />
    </li>
  );
}
function BreadcrumbEllipsis(props: React.ComponentProps<"span">) {
  return (
    <span
      aria-label="More breadcrumb items"
      className="inline-flex size-11 items-center justify-center"
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
