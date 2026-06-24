// Shared TypeScript types for the SkillMap application

// -------------------------
// Primitive union types
// -------------------------

/** Years of experience with a skill — a non-negative integer (e.g. 0–50). */
export type SkillLevel = number

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
  shortDescription?: string
  /** Structured project assignments; replaces the old flat string[] */
  projectAssignments?: ProjectAssignment[]
}

export interface Skill {
  id: string
  name: string
  category: string
  icon?: string
}

export interface Project {
  id: string
  name: string
  description?: string
}

/** A project assignment on a user — carries allocation status and an optional contribution note */
export interface ProjectAssignment {
  projectId: string
  status: 'current' | 'previous'
  contribution?: string
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

/** A node in the skill graph — a User, Skill, or Project node */
export interface GraphNode {
  id: string
  type: 'user' | 'skill' | 'project'
  data: { label: string; meta: User | Skill | Project }
  position: { x: number; y: number }
}

/** Discriminated union for edge payload — skill edges carry proficiency; project edges are plain membership links */
export type GraphEdgeData =
  | { edgeKind: 'skill'; level: SkillLevel; source: SkillSource }
  | { edgeKind: 'project' }

/** An edge in the skill graph — either User→Skill (HAS_SKILL) or User→Project (member) */
export interface GraphEdge {
  id: string
  source: string
  target: string
  data: GraphEdgeData
}
