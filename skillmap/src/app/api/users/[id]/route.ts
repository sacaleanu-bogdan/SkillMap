import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { apiError } from '@/lib/api'
import { validateStringArray, validateOptionalString } from '@/lib/validation'
import type { Role, ProjectAssignment } from '@/types'

const VALID_ROLES: Role[] = ['admin', 'manager', 'employee']
const VALID_PA_STATUSES = ['current', 'previous'] as const

// Education entry format: "YYYY – YYYY: description" or "YYYY – present: description"
// Accepts both en-dash (–) and hyphen (-) as separators
const EDUCATION_REGEX = /^\d{4}\s*[–-]\s*(\d{4}|present):\s*.+$/i

// PATCH /api/users/[id] — update a user's editable profile fields.
// Authorization: admins can update any user; regular users can only update themselves.
// The following fields are NOT editable: email (OAuth identity).
// Admins can also update the role field; regular users cannot.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Fetch the target user's email so we can verify ownership
  const records = await runQuery<{ email: string }>(
    'MATCH (u:User {id: $id}) RETURN u.email AS email',
    { id }
  )
  if (records.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isAdmin = session.user.role === 'admin'
  const isOwner = records[0].email === session.user.email
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, department, seniority, education, certifications, languages, role, shortDescription, projectAssignments } = body

    if (!name || !department || !seniority) {
      return NextResponse.json(
        { error: 'Missing required fields: name, department, seniority' },
        { status: 400 }
      )
    }

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

    if (certifications !== undefined && !Array.isArray(certifications)) {
      return NextResponse.json({ error: 'certifications must be an array of strings' }, { status: 400 })
    }
    if (languages !== undefined && !Array.isArray(languages)) {
      return NextResponse.json({ error: 'languages must be an array of strings' }, { status: 400 })
    }

    // Validate bounded length on array and string fields (VULN-010)
    for (const [field, value] of [['certifications', certifications], ['languages', languages]] as [string, unknown][]) {
      const err = validateStringArray(field, value)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    const descErr = validateOptionalString('shortDescription', shortDescription)
    if (descErr) return NextResponse.json({ error: descErr }, { status: 400 })

    // Validate projectAssignments structure
    if (projectAssignments !== undefined) {
      if (!Array.isArray(projectAssignments)) {
        return NextResponse.json({ error: 'projectAssignments must be an array' }, { status: 400 })
      }
      for (const pa of projectAssignments as ProjectAssignment[]) {
        if (!pa.projectId || !VALID_PA_STATUSES.includes(pa.status)) {
          return NextResponse.json({ error: 'Each projectAssignment must have projectId and status (current|previous)' }, { status: 400 })
        }
      }
    }

    // Admins can update role; for non-admins the field is silently ignored
    let newRole: Role | undefined
    if (isAdmin && role !== undefined) {
      if (!VALID_ROLES.includes(role as Role)) {
        return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
      }
      newRole = role as Role
    }

    const paArray: ProjectAssignment[] = Array.isArray(projectAssignments) ? projectAssignments : []
    const paJson = JSON.stringify(paArray)
    const projectIds = paArray.map((pa) => pa.projectId)

    const queryParams: Record<string, unknown> = {
      id,
      name,
      department,
      seniority,
      education: education ?? [],
      certifications: certifications ?? [],
      languages: languages ?? [],
      shortDescription: typeof shortDescription === 'string' ? shortDescription.trim() : '',
      projectAssignments: paJson,
      projects: projectIds,
    }
    let setClause = `u.name = $name, u.department = $department, u.seniority = $seniority, u.education = $education, u.certifications = $certifications, u.languages = $languages, u.shortDescription = $shortDescription, u.projectAssignments = $projectAssignments, u.projects = $projects`
    if (newRole !== undefined) {
      setClause += ', u.role = $role'
      queryParams.role = newRole
    }

    await runQuery(`MATCH (u:User {id: $id}) SET ${setClause}`, queryParams)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
