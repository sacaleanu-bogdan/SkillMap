/**
 * Shared test utilities for API route handler tests.
 * Provides typed mocks for getServerSession and runQuery.
 */
import type { Session } from 'next-auth'
import type { Role } from '@/types'

/** Build a minimal NextAuth session for a given role */
export function makeSession(role: Role = 'employee', email = `${role}@example.com`): Session {
  return {
    user: { name: 'Test User', email, role },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  }
}

export const ADMIN_SESSION = makeSession('admin', 'admin@example.com')
export const MANAGER_SESSION = makeSession('manager', 'manager@example.com')
export const EMPLOYEE_SESSION = makeSession('employee', 'employee@example.com')
