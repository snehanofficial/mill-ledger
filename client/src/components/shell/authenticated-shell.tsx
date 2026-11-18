/**
 * MillLedger App Shell
 *
 * Architecture:
 * - Adapts structural primitives from DashboardBlocks app-shell (MIT)
 *   https://www.dashboardblocks.com/docs/components/app-shell
 * - Built on shadcn sidebar component pattern (sidebar-16 layout)
 *   https://ui.shadcn.com/blocks/sidebar
 * - Integrated with React Router v7 createBrowserRouter (useLocation, useMatches)
 * - Tokens from docs/design/milledger-design-system.json (Pine & Paper identity)
 *
 * Design decisions (R-31):
 * - Pine (#176B54) primary: brand identity, selected nav, action hierarchy
 * - Paper (#F4F3EE) background: warm, legible, non-screen-dominant
 * - Sidebar 248px collapsed to 72px icon rail on desktop, sheet on mobile
 * - Header 64px sticky: dimensions reserved unconditionally to prevent CLS
 * - No decorative gradients, blurs, or shadows on the shell chrome
 * - Status elements (sync, notifications) have fixed widths to prevent layout shift
 */

import {
  Fragment,
  type ReactNode,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BellIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  WifiOffIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
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
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  sidebarNavItemClass,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { type NavSection, type UserRole, getNavSections, getAllLinks } from './nav-config'
import { useBreadcrumbs } from './use-breadcrumbs'
import { useConnectionStatus, type SyncState } from './use-connection-status'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShellUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  initials: string
}

interface ShellProps {
  user: ShellUser
  children: ReactNode
  notificationCount?: number
  onSignOut?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActiveHref(href: string, pathname: string): boolean {
  if (href === pathname) return true
  return href !== '/' && pathname.startsWith(`${href.replace(/\/$/, '')}/`)
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── SyncIndicator ────────────────────────────────────────────────────────────
// Fixed-width container so sync state changes never shift surrounding elements.

function SyncIndicator({ state }: { state: SyncState }) {
  const configs: Record<
    SyncState,
    { icon: ReactNode; label: string; color: string }
  > = {
    idle: {
      icon: <span className="size-2 rounded-full bg-success inline-block shrink-0" aria-hidden />,
      label: 'Live',
      color: 'text-muted',
    },
    offline: {
      icon: <WifiOffIcon className="size-3.5" aria-hidden />,
      label: 'Offline',
      color: 'text-warning',
    },
    syncing: {
      icon: <RefreshCwIcon className="size-3.5 animate-spin" aria-hidden />,
      label: 'Syncing',
      color: 'text-muted',
    },
    synced: {
      icon: <CheckCircleIcon className="size-3.5" aria-hidden />,
      label: 'Synced',
      color: 'text-success',
    },
    error: {
      icon: <AlertCircleIcon className="size-3.5" aria-hidden />,
      label: 'Sync error',
      color: 'text-destructive',
    },
    conflict: {
      icon: <AlertCircleIcon className="size-3.5" aria-hidden />,
      label: 'Conflict',
      color: 'text-warning',
    },
  }

  const config = configs[state]
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-1.5 text-caption font-medium', config.color)}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  )
}

// ─── BrandMark ────────────────────────────────────────────────────────────────
// Pine-green square with "M" lettermark. Purposeful: matches brand identity.

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-control',
        'bg-primary text-primary-foreground font-semibold text-label',
        className,
      )}
      aria-hidden
    >
      M
    </span>
  )
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavSection['items'][number]
  pathname: string
}

function AppNavItem({ item, pathname }: NavItemProps) {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  const closeOnMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  const childActive = item.items?.some((c) => isActiveHref(c.href, pathname)) ?? false
  const [expanded, setExpanded] = useState(childActive)
  const [prevChildActive, setPrevChildActive] = useState(childActive)

  // Adjust expansion during render if active child changes
  if (childActive !== prevChildActive) {
    setPrevChildActive(childActive)
    if (childActive) {
      setExpanded(true)
    }
  }

  // No subitems: render as plain link
  if (!item.items?.length) {
    const active = item.href !== undefined && isActiveHref(item.href, pathname)
    const linkEl = (
      <Link
        to={item.href ?? '#'}
        aria-current={item.href === pathname ? 'page' : undefined}
        onClick={closeOnMobile}
        className={sidebarNavItemClass({ isActive: active })}
      >
        {item.icon}
        <span className="group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate">
          {item.label}
        </span>
      </Link>
    )

    return (
      <SidebarMenuItem>
        {isCollapsed && item.label ? (
          <Tooltip>
            <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
            <TooltipContent side="right" align="center">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          linkEl
        )}
        {item.badge !== undefined && (
          <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    )
  }

  // Has subitems: render as collapsible group
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
            tooltip={isCollapsed ? item.label : undefined}
            onClick={() => {
              if (isCollapsed) {
                // When icon-rail is collapsed, expand sidebar first
                // useSidebar setOpen is unavailable here; handled by sidebar auto-expand on click
              }
            }}
          >
            {item.icon}
            <span className="group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate">
              {item.label}
            </span>
            <ChevronRightIcon
              className="ml-auto size-3.5 shrink-0 text-muted group-data-[collapsible=icon]:hidden transition-transform duration-150 group-data-open/collapsible:rotate-90"
              aria-hidden
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <Link
                  to={child.href}
                  aria-current={child.href === pathname ? 'page' : undefined}
                  onClick={closeOnMobile}
                  data-active={isActiveHref(child.href, pathname) || undefined}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded-small px-2 text-body text-muted',
                    'outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                    'transition-colors duration-100 hover:bg-accent hover:text-foreground',
                    'data-[active=true]:text-foreground data-[active=true]:font-medium',
                  )}
                >
                  {child.icon && <span className="shrink-0">{child.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                </Link>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

// ─── AppNav ───────────────────────────────────────────────────────────────────

function AppNav({ sections, pathname }: { sections: NavSection[]; pathname: string }) {
  return (
    <>
      {sections.map((section, index) => (
        <SidebarGroup key={section.label ?? index}>
          {section.label && (
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          )}
          <SidebarMenu>
            {section.items.map((item) => (
              <AppNavItem key={item.label} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

interface UserMenuProps {
  user: ShellUser
  onSignOut?: () => void
}

function UserMenu({ user, onSignOut }: UserMenuProps) {
  const navigate = useNavigate()
  const { isMobile } = useSidebar()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="aria-expanded:bg-muted">
          <UserAvatar user={user} />
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-body-medium font-medium text-foreground">
              {user.name}
            </span>
            <span className="truncate text-caption text-muted">{user.email}</span>
          </div>
          <ChevronsUpDownIcon
            className="ml-auto size-3.5 shrink-0 text-muted group-data-[collapsible=icon]:hidden"
            aria-hidden
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isMobile ? 'bottom' : 'right'}
        className="min-w-56"
      >
        <DropdownMenuLabel className="flex items-center gap-2 font-normal py-2">
          <UserAvatar user={user} size="md" />
          <div className="grid min-w-0">
            <span className="truncate text-body-medium font-medium">{user.name}</span>
            <span className="truncate text-caption text-muted">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/settings/profile')}
          className="cursor-pointer"
        >
          <SettingsIcon className="size-4 text-muted" aria-hidden />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOutIcon className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────

interface UserAvatarProps {
  user: ShellUser
  size?: 'sm' | 'md'
}

function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full bg-primary/10 flex items-center justify-center',
        'text-primary font-semibold',
        size === 'sm' && 'size-7 text-caption',
        size === 'md' && 'size-9 text-label',
      )}
      aria-hidden
    >
      {user.initials || getInitials(user.name)}
    </span>
  )
}

// ─── HeaderNotificationsButton ────────────────────────────────────────────────

interface NotificationsButtonProps {
  count: number
  onClick: () => void
}

function NotificationsButton({ count, onClick }: NotificationsButtonProps) {
  return (
    <button
      type="button"
      aria-label={
        count > 0
          ? `Notifications, ${count} unread`
          : 'Notifications, none unread'
      }
      onClick={onClick}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-control',
        'text-muted hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
        'cursor-pointer transition-colors duration-100',
      )}
    >
      <BellIcon className="size-4" aria-hidden />
      {/* Fixed space for badge to prevent layout shift */}
      <span
        className={cn(
          'absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-background',
          'bg-primary transition-opacity duration-100',
          count > 0 ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />
    </button>
  )
}

// ─── Global Search ────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: NavSection[]
}

function GlobalSearch({ open, onOpenChange, sections }: GlobalSearchProps) {
  const navigate = useNavigate()

  const allItems = sections.flatMap((section) =>
    section.items.flatMap((item) => {
      const links = []
      if (item.href) links.push({ label: item.label, href: item.href, section: section.label ?? 'Navigation' })
      if (item.items) {
        links.push(
          ...item.items.map((sub) => ({
            label: sub.label,
            href: sub.href,
            section: item.label,
          })),
        )
      }
      return links
    }),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg" aria-label="Global search">
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command>
          <CommandInput placeholder="Search pages and actions..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {sections.map((section) => {
              const sectionItems = allItems.filter(
                (i) =>
                  i.section === (section.label ?? 'Navigation') ||
                  section.items.some((si) => si.label === i.section),
              )
              if (!sectionItems.length) return null
              return (
                <CommandGroup key={section.label ?? 'main'} heading={section.label ?? 'Navigation'}>
                  {sectionItems.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={item.label}
                      onSelect={() => {
                        navigate(item.href)
                        onOpenChange(false)
                      }}
                      className="cursor-pointer"
                    >
                      {item.label}
                      <span className="ml-auto text-caption text-muted">{item.section}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

// ─── HeaderSearchButton ───────────────────────────────────────────────────────

function HeaderSearchButton({ onOpen }: { onOpen: () => void }) {
  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpen])

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search (Ctrl+K)"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          'hidden sm:flex items-center gap-2 rounded-control border border-border bg-surface',
          'h-9 pl-3 pr-2 text-body text-muted',
          'hover:bg-accent hover:text-foreground hover:border-control-border',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
          'cursor-pointer transition-colors duration-100 w-52',
        )}
      >
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="flex-1 text-left truncate">Search</span>
        <kbd
          className="ml-auto hidden sm:inline-flex h-5 items-center gap-0.5 rounded bg-surface-muted px-1.5 text-caption font-medium text-muted"
          aria-hidden
        >
          <span>⌘</span>K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label="Search"
        className={cn(
          'flex sm:hidden size-9 items-center justify-center rounded-control text-muted',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
          'cursor-pointer transition-colors duration-100',
        )}
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
      </button>
    </>
  )
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

function ShellBreadcrumbs({ role }: { role: UserRole }) {
  const allLinks = getAllLinks(role)
  const crumbs = useBreadcrumbs(allLinks)

  if (!crumbs.length) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem
                className={cn(
                  'min-w-0',
                  isLast ? 'max-w-full shrink-0' : 'hidden md:inline-flex',
                )}
              >
                {isLast ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild className="truncate">
                    <Link to={crumb.href} className="truncate">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="truncate text-muted" title={crumb.label}>
                    {crumb.label}
                  </span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="hidden md:inline-flex" />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

// ─── StickyHeader ─────────────────────────────────────────────────────────────
// 64px fixed height; all asynchronous status elements use fixed-width containers.

interface StickyHeaderProps {
  user: ShellUser
  notificationCount: number
  onSearchOpen: () => void
  onNotificationsClick: () => void
  onSignOut?: () => void
  syncState: SyncState
}

function StickyHeader({
  user,
  notificationCount,
  onSearchOpen,
  onNotificationsClick,
  onSignOut,
  syncState,
}: StickyHeaderProps) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border',
        'bg-surface px-4',
        // Reserve scroll-padding-top to match header height
        '[html:has(&)]:scroll-pt-16',
      )}
    >
      {/* Mobile: hamburger */}
      {isMobile && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={openMobile}
          onClick={() => setOpenMobile(!openMobile)}
          className={cn(
            'flex size-9 items-center justify-center rounded-control text-muted',
            'hover:bg-accent hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
            'cursor-pointer transition-colors duration-100',
          )}
        >
          <MenuIcon className="size-4" aria-hidden />
        </button>
      )}

      {/* Desktop: sidebar trigger */}
      {!isMobile && <SidebarTrigger />}

      {/* Separator */}
      <div className="h-5 w-px bg-border" aria-hidden />

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ShellBreadcrumbs role={user.role} />
      </div>

      {/* Right: search, sync status, notifications, account */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Sync status: fixed-width area to prevent layout shift */}
        <div className="w-20 flex justify-end">
          <SyncIndicator state={syncState} />
        </div>

        <HeaderSearchButton onOpen={onSearchOpen} />

        <NotificationsButton count={notificationCount} onClick={onNotificationsClick} />

        {/* Account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account: ${user.name}`}
              className={cn(
                'flex size-9 items-center justify-center rounded-full',
                'hover:ring-2 hover:ring-border',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                'cursor-pointer transition-all duration-100',
              )}
            >
              <UserAvatar user={user} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="flex items-center gap-2 font-normal py-2">
              <UserAvatar user={user} size="md" />
              <div className="grid min-w-0">
                <span className="truncate text-body-medium font-medium">{user.name}</span>
                <span className="truncate text-caption text-muted">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <SettingsIcon className="size-4 text-muted" aria-hidden />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOutIcon className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ─── AuthenticatedShell ────────────────────────────────────────────────────────
// The root layout for all authenticated routes.

export function AuthenticatedShell({ user, children, notificationCount = 0, onSignOut }: ShellProps) {
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { syncState } = useConnectionStatus()

  const sections = getNavSections(user.role)

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider userId={user.id}>
        {/* Skip-to-main for keyboard users */}
        <a
          href="#main-content"
          className={cn(
            'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50',
            'focus:rounded-control focus:bg-primary focus:px-4 focus:py-2',
            'focus:text-primary-foreground focus:text-body-medium',
            'focus:shadow-modal focus:outline-none',
          )}
        >
          Skip to main content
        </a>

        {/* Desktop sidebar */}
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link
                  to="/dashboard"
                  className={sidebarNavItemClass({
                    size: 'lg',
                    className: 'flex items-center gap-2.5 px-3 py-2',
                  })}
                  aria-label="MillLedger home"
                >
                  <BrandMark />
                  <div className="grid flex-1 min-w-0 leading-tight group-data-[collapsible=icon]:hidden text-left">
                    <span className="truncate text-body-medium font-semibold text-foreground">
                      MillLedger
                    </span>
                    <span className="truncate text-caption text-muted">Production unit</span>
                  </div>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

        <SidebarContent>
          <AppNav sections={sections} pathname={location.pathname} />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu user={user} onSignOut={onSignOut} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <StickyHeader
          user={user}
          notificationCount={notificationCount}
          onSearchOpen={() => setSearchOpen(true)}
          onNotificationsClick={() => setNotificationsOpen(true)}
          onSignOut={onSignOut}
          syncState={syncState}
        />

        <main
          id="main-content"
          className="flex flex-1 flex-col min-h-0"
          tabIndex={-1}
        >
          {children}
        </main>
      </SidebarInset>

      {/* Global search palette */}
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        sections={sections}
      />

      {/* Notifications panel (sheet) */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-80 p-0">
          <div className="flex h-14 items-center border-b border-border px-5">
            <h2 className="text-body-medium font-semibold">Notifications</h2>
          </div>
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <BellIcon className="mx-auto mb-3 size-8 text-muted" aria-hidden />
              <p className="text-body-medium font-medium text-foreground">No notifications</p>
              <p className="mt-1 text-caption text-muted">
                Activity and system events will appear here.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  </TooltipProvider>
)
}
