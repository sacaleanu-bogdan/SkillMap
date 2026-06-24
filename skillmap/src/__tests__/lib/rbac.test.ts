import { hasPermission, ROLE_HIERARCHY } from '@/lib/rbac'
import type { Role } from '@/types'

// ─── ROLE_HIERARCHY values ────────────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  it('assigns employee the lowest numeric value (0)', () => {
    expect(ROLE_HIERARCHY.employee).toBe(0)
  })

  it('assigns manager a value above employee', () => {
    expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.employee)
  })

  it('assigns admin the highest numeric value', () => {
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager)
  })
})

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  // Admin — full access
  it('admin meets admin requirement', () => {
    expect(hasPermission('admin', 'admin')).toBe(true)
  })

  it('admin meets manager requirement', () => {
    expect(hasPermission('admin', 'manager')).toBe(true)
  })

  it('admin meets employee requirement', () => {
    expect(hasPermission('admin', 'employee')).toBe(true)
  })

  // Manager — partial access
  it('manager meets manager requirement', () => {
    expect(hasPermission('manager', 'manager')).toBe(true)
  })

  it('manager meets employee requirement', () => {
    expect(hasPermission('manager', 'employee')).toBe(true)
  })

  it('manager does NOT meet admin requirement', () => {
    expect(hasPermission('manager', 'admin')).toBe(false)
  })

  // Employee — lowest tier
  it('employee meets employee requirement', () => {
    expect(hasPermission('employee', 'employee')).toBe(true)
  })

  it('employee does NOT meet manager requirement', () => {
    expect(hasPermission('employee', 'manager')).toBe(false)
  })

  it('employee does NOT meet admin requirement', () => {
    expect(hasPermission('employee', 'admin')).toBe(false)
  })

  // Symmetry / boundary checks
  it('is symmetric for the same role', () => {
    const roles: Role[] = ['admin', 'manager', 'employee']
    for (const role of roles) {
      expect(hasPermission(role, role)).toBe(true)
    }
  })

  it('is strictly ordered: lower role cannot access higher role', () => {
    expect(hasPermission('employee', 'manager')).toBe(false)
    expect(hasPermission('employee', 'admin')).toBe(false)
    expect(hasPermission('manager', 'admin')).toBe(false)
  })
})
