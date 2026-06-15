import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'

// PATCH /api/skills/[id] — admin only
// Body: { name, category, icon? }
export async function PATCH(
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
    const { id } = await params
    const body = await request.json()
    const { name, category, icon } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category' },
        { status: 400 }
      )
    }

    const existing = await runQuery<{ id: string }>(
      'MATCH (s:Skill {id: $id}) RETURN s.id AS id',
      { id }
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Reject name collision with a different skill (case-insensitive)
    const duplicate = await runQuery<{ id: string }>(
      'MATCH (s:Skill) WHERE toLower(s.name) = toLower($name) AND s.id <> $id RETURN s.id AS id',
      { name, id }
    )
    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'A skill with this name already exists' }, { status: 409 })
    }

    await runQuery(
      `MATCH (s:Skill {id: $id})
       SET s.name = $name, s.category = $category, s.icon = $icon`,
      { id, name, category, icon: icon ?? null }
    )

    return NextResponse.json({ id, name, category, icon: icon ?? null })
  } catch (error) {
    return apiError(error)
  }
}
