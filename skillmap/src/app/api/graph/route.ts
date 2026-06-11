import { NextResponse } from 'next/server'
import { runQuery } from '@/lib/neo4j'
import type { GraphNode, GraphEdge, User, Skill, SkillLevel, SkillSource, Role } from '@/types'

// GET /api/graph
// Returns all users and skills as React Flow nodes, and all HAS_SKILL
// relationships as React Flow edges. Positions are set to {x:0, y:0} —
// the frontend layout algorithm will calculate real positions at render time.
export async function GET() {
  try {
    // Run three focused queries in sequence
    const userRecords = await runQuery<{
      id: string; name: string; department: string; seniority: string; role: Role
    }>(
      `MATCH (u:User)
       RETURN u.id AS id, u.name AS name, u.department AS department,
              u.seniority AS seniority, u.role AS role`
    )

    const skillRecords = await runQuery<{
      id: string; name: string; category: string; icon: string | null
    }>(
      `MATCH (s:Skill)
       RETURN s.id AS id, s.name AS name, s.category AS category, s.icon AS icon`
    )

    const edgeRecords = await runQuery<{
      userId: string; skillId: string; level: SkillLevel; source: SkillSource
    }>(
      `MATCH (u:User)-[r:HAS_SKILL]->(s:Skill)
       RETURN u.id AS userId, s.id AS skillId, r.level AS level, r.source AS source`
    )

    // Map users → GraphNode (prefixed id prevents collisions with skill ids)
    const userNodes: GraphNode[] = userRecords.map((u) => ({
      id: `user-${u.id}`,
      type: 'user',
      data: { label: u.name, meta: u as unknown as User },
      position: { x: 0, y: 0 },
    }))

    // Map skills → GraphNode
    const skillNodes: GraphNode[] = skillRecords.map((s) => ({
      id: `skill-${s.id}`,
      type: 'skill',
      data: { label: s.name, meta: s as unknown as Skill },
      position: { x: 0, y: 0 },
    }))

    // Map relationships → GraphEdge
    const edges: GraphEdge[] = edgeRecords.map((r) => ({
      id: `edge-user-${r.userId}-skill-${r.skillId}`,
      source: `user-${r.userId}`,
      target: `skill-${r.skillId}`,
      data: { level: r.level, source: r.source },
    }))

    return NextResponse.json({
      nodes: [...userNodes, ...skillNodes],
      edges,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
