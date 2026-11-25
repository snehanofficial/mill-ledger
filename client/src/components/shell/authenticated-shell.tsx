/**
 * MillLedger App Shell
 *
 * Architecture:
 * - Adapts structural primitives from DashboardBlocks app-shell-02 & app-shell-01 (MIT)
 *   https://www.dashboardblocks.com/docs/components/app-shell
 * - Built on official shadcn/ui sidebar component pattern (sidebar-16 layout)
 *   https://ui.shadcn.com/blocks/sidebar
 * - Integrated directly with React Router v7 createBrowserRouter (useLocation, useMatches)
 * - Visual design adapted to docs/design/milledger-design-system.json (Pine & Paper identity)
 *
 * Design features:
 * - Crisp, modern shadcn / DashboardBlocks surfaces with deep Pine (#176B54) primary
 * - Sidebar 248px collapsed to 72px icon rail on desktop, drawer on mobile
 * - Responsive & adaptive: defaults to icons-only mode on tablet viewports (<1024px)
 * - Directed tooltips on hover with arrow pointer for all icons in collapsed mode
 * - Dedicated "Collapse to icons" control + keyboard shortcut (⌘B/Ctrl+B)
 * - Header 64px sticky: dimensions reserved unconditionally to prevent CLS
 * - Status elements (sync, notifications, search) have fixed dimensions to prevent layout shift
 * - Complete WCAG 2.2 AA accessibility, keyboard shortcuts, reduced-motion support
 */

import {
  Fragment,
  memo,
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  BellIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  SettingsIcon,
  WifiOffIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  HomeIcon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  BookOpenIcon,
  HelpCircleIcon,
  SunIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  InfoIcon,
  Trash2Icon,
} from "lucide-react";

import { useLanguage } from "@/lib/i18n";
import { useNotifications } from "@/lib/notifications-store";
import { getPrefetchProps, prefetchIdleRoutes } from "@/lib/route-prefetch";
import { useTheme } from "@/hooks/use-theme";
import { useMotion } from "@/hooks/use-motion";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { HelpGuideModal } from "@/components/help/help-guide-modal";

import {
  type NavSection,
  type UserRole,
  getNavSections,
  getAllLinks,
} from "./nav-config";
import { getDefaultRouteForRole } from "@/lib/role-routing";
import { useBreadcrumbs } from "./use-breadcrumbs";
import { type SyncState } from "./use-connection-status";
import { useSyncManager } from "@/offline/use-offline";
import { DeviceOutboxSheet } from "./device-outbox-sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  initials: string;
}

interface ShellProps {
  user: ShellUser;
  children: ReactNode;
  notificationCount?: number;
  onSignOut?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActiveHref(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  return href !== "/" && pathname.startsWith(`${href.replace(/\/$/, "")}/`);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── SyncIndicator ────────────────────────────────────────────────────────────
// Fixed-width container so sync state changes never shift surrounding elements.

function SyncIndicator({
  state,
  onClick,
  pendingCount,
}: {
  state: SyncState;
  onClick?: () => void;
  pendingCount?: number;
}) {
  const configs: Record<
    SyncState,
    { icon: ReactNode; label: string; color: string }
  > = {
    idle: {
      icon: (
        <span
          className="size-2 rounded-full bg-emerald-500 inline-block shrink-0"
          aria-hidden
        />
      ),
      label: "Live",
      color: "text-muted-foreground",
    },
    offline: {
      icon: <WifiOffIcon className="size-3.5 text-amber-500" aria-hidden />,
      label: "Offline",
      color: "text-amber-600",
    },
    syncing: {
      icon: (
        <RefreshCwIcon
          className="size-3.5 animate-spin text-muted-foreground"
          aria-hidden
        />
      ),
      label: "Syncing",
      color: "text-muted-foreground",
    },
    synced: {
      icon: (
        <CheckCircleIcon className="size-3.5 text-emerald-500" aria-hidden />
      ),
      label: "Synced",
      color: "text-emerald-600",
    },
    error: {
      icon: (
        <AlertCircleIcon className="size-3.5 text-destructive" aria-hidden />
      ),
      label: "Sync error",
      color: "text-destructive",
    },
    conflict: {
      icon: <AlertCircleIcon className="size-3.5 text-amber-500" aria-hidden />,
      label: "Conflict",
      color: "text-amber-600",
    },
  };

  const config = configs[state];
  return (
    <button
      type="button"
      onClick={onClick}
      role="status"
      aria-live="polite"
      aria-label={`Sync state: ${config.label}`}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity focus:outline-hidden",
        config.color,
      )}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
      {pendingCount !== undefined && pendingCount > 0 && (
        <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-2xs font-bold text-amber-700 dark:text-amber-400">
          {pendingCount}
        </span>
      )}
    </button>
  );
}

// ─── BrandMark ────────────────────────────────────────────────────────────────
// Standardized MillLedger brandmark using the custom emblem in /favicon.svg.

function BrandMark({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (children) {
    return (
      <span
        className={cn(
          "bg-primary text-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg font-semibold text-sm",
          className,
        )}
        aria-hidden
      >
        {children}
      </span>
    );
  }

  return <BrandLogo size="md" className={className} />;
}

// ─── AppBrand ─────────────────────────────────────────────────────────────────

function AppBrand({
  href = "/dashboard",
  logo,
  name = "MillLedger",
  description = "Production unit",
}: {
  href?: string;
  logo?: ReactNode;
  name?: string;
  description?: ReactNode;
}) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const closeMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          asChild
          tooltip={isCollapsed ? `${name} (${description})` : undefined}
        >
          <Link
            to={href}
            onClick={closeMobile}
            aria-label={`${name} ${description ? description + " - " : ""}Home`}
            {...getPrefetchProps(href)}
          >
            <BrandMark>{logo}</BrandMark>
            <div className="grid flex-1 min-w-0 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-foreground">
                {name}
              </span>
              {description && (
                <span className="truncate text-xs text-muted-foreground">
                  {description}
                </span>
              )}
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavSection["items"][number];
  pathname: string;
}

function AppNavItem({ item, pathname }: NavItemProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { t } = useLanguage();
  const isCollapsed = state === "collapsed" && !isMobile;

  const closeOnMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const childActive =
    item.items?.some((c) => isActiveHref(c.href, pathname)) ?? false;
  const [expanded, setExpanded] = useState(childActive);
  const [prevChildActive, setPrevChildActive] = useState(childActive);

  if (childActive !== prevChildActive) {
    setPrevChildActive(childActive);
    if (childActive) {
      setExpanded(true);
    }
  }

  const translatedLabel = t(item.label, item.label);

  // No subitems: render as link with directed tooltip in collapsed mode
  if (!item.items?.length) {
    const active = item.href !== undefined && isActiveHref(item.href, pathname);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={isCollapsed ? translatedLabel : undefined}
        >
          <Link
            to={item.href ?? "#"}
            aria-label={translatedLabel}
            aria-current={item.href === pathname ? "page" : undefined}
            onClick={closeOnMobile}
            {...getPrefetchProps(item.href)}
          >
            {item.icon}
            <span className="group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate">
              {translatedLabel}
            </span>
          </Link>
        </SidebarMenuButton>
        {item.badge !== undefined && (
          <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  }

  // Has subitems: render as collapsible group with directed tooltip
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="group/collapsible"
      asChild
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={isCollapsed ? translatedLabel : undefined}
            aria-label={translatedLabel}
          >
            {item.icon}
            <span className="group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate">
              {translatedLabel}
            </span>
            <ChevronRightIcon
              className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden transition-transform duration-200 group-data-open/collapsible:rotate-90"
              aria-hidden
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((child) => {
              const childLabel = t(child.label, child.label);
              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActiveHref(child.href, pathname)}
                  >
                    <Link
                      to={child.href}
                      aria-label={childLabel}
                      aria-current={
                        child.href === pathname ? "page" : undefined
                      }
                      onClick={closeOnMobile}
                      {...getPrefetchProps(child.href)}
                    >
                      {child.icon && (
                        <span className="shrink-0">{child.icon}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {childLabel}
                      </span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── AppNav ───────────────────────────────────────────────────────────────────

const AppNav = memo(function AppNav({
  sections,
  pathname,
}: {
  sections: NavSection[];
  pathname: string;
}) {
  const { t } = useLanguage();
  return (
    <>
      {sections.map((section, index) => (
        <SidebarGroup key={section.label ?? index}>
          {section.label && (
            <SidebarGroupLabel>
              {t(section.label, section.label)}
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {section.items.map((item) => (
              <AppNavItem key={item.label} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
});

// ─── SidebarCollapseToggle ───────────────────────────────────────────────────
// Explicit option to collapse the sidebar to icons only or expand back

function SidebarCollapseToggle() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const { t } = useLanguage();
  if (isMobile) return null;
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="default"
          onClick={toggleSidebar}
          tooltip={
            isCollapsed
              ? t("Expand sidebar (Ctrl+B)", "Expand sidebar (Ctrl+B)")
              : undefined
          }
          aria-label={
            isCollapsed
              ? t("Expand sidebar", "Expand sidebar")
              : t("Collapse to icons ⌘B", "Collapse to icons ⌘B")
          }
          className="text-muted-foreground hover:text-foreground h-8 px-2"
        >
          {isCollapsed ? (
            <PanelLeftOpenIcon
              className="size-4 shrink-0 mx-auto"
              aria-hidden
            />
          ) : (
            <>
              <PanelLeftCloseIcon className="size-4 shrink-0" aria-hidden />
              <span className="group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate text-xs font-normal">
                {t("Collapse to icons", "Collapse to icons")}
              </span>
              <Kbd className="group-data-[collapsible=icon]:hidden ml-auto">
                ⌘B
              </Kbd>
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// ─── SidebarUserMenu ──────────────────────────────────────────────────────────
// Adapted directly from DashboardBlocks SidebarUserMenu

interface SidebarUserMenuProps {
  user: ShellUser;
  onSignOut?: () => void;
  onOpenHelp?: () => void;
}

function SidebarUserMenu({
  user,
  onSignOut,
  onOpenHelp,
}: SidebarUserMenuProps) {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const { t } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { isMotionPaused, toggleMotion } = useMotion();
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={isCollapsed ? `${user.name} (${user.email})` : undefined}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {user.avatar && (
                  <AvatarImage src={user.avatar} alt={user.name} />
                )}
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium text-xs">
                  {user.initials || getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDownIcon
                className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
                aria-hidden
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {user.avatar && (
                    <AvatarImage src={user.avatar} alt={user.name} />
                  )}
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium text-xs">
                    {user.initials || getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                navigate("/settings/profile");
              }}
              className="cursor-pointer"
            >
              <SettingsIcon
                className="mr-2 size-4 text-muted-foreground"
                aria-hidden
              />
              {t("Account settings", "Account settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                onOpenHelp?.();
              }}
              className="cursor-pointer"
            >
              <BookOpenIcon
                className="mr-2 size-4 text-muted-foreground"
                aria-hidden
              />
              {t("Documentation & Guide", "Documentation & Guide")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              {resolvedTheme === "dark" ? (
                <>
                  <SunIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Light mode", "Light mode")}
                </>
              ) : (
                <>
                  <MoonIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Dark mode", "Dark mode")}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleMotion} className="cursor-pointer">
              {isMotionPaused ? (
                <>
                  <PlayIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Resume animations", "Resume animations")}
                </>
              ) : (
                <>
                  <PauseIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Pause animations", "Pause animations")}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOutIcon className="mr-2 size-4" aria-hidden />
              {t("Sign out", "Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// ─── HeaderNotificationsButton ────────────────────────────────────────────────
// DashboardBlocks NotificationsButton pattern

interface NotificationsButtonProps {
  count: number;
  onClick: () => void;
}

function HeaderNotificationsButton({
  count,
  onClick,
}: NotificationsButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={
        count > 0
          ? `Notifications, ${count} unread`
          : "Notifications, none unread"
      }
      className="relative size-9"
    >
      <BellIcon className="size-4" aria-hidden />
      <span
        className={cn(
          "absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-background bg-primary transition-opacity duration-100",
          count > 0 ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
    </Button>
  );
}

// ─── Global Search ────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSection[];
}

function GlobalSearch({ open, onOpenChange, sections }: GlobalSearchProps) {
  const navigate = useNavigate();

  const allItems = sections.flatMap((section) =>
    section.items.flatMap((item) => {
      const links: {
        label: string;
        href: string;
        icon: ReactNode;
        group: string;
      }[] = [];
      if (item.href) {
        links.push({
          label: item.label,
          href: item.href,
          icon: item.icon,
          group: section.label ?? "Navigation",
        });
      }
      if (item.items) {
        links.push(
          ...item.items.map((sub) => ({
            label: sub.label,
            href: sub.href,
            icon: sub.icon ?? item.icon,
            group: section.label ?? "Navigation",
          })),
        );
      }
      return links;
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-lg overflow-hidden border border-border shadow-2xl"
        showCloseButton={false}
        aria-label="Global search"
      >
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command>
          <CommandInput
            placeholder="Search pages and actions..."
            aria-label="Search pages and actions"
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {sections.map((section) => {
              const sectionItems = allItems.filter(
                (i) => i.group === (section.label ?? "Navigation"),
              );
              if (!sectionItems.length) return null;
              return (
                <CommandGroup
                  key={section.label ?? "main"}
                  heading={section.label ?? "Navigation"}
                >
                  {sectionItems.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.group}`}
                      onSelect={() => {
                        navigate(item.href);
                        onOpenChange(false);
                      }}
                    >
                      <span className="text-muted-foreground shrink-0">
                        {item.icon}
                      </span>
                      <span className="font-medium text-foreground">
                        {item.label}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// ─── HeaderSearchButton ───────────────────────────────────────────────────────
// DashboardBlocks SearchButton with ⌘K badge and responsive behavior

function HeaderSearchButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpen}
        aria-label={t("Search (Ctrl+K)", "Search (Ctrl+K)")}
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden sm:flex w-52 justify-start text-muted-foreground hover:text-foreground h-9 px-3"
      >
        <SearchIcon className="mr-2 size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left truncate font-normal">
          {t("Search", "Search")}
        </span>
        <Kbd className="ml-auto">⌘K</Kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpen}
        aria-label={t("Search", "Search")}
        className="sm:hidden size-9"
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
      </Button>
    </>
  );
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

function ShellBreadcrumbs({ role }: { role: UserRole }) {
  const allLinks = getAllLinks(role);
  const crumbs = useBreadcrumbs(allLinks);
  const { t } = useLanguage();

  if (!crumbs.length) return null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const translatedCrumb = t(crumb.label, crumb.label);
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem
                className={cn(
                  "min-w-0",
                  isLast ? "max-w-full shrink-0" : "hidden md:inline-flex",
                )}
              >
                {isLast ? (
                  <BreadcrumbPage className="truncate">
                    {translatedCrumb}
                  </BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild className="truncate">
                    <Link
                      to={crumb.href}
                      className="truncate"
                      {...getPrefetchProps(crumb.href)}
                    >
                      {translatedCrumb}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span
                    className="truncate text-muted-foreground"
                    title={translatedCrumb}
                  >
                    {translatedCrumb}
                  </span>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator className="hidden md:inline-flex" />
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// ─── StickyHeader ─────────────────────────────────────────────────────────────
// 64px fixed height sticky header matching DashboardBlocks AppHeader pattern

interface StickyHeaderProps {
  user: ShellUser;
  notificationCount: number;
  onSearchOpen: () => void;
  onNotificationsClick: () => void;
  onSignOut?: () => void;
  onOpenHelp?: () => void;
  syncState: SyncState;
  onOpenOutbox?: () => void;
  pendingCount?: number;
}

function StickyHeader({
  user,
  notificationCount,
  onSearchOpen,
  onNotificationsClick,
  onSignOut,
  onOpenHelp,
  syncState,
  onOpenOutbox,
  pendingCount,
}: StickyHeaderProps) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const { language, setLanguage, t } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { isMotionPaused, toggleMotion } = useMotion();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border",
        "bg-background px-4 [html:has(&)]:scroll-pt-16",
      )}
    >
      {/* Mobile: hamburger button */}
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          aria-expanded={openMobile}
          onClick={() => setOpenMobile(!openMobile)}
          className="-ml-2 size-9"
        >
          <MenuIcon className="size-4" aria-hidden />
        </Button>
      ) : (
        <SidebarTrigger className="-ml-1" />
      )}

      {/* DashboardBlocks Separator */}
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ShellBreadcrumbs role={user.role} />
      </div>

      {/* Right-side tools: language, sync, search, notifications, account menu */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Language switch toggle (WCAG 2.2 SC 3.1.2 Level AA / F-060) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === "en" ? "ta" : "en")}
          aria-label={
            language === "en"
              ? "தமிழ் - Switch language to Tamil"
              : "EN - Switch language to English"
          }
          className="h-8 px-2 text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <span lang={language === "en" ? "ta" : "en"}>
            {language === "en" ? "தமிழ்" : "EN"}
          </span>
        </Button>

        {/* Theme switch toggle (F-050) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={
            resolvedTheme === "dark"
              ? t("Switch to light mode", "Switch to light mode")
              : t("Switch to dark mode", "Switch to dark mode")
          }
          title={
            resolvedTheme === "dark"
              ? t("Switch to light mode", "Switch to light mode")
              : t("Switch to dark mode", "Switch to dark mode")
          }
          className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {resolvedTheme === "dark" ? (
            <SunIcon className="size-4" aria-hidden="true" />
          ) : (
            <MoonIcon className="size-4" aria-hidden="true" />
          )}
        </Button>

        {/* Motion pause/resume toggle (F-062: WCAG 2.2 SC 2.2.2 Pause, Stop, Hide) */}
        <Button
          variant="ghost"
          size="icon"
          data-pause-motion
          onClick={toggleMotion}
          aria-label={
            isMotionPaused
              ? t("Resume animations", "Resume animations")
              : t("Pause animations", "Pause animations")
          }
          title={
            isMotionPaused
              ? t("Resume animations", "Resume animations")
              : t(
                  "Pause animations (WCAG 2.2.2)",
                  "Pause animations (WCAG 2.2.2)",
                )
          }
          className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {isMotionPaused ? (
            <PlayIcon className="size-4" aria-hidden="true" />
          ) : (
            <PauseIcon className="size-4" aria-hidden="true" />
          )}
        </Button>

        {/* Sync status: fixed-width area to prevent layout shift */}
        <div className="min-w-20 flex justify-end">
          <SyncIndicator
            state={syncState}
            onClick={onOpenOutbox}
            pendingCount={pendingCount}
          />
        </div>

        <HeaderSearchButton onOpen={onSearchOpen} />

        <HeaderNotificationsButton
          count={notificationCount}
          onClick={onNotificationsClick}
        />

        {/* Documentation & Help Guide Trigger (F-049) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenHelp}
          aria-label={t("Help and Documentation", "Help and Documentation")}
          title={t("Help and Documentation", "Help and Documentation")}
          className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <HelpCircleIcon className="size-4" aria-hidden="true" />
        </Button>

        {/* Top-right user avatar menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-8 rounded-full"
              aria-label={`Account: ${user.name}`}
            >
              <Avatar className="size-8">
                {user.avatar && (
                  <AvatarImage src={user.avatar} alt={user.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                  {user.initials || getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {user.avatar && (
                    <AvatarImage src={user.avatar} alt={user.name} />
                  )}
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium text-xs">
                    {user.initials || getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <SettingsIcon
                className="mr-2 size-4 text-muted-foreground"
                aria-hidden
              />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenHelp} className="cursor-pointer">
              <BookOpenIcon
                className="mr-2 size-4 text-muted-foreground"
                aria-hidden
              />
              Documentation & Guide
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              {resolvedTheme === "dark" ? (
                <>
                  <SunIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Light mode", "Light mode")}
                </>
              ) : (
                <>
                  <MoonIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Dark mode", "Dark mode")}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleMotion} className="cursor-pointer">
              {isMotionPaused ? (
                <>
                  <PlayIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Resume animations", "Resume animations")}
                </>
              ) : (
                <>
                  <PauseIcon
                    className="mr-2 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {t("Pause animations", "Pause animations")}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOutIcon className="mr-2 size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ─── MobileBottomNav ─────────────────────────────────────────────────────────
// Accessible touch-first navigation bar on mobile viewports (<768px)

function MobileBottomNav({ role }: { role: UserRole }) {
  const location = useLocation();
  const { t } = useLanguage();
  const { setOpenMobile } = useSidebar();

  const homeHref = getDefaultRouteForRole(role);

  let navItems: Array<{
    label: string;
    href?: string;
    icon: typeof HomeIcon;
    action?: () => void;
  }> = [];

  if (role === "SALESMAN") {
    navItems = [
      { label: t("nav.home", "Home"), href: homeHref, icon: HomeIcon },
      {
        label: t("nav.orders", "Orders"),
        href: "/orders",
        icon: ShoppingCartIcon,
      },
      {
        label: t("nav.customers", "Customers"),
        href: "/customers",
        icon: UsersIcon,
      },
      {
        label: t("nav.more", "More"),
        action: () => setOpenMobile(true),
        icon: MenuIcon,
      },
    ];
  } else if (role === "PRODUCTION") {
    navItems = [
      { label: t("nav.home", "Home"), href: homeHref, icon: HomeIcon },
      { label: t("nav.stock", "Stock"), href: "/stock", icon: PackageIcon },
      {
        label: t("nav.production", "Production"),
        href: "/production/today",
        icon: PackageIcon,
      },
      {
        label: t("nav.more", "More"),
        action: () => setOpenMobile(true),
        icon: MenuIcon,
      },
    ];
  } else if (role === "ACCOUNTANT") {
    navItems = [
      { label: t("nav.home", "Home"), href: homeHref, icon: HomeIcon },
      {
        label: t("nav.orders", "Orders"),
        href: "/orders",
        icon: ShoppingCartIcon,
      },
      {
        label: t("nav.payments", "Payments"),
        href: "/payments",
        icon: PackageIcon,
      },
      {
        label: t("nav.more", "More"),
        action: () => setOpenMobile(true),
        icon: MenuIcon,
      },
    ];
  } else {
    // ADMIN / OWNER
    navItems = [
      { label: t("nav.home", "Home"), href: homeHref, icon: HomeIcon },
      {
        label: t("nav.orders", "Orders"),
        href: "/orders",
        icon: ShoppingCartIcon,
      },
      { label: t("nav.stock", "Stock"), href: "/stock", icon: PackageIcon },
      {
        label: t("nav.more", "More"),
        action: () => setOpenMobile(true),
        icon: MenuIcon,
      },
    ];
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-background/95 backdrop-blur-xs px-2 pb-[env(safe-area-inset-bottom)] shadow-lg"
    >
      {navItems.map((item, idx) => {
        const isActive = item.href && location.pathname === item.href;
        const Icon = item.icon;

        if (item.action) {
          return (
            <button
              key={idx}
              type="button"
              onClick={item.action}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] cursor-pointer"
              aria-label={item.label}
            >
              <Icon className="size-5" aria-hidden />
              <span className="text-2xs font-medium">{item.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={idx}
            to={item.href!}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors min-h-[44px]",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
            {...getPrefetchProps(item.href)}
          >
            <Icon className="size-5" aria-hidden />
            <span className="text-2xs">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ─── AuthenticatedShell ────────────────────────────────────────────────────────
// Root layout for all authenticated routes

export function AuthenticatedShell({
  user,
  children,
  notificationCount = 0,
  onSignOut,
}: ShellProps) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const { language } = useLanguage();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const syncManager = useSyncManager(user.id);
  const { syncState, isOnline, pendingCount, conflictCount } = syncManager;

  const handleSafeSignOut = () => {
    if (pendingCount > 0) {
      setConfirmLogoutOpen(true);
    } else {
      onSignOut?.();
    }
  };

  const sections = useMemo(() => getNavSections(user.role), [user.role]);
  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
  const handleOpenNotifications = useCallback(() => setNotificationsOpen(true), []);
  const handleOpenOutbox = useCallback(() => setOutboxOpen(true), []);
  const handleOpenHelp = useCallback(() => setShowHelpModal(true), []);

  // Intent-based and idle route prefetching (F-076)
  useEffect(() => {
    prefetchIdleRoutes();
  }, []);

  return (
    <TooltipProvider delayDuration={100}>
      <SidebarProvider userId={user.id}>
        {/* Skip-to-main for keyboard accessibility (WCAG 2.2 SC 2.4.1) */}
        <a
          href="#main-content"
          className={cn(
            "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
            "focus:rounded-md focus:bg-primary focus:px-4 focus:py-2",
            "focus:text-primary-foreground focus:text-sm focus:font-medium",
            "focus:shadow-lg focus:outline-none",
          )}
        >
          {language === "ta"
            ? "முதன்மை பகுதிக்குச் செல்லவும்"
            : "Skip to main content"}
        </a>

        {/* Desktop & mobile sidebar */}
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <AppBrand
              href={getDefaultRouteForRole(user.role)}
              name="MillLedger"
              description="Production unit"
            />
          </SidebarHeader>

          <SidebarContent>
            <AppNav sections={sections} pathname={location.pathname} />
          </SidebarContent>

          <SidebarFooter>
            <SidebarCollapseToggle />
            <SidebarUserMenu
              user={user}
              onSignOut={handleSafeSignOut}
              onOpenHelp={handleOpenHelp}
            />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0">
          <StickyHeader
            user={user}
            notificationCount={unreadCount || notificationCount}
            onSearchOpen={handleOpenSearch}
            onNotificationsClick={handleOpenNotifications}
            onSignOut={handleSafeSignOut}
            onOpenHelp={handleOpenHelp}
            syncState={syncState}
            onOpenOutbox={handleOpenOutbox}
            pendingCount={pendingCount}
          />

          {/* Offline / Pending Outbox Notification Banner */}
          {(!isOnline || pendingCount > 0 || conflictCount > 0) && (
            <div
              role="status"
              className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex items-center justify-between text-amber-800 dark:text-amber-300 shrink-0"
            >
              <div className="flex items-center gap-2">
                {!isOnline ? (
                  <WifiOffIcon
                    className="size-4 shrink-0 text-amber-600"
                    aria-hidden
                  />
                ) : conflictCount > 0 ? (
                  <AlertCircleIcon
                    className="size-4 shrink-0 text-destructive"
                    aria-hidden
                  />
                ) : (
                  <RefreshCwIcon
                    className="size-4 shrink-0 animate-spin text-amber-600"
                    aria-hidden
                  />
                )}
                <span>
                  {!isOnline
                    ? "Working offline. Orders created are stored securely on this device and will sync when reconnected."
                    : conflictCount > 0
                      ? `${conflictCount} order(s) encountered conflicts during synchronization. Click to resolve.`
                      : `${pendingCount} order(s) waiting to sync.`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isOnline && pendingCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={syncManager.syncNow}
                    disabled={syncManager.syncing}
                    className="h-8 min-h-[32px] px-2.5 text-xs font-medium cursor-pointer sm:h-7 sm:min-h-[28px] sm:px-2"
                  >
                    Sync now
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOutboxOpen(true)}
                  className="h-8 min-h-[32px] px-2.5 text-xs cursor-pointer sm:h-7 sm:min-h-[28px] sm:px-2"
                >
                  View outbox
                </Button>
              </div>
            </div>
          )}

          <main
            id="main-content"
            className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden pb-16 md:pb-0"
            tabIndex={-1}
          >
            {children}
          </main>
        </SidebarInset>

        {/* Mobile bottom navigation bar for small touch viewports */}
        <MobileBottomNav role={user.role} />

        {/* Global Toast Notifications */}
        <Toaster />

        {/* Global search palette */}
        {searchOpen && (
          <GlobalSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            sections={sections}
          />
        )}

        {/* Device Outbox Sheet */}
        {outboxOpen && (
          <DeviceOutboxSheet
            open={outboxOpen}
            onOpenChange={setOutboxOpen}
            userId={user.id}
          />
        )}

        {/* Confirm Logout Dialog if unsynced orders exist */}
        {confirmLogoutOpen && (
          <Dialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Pending orders stored locally</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              You have {pendingCount} unsynced order(s) stored on this device.
              They are preserved securely for your account and will sync when
              you sign back in. Do you still wish to sign out?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmLogoutOpen(false)}
              >
                Stay signed in
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmLogoutOpen(false);
                  onSignOut?.();
                }}
              >
                Sign out anyway
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}

        {/* Notifications sheet (F-065) */}
        {notificationsOpen && (
        <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <SheetContent
            side="right"
            className="flex w-84 max-w-full flex-col p-0"
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2">
                <BellIcon
                  className="size-4 text-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-bold text-primary">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="h-8 min-h-[32px] px-2.5 text-xs text-muted-foreground hover:text-foreground sm:h-7 sm:min-h-[28px] sm:px-2"
                  >
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearNotifications}
                    aria-label="Clear all notifications"
                    title="Clear all notifications"
                    className="size-8 min-h-8 min-w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {notifications.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <BellIcon
                    className="mb-3 size-8 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-foreground">
                    No notifications
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Activity and system events will appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={cn(
                        "group relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                        n.read
                          ? "border-border/60 bg-card/60 opacity-80"
                          : "border-primary/30 bg-card shadow-xs",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {n.type === "success" && (
                            <CheckCircleIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {n.type === "error" && (
                            <AlertCircleIcon className="size-4 shrink-0 text-destructive" />
                          )}
                          {n.type === "warning" && (
                            <AlertCircleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          )}
                          {n.type === "info" && (
                            <InfoIcon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                          )}
                          <span
                            className={cn(
                              "text-xs font-semibold leading-tight",
                              n.read
                                ? "text-muted-foreground"
                                : "text-foreground",
                            )}
                          >
                            {n.title}
                          </span>
                        </div>
                        {!n.read && (
                          <span
                            className="size-2 shrink-0 rounded-full bg-primary"
                            title="Unread"
                          />
                        )}
                      </div>
                      {n.description && (
                        <p className="text-2xs text-muted-foreground pl-6">
                          {n.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pl-6 pt-1 text-3xs text-muted-foreground">
                        <span>
                          {new Date(n.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="capitalize">{n.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        )}

        {/* Operational Documentation & Guide Modal (F-049) */}
        {showHelpModal && (
          <HelpGuideModal open={showHelpModal} onOpenChange={setShowHelpModal} />
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
}
