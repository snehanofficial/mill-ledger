import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Sheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetContent({
  className,
  side = "right",
  children,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-(--ml-motion-overlay-enter) data-[state=open]:ease-enter data-[state=closed]:duration-(--ml-motion-overlay-exit) data-[state=closed]:ease-exit" />
      <DialogPrimitive.Content
        ref={contentRef}
        tabIndex={-1}
        data-slot="sheet-content"
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e);
          if (e.defaultPrevented) return;
          if (
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(pointer: coarse)").matches
          ) {
            e.preventDefault();
            contentRef.current?.focus({ preventScroll: true });
          }
        }}
        className={cn(
          "fixed z-50 max-h-dvh overflow-y-auto overscroll-contain border-border bg-surface p-4 sm:p-5 shadow-modal outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=open]:duration-(--ml-motion-overlay-enter) data-[state=open]:ease-enter",
          "data-[state=closed]:duration-(--ml-motion-overlay-exit) data-[state=closed]:ease-exit",
          side === "right" &&
            "inset-y-0 right-0 w-full max-w-md border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          side === "left" &&
            "inset-y-0 left-0 w-full max-w-md border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          side === "top" &&
            "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close panel"
          className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          <XIcon className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2 pr-12", className)} {...props} />
  );
}

function SheetTitle(props: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className="text-section-title font-semibold"
      {...props}
    />
  );
}

function SheetDescription(
  props: React.ComponentProps<typeof DialogPrimitive.Description>,
) {
  return (
    <DialogPrimitive.Description
      className="text-body text-muted-foreground"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
