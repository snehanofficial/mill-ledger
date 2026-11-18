/**
 * Breadcrumb derivation from route hierarchy.
 *
 * React Router v7 provides `useMatches()` which returns all matched routes.
 * Each route can carry a `handle.breadcrumb` to define its label.
 * This hook walks the matches and builds the breadcrumb trail.
 */

import { useMatches, useLocation } from 'react-router-dom'
import type { NavLink } from './nav-config'

export interface Crumb {
  label: string
  href?: string
}

/** Extend your route handle with this type */
export interface RouteHandle {
  breadcrumb?: string | ((data: unknown) => string)
}

/**
 * Derives breadcrumbs from:
 * 1. React Router matches that carry `handle.breadcrumb`
 * 2. Fallback: match current pathname against known nav links
 */
export function useBreadcrumbs(allLinks?: NavLink[]): Crumb[] {
  const matches = useMatches()
  const location = useLocation()

  // Try route handle-based breadcrumbs first
  const fromHandles = matches
    .filter((m) => {
      const handle = m.handle as RouteHandle | undefined
      return handle?.breadcrumb !== undefined
    })
    .map((m, index, arr) => {
      const handle = m.handle as RouteHandle
      const isLast = index === arr.length - 1
      const label =
        typeof handle.breadcrumb === 'function'
          ? handle.breadcrumb(m.data)
          : (handle.breadcrumb as string)
      return {
        label,
        href: isLast ? undefined : m.pathname,
      }
    })

  if (fromHandles.length > 0) return fromHandles

  // Fallback: match pathname segments against known nav links
  if (!allLinks) return []

  const pathname = location.pathname
  const crumbs: Crumb[] = []

  // Build from most specific to least specific match
  const pathSegments = pathname.split('/').filter(Boolean)
  for (let i = 0; i < pathSegments.length; i++) {
    const partial = '/' + pathSegments.slice(0, i + 1).join('/')
    const match = allLinks.find((l) => l.href === partial)
    if (match) {
      crumbs.push({
        label: match.label,
        href: i < pathSegments.length - 1 ? partial : undefined,
      })
    }
  }

  return crumbs
}
