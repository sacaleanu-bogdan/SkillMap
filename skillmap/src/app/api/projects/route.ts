import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError, isConstraintError } from '@/lib/api'
import type { Project } from '@/types'

// GET /api/projects — any authenticated user can list projects
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const projects = await runQuery<Project>(
      `MATCH (p:Project)
       RETURN p.id AS id, p.name AS name, p.description AS description
       ORDER BY p.name`
    )
    return NextResponse.json(projects)
  } catch (error) {
    return apiError(error)
  }
}

// POST /api/projects — admin only
// Body: { name, description? }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Reject duplicate project names (case-insensitive)
    const existing = await runQuery<{ id: string }>(
      'MATCH (p:Project) WHERE toLower(p.name) = toLower($name) RETURN p.id AS id',
      { name: trimmedName }
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 })
    }

    const id = randomUUID()
    await runQuery(
      `CREATE (p:Project { id: $id, name: $name, description: $description })`,
      { id, name: trimmedName, description: typeof description === 'string' ? description.trim() : null }
    )

    return NextResponse.json(
      { id, name: trimmedName, description: typeof description === 'string' ? description.trim() || null : null },
      { status: 201 }
    )
  } catch (error) {
    if (isConstraintError(error)) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 })
    }
    return apiError(error)
  }
}
