import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'

// Education entry format: "YYYY – YYYY: description" or "YYYY – present: description"
// Accepts both en-dash (–) and hyphen (-) as separators
const EDUCATION_REGEX = /^\d{4}\s*[–-]\s*(\d{4}|present):\s*.+$/i

// PATCH /api/users/[id] — update a user's editable profile fields.
// Authorization: admins can update any user; regular users can only update themselves.
// The following fields are NOT editable: email (OAuth identity), role (admin-only assignment).
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
    const { name, department, seniority, education, certifications, languages } = body

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

    await runQuery(
      `MATCH (u:User {id: $id})
       SET u.name        = $name,
           u.department  = $department,
           u.seniority   = $seniority,
           u.education   = $education,
           u.certifications = $certifications,
           u.languages   = $languages`,
      {
        id,
        name,
        department,
        seniority,
        education: education ?? [],
        certifications: certifications ?? [],
        languages: languages ?? [],
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
