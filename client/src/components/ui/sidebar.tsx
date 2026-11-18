/**
 * Sidebar primitives for MillLedger.
 *
 * Architecture: adapted from shadcn sidebar pattern (sidebar-16 layout).
 * https://ui.shadcn.com/blocks/sidebar
 *
 * State persistence: localStorage (client-side only, no SSR cookies).
 * Flicker prevention: initial state read synchronously from localStorage.
 * Keyboard shortcut: Ctrl/Cmd + B toggles sidebar.
 * Mobile: overlay sheet at <768px. Desktop: icon rail (72px) or expanded (248px).
 */

import {
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_COOKIE_KEY = "ml-sidebar-expanded";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SIDEBAR_WIDTH = "248px";
const SIDEBAR_WIDTH_ICON = "72px";
const SIDEBAR_WIDTH_MOBILE = "288px";

// ─── Context ──────────────────────────────────────────────────────────────────

type SidebarContext = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContext | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}

// ─── Mobile detection ─────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
      : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function readPersistedOpen(userId?: string): boolean {
  try {
    const key = userId ? `${SIDEBAR_COOKIE_KEY}-${userId}` : SIDEBAR_COOKIE_KEY;
    const val = localStorage.getItem(key);
    if (val !== null) return val === "true";
    // Responsive adaptive default: on tablet / small screens (<1024px), adapt to icons-only mode
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

function persistOpen(open: boolean, userId?: string) {
  try {
    const key = userId ? `${SIDEBAR_COOKIE_KEY}-${userId}` : SIDEBAR_COOKIE_KEY;
    localStorage.setItem(key, String(open));
  } catch {
    // ignore
  }
}

// ─── SidebarProvider ──────────────────────────────────────────────────────────

interface SidebarProviderProps {
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: CSSProperties;
  className?: string;
  userId?: string;
}

export function SidebarProvider({
  children,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  style,
  className,
  userId,
}: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  const [_open, _setOpen] = useState(() => {
    if (controlledOpen !== undefined) return controlledOpen;
    if (defaultOpen !== undefined) return defaultOpen;
    return readPersistedOpen(userId);
  });

  const open = controlledOpen ?? _open;

  const setOpen = useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        _setOpen(value);
        persistOpen(value, userId);
      }
    },
    [onOpenChange, userId],
  );

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen(!open);
    }
  }, [isMobile, open, setOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const ctx = useMemo<SidebarContext>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={ctx}>
      <TooltipPrimitive.Provider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper flex h-svh max-h-svh w-full overflow-hidden",
            className,
          )}
        >
          {children}
        </div>
      </TooltipPrimitive.Provider>
    </SidebarContext.Provider>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps extends ComponentProps<"div"> {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}

export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "icon",
  className,
  children,
  ...props
}: SidebarProps) {
  const { state, openMobile, setOpenMobile, isMobile } = useSidebar();

  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div
            className="fixed inset-0 z-50 bg-foreground/40"
            onClick={() => setOpenMobile(false)}
            aria-hidden="true"
          />
        )}
        <div
          data-slot="sidebar"
          data-state={openMobile ? "open" : "closed"}
          aria-hidden={!openMobile}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border shadow-2xl",
            "transition-transform duration-220 motion-reduce:transition-none",
            openMobile ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ width: SIDEBAR_WIDTH_MOBILE }}
          {...props}
        >
          {children}
        </div>
      </>
    );
  }

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "flex h-full flex-col bg-sidebar border-r border-sidebar-border",
          className,
        )}
        style={{ width: SIDEBAR_WIDTH }}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-side={side}
      data-variant={variant}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      className={cn(
        "group hidden md:flex h-svh flex-col bg-sidebar border-r border-sidebar-border",
        "transition-[width] duration-220 ease-[cubic-bezier(0.2,0,0,1)]",
        "motion-reduce:transition-none shrink-0",
        state === "expanded" ? "overflow-visible" : "overflow-hidden",
        variant === "floating" &&
          "rounded-panel border shadow-menu m-2 h-[calc(100svh-1rem)]",
        className,
      )}
      style={{
        width:
          state === "expanded"
            ? SIDEBAR_WIDTH
            : collapsible === "icon"
              ? SIDEBAR_WIDTH_ICON
              : 0,
        minWidth:
          state === "expanded"
            ? SIDEBAR_WIDTH
            : collapsible === "icon"
              ? SIDEBAR_WIDTH_ICON
              : 0,
        maxWidth:
          state === "expanded"
            ? SIDEBAR_WIDTH
            : collapsible === "icon"
              ? SIDEBAR_WIDTH_ICON
              : 0,
        ...props.style,
      }}
      {...props}
    >
      <div
        data-slot="sidebar-inner"
        className="flex h-full w-full flex-col min-w-0 overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
}

// ─── SidebarTrigger ───────────────────────────────────────────────────────────

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-slot="sidebar-trigger"
      type="button"
      aria-label="Toggle sidebar"
      aria-keyshortcuts="Meta+B Control+B"
      onClick={(e) => {
        onClick?.(e);
        toggleSidebar();
      }}
      className={cn(
        "flex size-9 items-center justify-center rounded-md text-muted-foreground",
        "hover:bg-accent hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "cursor-pointer transition-colors",
        className,
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
    </button>
  );
}

// ─── SidebarInset ─────────────────────────────────────────────────────────────

export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex h-svh max-h-svh flex-1 flex-col bg-background overflow-hidden min-w-0",
        className,
      )}
      {...props}
    />
  );
}

// ─── SidebarHeader / Footer / Content ─────────────────────────────────────────

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex flex-col gap-2 p-2 shrink-0 bg-sidebar border-b border-sidebar-border/40 z-10",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "flex flex-col gap-2 p-2 shrink-0 bg-sidebar border-t border-sidebar-border/40 z-10",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] py-1",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarSeparator({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-separator"
      className={cn("mx-2 h-px bg-border", className)}
      {...props}
    />
  );
}

// ─── SidebarGroup ─────────────────────────────────────────────────────────────

export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-0.5 px-2 py-1", className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 py-1 text-xs font-semibold text-sidebar-foreground uppercase tracking-wider",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
}

// ─── SidebarMenu ──────────────────────────────────────────────────────────────

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

// ─── SidebarMenuButton ────────────────────────────────────────────────────────

interface SidebarMenuButtonProps extends ComponentProps<"button"> {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
  size?: "default" | "lg" | "sm";
}

/** Shared Tailwind classes for sidebar nav items (button and link variants). */
export function sidebarNavItemClass(opts?: {
  size?: "default" | "lg" | "sm";
  isActive?: boolean;
  className?: string;
}) {
  const { size = "default", isActive, className } = opts ?? {};
  return cn(
    "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md text-left text-sm outline-none transition-colors duration-100 cursor-pointer",
    "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
    size === "default" && "h-9 px-3",
    size === "lg" && "h-12 px-3",
    size === "sm" && "h-7 px-2 text-xs",
    "group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto",
    className,
  );
}

export const SidebarMenuButton = forwardRef<
  HTMLElement,
  SidebarMenuButtonProps
>(
  (
    {
      asChild = false,
      className,
      isActive,
      tooltip,
      size = "default",
      children,
      ...props
    },
    ref,
  ) => {
    const { state, isMobile } = useSidebar();
    const isCollapsed = state === "collapsed" && !isMobile;
    const navClass = sidebarNavItemClass({ size, isActive, className });

    let element: ReactNode;
    if (asChild && isValidElement(children)) {
      element = cloneElement(
        children as ReactElement<Record<string, unknown>>,
        {
          className: cn(
            navClass,
            (children.props as { className?: string }).className,
          ),
          "data-slot": "sidebar-menu-button",
          "data-active": isActive || undefined,
          ref: ref as unknown as Ref<never>,
        },
      );
    } else {
      element = (
        <button
          ref={ref as unknown as Ref<HTMLButtonElement>}
          data-slot="sidebar-menu-button"
          data-active={isActive || undefined}
          type="button"
          className={navClass}
          {...props}
        >
          {children}
        </button>
      );
    }

    if (tooltip && isCollapsed) {
      return (
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>{element}</TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="right"
              align="center"
              sideOffset={8}
              className="z-50 flex items-center rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-md animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2"
            >
              {tooltip}
              <TooltipPrimitive.Arrow
                className="fill-foreground"
                width={8}
                height={4}
              />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      );
    }

    return element;
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

// ─── SidebarMenuBadge ─────────────────────────────────────────────────────────

export function SidebarMenuBadge({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        "ml-auto text-caption font-semibold",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

// ─── SidebarMenuSub ───────────────────────────────────────────────────────────

export function SidebarMenuSub({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        "mx-3.5 flex flex-col gap-0.5 border-l border-border pl-3",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuSubItem({
  className,
  ...props
}: ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

export function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive,
  className,
  children,
  ...props
}: ComponentProps<"a"> & {
  asChild?: boolean;
  size?: "sm" | "md";
  isActive?: boolean;
}) {
  const subClass = cn(
    "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground",
    "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium",
    size === "sm" && "text-xs",
    size === "md" && "text-sm",
    className,
  );

  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<Record<string, unknown>>, {
      className: cn(
        subClass,
        (children.props as { className?: string }).className,
      ),
      "data-slot": "sidebar-menu-sub-button",
      "data-active": isActive || undefined,
    });
  }

  return (
    <a
      data-slot="sidebar-menu-sub-button"
      data-active={isActive || undefined}
      className={subClass}
      {...props}
    >
      {children}
    </a>
  );
}

// ─── SidebarRail ──────────────────────────────────────────────────────────────

export function SidebarRail({ className, ...props }: ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-slot="sidebar-rail"
      type="button"
      aria-label="Resize sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Resize sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 cursor-col-resize",
        "transition-all ease-linear",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5",
        "hover:after:bg-border group-data-[side=left]:right-0 md:flex",
        className,
      )}
      {...props}
    />
  );
}
