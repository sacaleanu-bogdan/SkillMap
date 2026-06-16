import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError, isConstraintError } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import { validateStringArray, validateOptionalString } from '@/lib/validation'
import type { Role } from '@/types'

const VALID_ROLES: Role[] = ['admin', 'manager', 'employee']

// GET /api/users — any authenticated user can list users
// department and role are only returned to manager+ (VULN-002 privacy)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // manager and admin can see department and role; employees cannot
  const canSeeSensitive = hasPermission(session.user.role, 'manager')
  try {
    const users = await runQuery<{
      id: string
      name: string
      department?: string
      seniority: string
      role?: Role
      education: string[] | null
      certifications: string[] | null
      languages: string[] | null
      shortDescription: string | null
      projects: string[] | null
    }>(
      canSeeSensitive
        ? `MATCH (u:User)
           RETURN u.id AS id, u.name AS name, u.department AS department,
                  u.seniority AS seniority, u.role AS role,
                  u.education AS education, u.certifications AS certifications,
                  u.languages AS languages,
                  u.shortDescription AS shortDescription, u.projects AS projects
           ORDER BY u.name`
        : `MATCH (u:User)
           RETURN u.id AS id, u.name AS name,
                  u.seniority AS seniority,
                  u.education AS education, u.certifications AS certifications,
                  u.languages AS languages,
                  u.shortDescription AS shortDescription, u.projects AS projects
           ORDER BY u.name`
    )
    return NextResponse.json(users)
  } catch (error) {
    return apiError(error)
  }
}

// Education entry format: "YYYY – YYYY: description" or "YYYY – present: description"
// Accepts both en-dash (–) and hyphen (-) as separators
const EDUCATION_REGEX = /^\d{4}\s*[–-]\s*(\d{4}|present):\s*.+$/i

// POST /api/users — admin only
// Body: { name, email, department, seniority, role, education?, certifications?, languages? }
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
    const { name, email: rawEmail, department, seniority, role, education, certifications, languages, shortDescription, projects } = body

    // Normalize email to lowercase so duplicates are caught regardless of input casing
    const email = typeof rawEmail === 'string' ? rawEmail.toLowerCase().trim() : rawEmail

    // Validate required fields
    if (!name || !email || !department || !seniority || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, department, seniority, role' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate education entries if provided
    if (education !== undefined) {
      if (!Array.isArray(education)) {
        return NextResponse.json({ error: 'education must be an array of strings' }, { status: 400 })
      }
      const invalid = (education as string[]).find((e) => !EDUCATION_REGEX.test(e))
      if (invalid) {
        return NextResponse.json(
          { error: `Invalid education entry: "${invalid}". Expected format: "YYYY – YYYY: University, degree / field"` },
          { status: 400 }
        )
      }
    }

    // Validate certifications, languages, and projects are bounded string arrays (VULN-010)
    for (const [field, value] of [['certifications', certifications], ['languages', languages], ['projects', projects]] as [string, unknown][]) {
      const err = validateStringArray(field, value)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    const descErr = validateOptionalString('shortDescription', shortDescription)
    if (descErr) return NextResponse.json({ error: descErr }, { status: 400 })

    // Reject duplicate emails before attempting to create
    const existing = await runQuery<{ id: string }>(
      'MATCH (u:User {email: $email}) RETURN u.id AS id',
      { email }
    )
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    const id = randomUUID()
    // Store optional arrays/strings as null when not provided so the property is always present
    const edu: string[] = education ?? []
    const certs: string[] = certifications ?? []
    const langs: string[] = languages ?? []
    const desc: string = typeof shortDescription === 'string' ? shortDescription.trim() : ''
    const projs: string[] = projects ?? []

    // Use parameterized query — never interpolate user input
    await runQuery(
      `CREATE (u:User {
         id: $id, name: $name, email: $email,
         department: $department, seniority: $seniority, role: $role,
         education: $education, certifications: $certifications, languages: $languages,
         shortDescription: $shortDescription, projects: $projects
       })`,
      { id, name, email, department, seniority, role, education: edu, certifications: certs, languages: langs, shortDescription: desc, projects: projs }
    )

    return NextResponse.json(
      { id, name, email, department, seniority, role, education: edu, certifications: certs, languages: langs, shortDescription: desc, projects: projs },
      { status: 201 }
    )
  } catch (error) {
    if (isConstraintError(error)) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    return apiError(error)
  }
}
