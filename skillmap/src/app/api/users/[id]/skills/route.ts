import { NextRequest, NextResponse } from 'next/server'
import { runQuery } from '@/lib/neo4j'
import type { SkillLevel, SkillSource } from '@/types'

const VALID_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']
const VALID_SOURCES: SkillSource[] = ['manual', 'git']

// GET /api/users/[id]/skills — list all skills assigned to a user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/users/[id]/skills — assign (or update) a skill for a user
// Body: { skillId, level, source? }
// Uses MERGE so re-posting the same skillId updates level/source instead of creating duplicates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
