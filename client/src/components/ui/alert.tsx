import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const variants = {
  success: {
    icon: CheckCircle2Icon,
    className:
      "border-success-border bg-success-bg text-success dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  warning: {
    icon: AlertTriangleIcon,
    className:
      "border-warning-border bg-warning-bg text-warning dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  danger: {
    icon: AlertCircleIcon,
    className:
      "border-destructive/30 bg-danger-bg text-destructive dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
  info: {
    icon: InfoIcon,
    className:
      "border-info-border bg-info-bg text-info dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  neutral: {
    icon: InfoIcon,
    className:
      "border-neutral-border bg-neutral-bg text-neutral dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  },
};

function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: keyof typeof variants;
  title?: string;
}) {
  const config = variants[variant];
  const Icon = config.icon;
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      data-slot="alert"
      className={cn(
        "flex gap-3 rounded-control border p-3.5 text-sm transition-colors",
        config.className,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? (
          <p className="font-semibold leading-tight text-foreground">{title}</p>
        ) : null}
        {children ? (
          <div className="text-xs leading-normal opacity-90">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export { Alert };
