import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}
function DrawerTrigger(
  props: React.ComponentProps<typeof DrawerPrimitive.Trigger>,
) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}
function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45" />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-panel border border-border bg-surface p-5 shadow-modal",
          className,
        )}
        {...props}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}
function DrawerTitle(
  props: React.ComponentProps<typeof DrawerPrimitive.Title>,
) {
  return (
    <DrawerPrimitive.Title
      className="text-section-title font-semibold"
      {...props}
    />
  );
}
function DrawerDescription(
  props: React.ComponentProps<typeof DrawerPrimitive.Description>,
) {
  return (
    <DrawerPrimitive.Description className="text-body text-muted" {...props} />
  );
}
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2", className)} {...props} />
  );
}
function DrawerClose(
  props: React.ComponentProps<typeof DrawerPrimitive.Close>,
) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};
