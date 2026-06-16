import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'
import type { User } from '@/types'

// GET /api/users/me — returns the current user's full profile from Neo4j, looked up by OAuth email
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runQuery<User>(
      `MATCH (u:User {email: $email})
       RETURN u.id AS id, u.name AS name, u.email AS email,
              u.department AS department, u.seniority AS seniority,
              u.role AS role, u.education AS education,
              u.certifications AS certifications, u.languages AS languages`,
      { email: session.user.email }
    )

    if (results.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(results[0])
  } catch (error) {
    // Use the shared apiError helper — logs internally, never leaks DB details to client (VULN-005)
    return apiError(error)
  }
}
