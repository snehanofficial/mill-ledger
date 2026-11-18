import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      visibleToasts={3}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "rounded-control border border-border bg-surface text-foreground shadow-menu",
          success: "border-success-border bg-success-bg text-success",
          error: "border-destructive/30 bg-danger-bg text-destructive",
          warning: "border-warning-border bg-warning-bg text-warning",
          info: "border-info-border bg-info-bg text-info",
        },
      }}
    />
  );
}

export { Toaster };
