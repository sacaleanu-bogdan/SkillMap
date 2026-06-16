import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import type { GraphNode, GraphEdge, User, Skill, SkillLevel, SkillSource, Role } from '@/types'

// GET /api/graph — any authenticated user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only manager+ receives department and role in graph node metadata (VULN-002)
  const canSeeSensitive = hasPermission(session.user.role, 'manager')
  try {
    // Run three independent queries in parallel for lower latency
    const [userRecords, skillRecords, edgeRecords] = await Promise.all([
      runQuery<{ id: string; name: string; department?: string; seniority: string; role?: Role }>(
        canSeeSensitive
          ? `MATCH (u:User)
             RETURN u.id AS id, u.name AS name, u.department AS department,
                    u.seniority AS seniority, u.role AS role`
          : `MATCH (u:User)
             RETURN u.id AS id, u.name AS name, u.seniority AS seniority`
      ),
      runQuery<{ id: string; name: string; category: string; icon: string | null }>(
        `MATCH (s:Skill)
         RETURN s.id AS id, s.name AS name, s.category AS category, s.icon AS icon`
      ),
      runQuery<{ userId: string; skillId: string; level: SkillLevel; source: SkillSource }>(
        `MATCH (u:User)-[r:HAS_SKILL]->(s:Skill)
         RETURN u.id AS userId, s.id AS skillId, r.level AS level, r.source AS source`
      ),
    ])

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
    return apiError(error)
  }
}
