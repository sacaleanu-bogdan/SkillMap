import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { runQuery } from '@/lib/neo4j'
import type { Skill } from '@/types'

// GET /api/skills — returns all skills
export async function GET() {
  try {
    const skills = await runQuery<Skill>(
      `MATCH (s:Skill)
       RETURN s.id AS id, s.name AS name, s.category AS category, s.icon AS icon
       ORDER BY s.name`
    )
    return NextResponse.json(skills)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/skills — create a new skill
// Body: { name, category, icon? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, icon } = body

    // Validate required fields
    if (!name || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category' },
        { status: 400 }
      )
    }

    // Reject duplicate skill names before attempting to create
    const existing = await runQuery<{ id: string }>(
      'MATCH (s:Skill {name: $name}) RETURN s.id AS id',
      { name }
    )
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A skill with this name already exists' },
        { status: 409 }
      )
    }

    const id = randomUUID()

    // Use parameterized query — never interpolate user input
    await runQuery(
      `CREATE (s:Skill { id: $id, name: $name, category: $category, icon: $icon })`,
      { id, name, category, icon: icon ?? null }
    )

    return NextResponse.json({ id, name, category, icon: icon ?? null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
