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
    className: "border-success-border bg-success-bg text-success",
  },
  warning: {
    icon: AlertTriangleIcon,
    className: "border-warning-border bg-warning-bg text-warning",
  },
  danger: {
    icon: AlertCircleIcon,
    className: "border-destructive/30 bg-danger-bg text-destructive",
  },
  info: {
    icon: InfoIcon,
    className: "border-info-border bg-info-bg text-info",
  },
  neutral: {
    icon: InfoIcon,
    className: "border-neutral-border bg-neutral-bg text-neutral",
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
        "flex gap-3 rounded-control border p-4",
        config.className,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? (
          <p className="text-body-medium font-semibold">{title}</p>
        ) : null}
        {children ? <div className="text-body">{children}</div> : null}
      </div>
    </div>
  );
}

export { Alert };
