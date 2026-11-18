/**
 * useCurrentUser hook.
 * Provides the authenticated user to the shell and route guards.
 * Integrates with Better Auth's client session.
 *
 * Replace the mock implementation once Better Auth client is wired up.
 */

import { useState, useEffect } from 'react'
import type { ShellUser } from '@/components/shell/authenticated-shell'

interface CurrentUserResult {
  user: ShellUser | null
  isLoading: boolean
}

// TODO: replace with actual Better Auth session hook when auth is implemented
// import { useSession } from '@/lib/auth-client'

export function useCurrentUser(): CurrentUserResult {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<ShellUser | null>(null)

  useEffect(() => {
    // Simulate auth check delay - replace with real session check
    const timer = setTimeout(() => {
      // Mock user for shell development; real implementation reads from Better Auth
      setUser({
        id: 'dev-user-1',
        name: 'Factory Admin',
        email: 'admin@millledger.local',
        role: 'ADMIN',
        initials: 'FA',
      })
      setIsLoading(false)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  return { user, isLoading }
}
