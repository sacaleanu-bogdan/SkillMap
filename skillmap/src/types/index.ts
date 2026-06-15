// Shared TypeScript types for the SkillMap application

// -------------------------
// Primitive union types
// -------------------------

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type SkillSource = 'manual' | 'git'

export type Role = 'admin' | 'manager' | 'employee'

// -------------------------
// Domain entities
// -------------------------

export interface User {
  id: string
  name: string
  email: string
  department: string
  seniority: string
  role: Role
  googleId?: string
  // Optional profile fields
  // Education entries follow the format: "YYYY – YYYY: University, degree / field"
  education?: string[]
  certifications?: string[]
  languages?: string[]
}

export interface Skill {
  id: string
  name: string
  category: string
  icon?: string
}

// -------------------------
// Graph relationship
// -------------------------

export interface HasSkillRelationship {
  userId: string
  skillId: string
  level: SkillLevel
  source: SkillSource
}

// -------------------------
// React Flow compatible graph shapes
// -------------------------

/** A node in the skill graph — either a User node or a Skill node */
export interface GraphNode {
  id: string
  type: 'user' | 'skill'
  data: { label: string; meta: User | Skill }
  position: { x: number; y: number }
}

/** An edge connecting a User node to a Skill node */
export interface GraphEdge {
  id: string
  source: string  // user node id
  target: string  // skill node id
  data: { level: SkillLevel; source: SkillSource }
}
