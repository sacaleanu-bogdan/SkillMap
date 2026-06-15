import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'
import type { SkillLevel, SkillSource } from '@/types'

const VALID_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']
const VALID_SOURCES: SkillSource[] = ['manual', 'git']

// GET /api/users/[id]/skills — any authenticated user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Next.js 16: params is a Promise
    const { id } = await params

    const skills = await runQuery<{
      skillId: string
      name: string
      category: string
      level: SkillLevel
      source: SkillSource
    }>(
      `MATCH (u:User {id: $id})-[r:HAS_SKILL]->(s:Skill)
       RETURN s.id AS skillId, s.name AS name, s.category AS category,
              r.level AS level, r.source AS source
       ORDER BY s.name`,
      { id }
    )

    return NextResponse.json(skills)
  } catch (error) {
    return apiError(error)
  }
}

// POST /api/users/[id]/skills — admin only
// Body: { skillId, level, source? }
// Uses MERGE so re-posting the same skillId updates level/source instead of creating duplicates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
  }
  try {
    // Next.js 16: params is a Promise
    const { id: userId } = await params
    const body = await request.json()
    const { skillId, level, source = 'manual' } = body

    // Validate required fields
    if (!skillId || !level) {
      return NextResponse.json(
        { error: 'Missing required fields: skillId, level' },
        { status: 400 }
      )
    }

    if (!VALID_LEVELS.includes(level)) {
      return NextResponse.json(
        { error: `level must be one of: ${VALID_LEVELS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `source must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      )
    }

    // MERGE the relationship so calling this endpoint again updates level/source
    const result = await runQuery<{ found: boolean }>(
      `MATCH (u:User {id: $userId}), (s:Skill {id: $skillId})
       MERGE (u)-[r:HAS_SKILL]->(s)
       SET r.level = $level, r.source = $source
       RETURN true AS found`,
      { userId, skillId, level, source }
    )

    // If MATCH found no user or skill, result will be empty
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'User or Skill not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ userId, skillId, level, source }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
