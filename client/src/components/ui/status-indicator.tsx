import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  MinusCircleIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const statusConfig = {
  success: { Icon: CheckCircle2Icon, className: "text-success" },
  warning: { Icon: AlertTriangleIcon, className: "text-warning" },
  danger: { Icon: AlertCircleIcon, className: "text-destructive" },
  info: { Icon: InfoIcon, className: "text-info" },
  neutral: { Icon: MinusCircleIcon, className: "text-neutral" },
};

function StatusIndicator({
  status,
  label,
  className,
}: {
  status: keyof typeof statusConfig;
  label: string;
  className?: string;
}) {
  const { Icon, className: statusClassName } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-body-medium font-medium",
        className,
      )}
    >
      <Icon className={cn("size-4", statusClassName)} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export { StatusIndicator };
