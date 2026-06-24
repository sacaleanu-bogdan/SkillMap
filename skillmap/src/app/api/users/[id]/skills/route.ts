import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'
import type { SkillSource } from '@/types'

const MAX_SKILL_YEARS = 50
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
      level: number
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

// POST /api/users/[id]/skills — admin OR the user themselves
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
  try {
    const { id: userId } = await params

    // Fetch the target user's email to verify ownership
    const records = await runQuery<{ email: string }>(
      'MATCH (u:User {id: $id}) RETURN u.email AS email',
      { id: userId }
    )
    if (records.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'admin'
    const isOwner = records[0].email === session.user.email
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { skillId, level, source = 'manual' } = body

    if (!skillId || !level) {
      return NextResponse.json(
        { error: 'Missing required fields: skillId, level' },
        { status: 400 }
      )
    }

    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > MAX_SKILL_YEARS) {
      return NextResponse.json(
        { error: `level must be a whole number of years between 0 and ${MAX_SKILL_YEARS}` },
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

// DELETE /api/users/[id]/skills?skillId=xxx — admin OR the user themselves
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id: userId } = await params
    const skillId = request.nextUrl.searchParams.get('skillId')
    if (!skillId) {
      return NextResponse.json({ error: 'Missing query parameter: skillId' }, { status: 400 })
    }

    // Fetch the target user's email to verify ownership
    const records = await runQuery<{ email: string }>(
      'MATCH (u:User {id: $id}) RETURN u.email AS email',
      { id: userId }
    )
    if (records.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'admin'
    const isOwner = records[0].email === session.user.email
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await runQuery(
      `MATCH (u:User {id: $userId})-[r:HAS_SKILL]->(s:Skill {id: $skillId})
       DELETE r`,
      { userId, skillId }
    )

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return apiError(error)
  }
}
