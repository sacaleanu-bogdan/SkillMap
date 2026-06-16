import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'

// PATCH /api/projects/[id] — admin only
// Body: { name, description? }
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
    const { name, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }

    const trimmedName = name.trim()

    const existing = await runQuery<{ id: string }>(
      'MATCH (p:Project {id: $id}) RETURN p.id AS id',
      { id }
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Reject name collision with a different project (case-insensitive)
    const duplicate = await runQuery<{ id: string }>(
      'MATCH (p:Project) WHERE toLower(p.name) = toLower($name) AND p.id <> $id RETURN p.id AS id',
      { name: trimmedName, id }
    )
    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 })
    }

    const trimmedDescription = typeof description === 'string' ? description.trim() : null

    await runQuery(
      `MATCH (p:Project {id: $id})
       SET p.name = $name, p.description = $description`,
      { id, name: trimmedName, description: trimmedDescription || null }
    )

    return NextResponse.json({ id, name: trimmedName, description: trimmedDescription || null })
  } catch (error) {
    return apiError(error)
  }
}
