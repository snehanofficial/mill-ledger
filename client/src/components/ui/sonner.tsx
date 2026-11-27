import { useEffect } from "react";
import { Toaster as Sonner } from "sonner";
import { installToastInterceptor } from "@/lib/notifications-store";

function Toaster() {
  useEffect(() => {
    installToastInterceptor();

    // Enhance Sonner toasts with role="status", aria-live="polite", and keyboard focus pausing
    const enhanceToasts = () => {
      const toasts = document.querySelectorAll<HTMLElement>(
        "[data-sonner-toast]",
      );
      toasts.forEach((toast) => {
        if (!toast.getAttribute("role")) {
          toast.setAttribute("role", "status");
          toast.setAttribute("aria-live", "polite");
          toast.setAttribute("aria-atomic", "true");
        }
      });
    };

    enhanceToasts();

    const observer = new MutationObserver(() => {
      enhanceToasts();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Pause toast dismissal when keyboard focus enters any toast item
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-sonner-toast]")) {
        const toaster = document.querySelector<HTMLElement>(
          "[data-sonner-toaster]",
        );
        if (toaster) {
          toaster.dispatchEvent(
            new MouseEvent("mouseenter", { bubbles: true }),
          );
        }
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related?.closest("[data-sonner-toast]")) {
        const toaster = document.querySelector<HTMLElement>(
          "[data-sonner-toaster]",
        );
        if (toaster) {
          toaster.dispatchEvent(
            new MouseEvent("mouseleave", { bubbles: true }),
          );
        }
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <Sonner
      position="bottom-right"
      visibleToasts={4}
      duration={6000}
      richColors
      containerAriaLabel="Notifications"
      toastOptions={{
        duration: 6000,
        className: "font-sans shadow-xl rounded-xl text-sm font-medium border",
        classNames: {
          toast:
            "group toast bg-card text-foreground border-border shadow-xl rounded-xl p-4",
          title: "font-semibold text-sm",
          description: "text-xs opacity-90",
          actionButton:
            "bg-primary text-primary-foreground text-xs font-semibold rounded-md px-3 py-1.5",
          cancelButton:
            "bg-muted text-muted-foreground text-xs font-medium rounded-md px-3 py-1.5",
          success:
            "!bg-emerald-50 !text-emerald-950 !border-emerald-300 dark:!bg-emerald-950 dark:!text-emerald-100 dark:!border-emerald-800 [&>[data-icon]]:!text-emerald-700",
          error:
            "!bg-red-50 !text-red-950 !border-red-300 dark:!bg-red-950 dark:!text-red-100 dark:!border-red-800 [&>[data-icon]]:!text-red-700",
          warning:
            "!bg-amber-50 !text-amber-950 !border-amber-300 dark:!bg-amber-950 dark:!text-amber-100 dark:!border-amber-800 [&>[data-icon]]:!text-amber-700",
          info: "!bg-blue-50 !text-blue-950 !border-blue-300 dark:!bg-blue-950 dark:!text-blue-100 dark:!border-blue-800 [&>[data-icon]]:!text-blue-700",
        },
      }}
    />
  );
}

export { Toaster };
