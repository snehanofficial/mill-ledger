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
      "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 [&>svg]:text-emerald-700",
  },
  warning: {
    icon: AlertTriangleIcon,
    className:
      "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 [&>svg]:text-amber-700",
  },
  danger: {
    icon: AlertCircleIcon,
    className:
      "border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200 [&>svg]:text-red-700",
  },
  info: {
    icon: InfoIcon,
    className:
      "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200 [&>svg]:text-blue-700",
  },
  neutral: {
    icon: InfoIcon,
    className:
      "border-zinc-300 bg-zinc-50 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 [&>svg]:text-zinc-700",
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
      role={
        props.role ||
        (variant === "danger" || variant === "warning" ? "alert" : "status")
      }
      aria-live={
        props["aria-live"] || (variant === "danger" ? "assertive" : "polite")
      }
      data-slot="alert"
      className={cn(
        "flex gap-3 rounded-control border p-4 text-sm transition-colors shadow-xs",
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
