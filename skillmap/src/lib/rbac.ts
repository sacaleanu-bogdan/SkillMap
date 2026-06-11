// Auth integration will wire session.user.role here in a future phase
import type { Role } from '@/types'

export type { Role }

// Numeric hierarchy — higher value = more permissive
export const ROLE_HIERARCHY: Record<Role, number> = {
  employee: 0,
  manager: 1,
  admin: 2,
}

/**
 * Returns true if the given userRole meets or exceeds the requiredRole.
 *
 * @param userRole    - The role of the currently authenticated user.
 * @param requiredRole - The minimum role required to perform an action.
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}
