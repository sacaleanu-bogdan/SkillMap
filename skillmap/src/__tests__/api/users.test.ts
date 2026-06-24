/**
 * GET /api/users  — list users (role-filtered fields)
 * POST /api/users — create user (admin only)
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/users/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION, MANAGER_SESSION, EMPLOYEE_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/users', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Raw DB row returned by the MATCH query */
const rawUser = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  department: 'Engineering',
  seniority: 'Senior',
  role: 'employee',
  education: null,
  certifications: null,
  languages: null,
  shortDescription: null,
  projectAssignments: null,
}

afterEach(() => jest.clearAllMocks())

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  it('returns 200 with the user list for an employee (no sensitive fields)', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([rawUser])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns 200 with department and role visible to a manager', async () => {
    mockGetServerSession.mockResolvedValueOnce(MANAGER_SESSION)
    mockRunQuery.mockResolvedValueOnce([rawUser])

    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('parses null projectAssignments to an empty array', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ ...rawUser, projectAssignments: null }])

    const res = await GET()
    const body = await res.json()
    expect(body[0].projectAssignments).toEqual([])
  })

  it('parses a valid projectAssignments JSON string', async () => {
    const pa = [{ projectId: 'p1', status: 'current', contribution: 'Lead dev' }]
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ ...rawUser, projectAssignments: JSON.stringify(pa) }])

    const res = await GET()
    const body = await res.json()
    expect(body[0].projectAssignments).toEqual(pa)
  })

  it('falls back to [] for malformed projectAssignments JSON', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ ...rawUser, projectAssignments: '{{{bad json' }])

    const res = await GET()
    const body = await res.json()
    expect(body[0].projectAssignments).toEqual([])
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))
    expect((await GET()).status).toBe(500)
  })
})

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe('POST /api/users', () => {
  const validBody = {
    name: 'Bob',
    email: 'bob@example.com',
    department: 'Design',
    seniority: 'Mid',
    role: 'employee',
  }

  // ── RBAC guards ───────────────────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    expect((await POST(postReq(validBody))).status).toBe(401)
  })

  it('returns 403 when caller is not admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    expect((await POST(postReq(validBody))).status).toBe(403)
  })

  // ── Validation ────────────────────────────────────────────────────────────
  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const { name: _n, ...body } = validBody
    const res = await POST(postReq(body))
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const { email: _e, ...body } = validBody
    const res = await POST(postReq(body))
    expect(res.status).toBe(400)
  })

  it('returns 400 when department is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const { department: _d, ...body } = validBody
    const res = await POST(postReq(body))
    expect(res.status).toBe(400)
  })

  it('returns 400 when seniority is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const { seniority: _s, ...body } = validBody
    const res = await POST(postReq(body))
    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ ...validBody, role: 'superuser' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/role/)
  })

  it('returns 400 when education is not an array', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ ...validBody, education: 'not an array' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when an education entry has an invalid format', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ ...validBody, education: ['bad format'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Invalid education entry/)
  })

  it('returns 400 when projectAssignments is not an array', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ ...validBody, projectAssignments: 'bad' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a projectAssignment has an invalid status', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({
      ...validBody,
      projectAssignments: [{ projectId: 'p1', status: 'invalid' }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a projectAssignment has no projectId', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({
      ...validBody,
      projectAssignments: [{ status: 'current' }],
    }))
    expect(res.status).toBe(400)
  })

  // ── Conflict ─────────────────────────────────────────────────────────────
  it('returns 409 when the email already exists', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 'existing' }]) // duplicate email check

    const res = await POST(postReq(validBody))
    expect(res.status).toBe(409)
  })

  it('returns 409 on a Neo4j constraint violation', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // email check
    mockRunQuery.mockRejectedValueOnce({ code: 'Neo.ClientError.Schema.ConstraintValidationFailed' })

    const res = await POST(postReq(validBody))
    expect(res.status).toBe(409)
  })

  // ── Happy paths ───────────────────────────────────────────────────────────
  it('returns 201 with the created user using minimal fields', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no duplicate
    mockRunQuery.mockResolvedValueOnce([]) // CREATE

    const res = await POST(postReq(validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Bob')
    expect(body.email).toBe('bob@example.com')
    expect(body.id).toBeDefined()
  })

  it('normalises email to lowercase', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([])
    mockRunQuery.mockResolvedValueOnce([])

    const res = await POST(postReq({ ...validBody, email: 'Bob@EXAMPLE.COM' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.email).toBe('bob@example.com')
  })

  it('accepts a valid education entry', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([])
    mockRunQuery.mockResolvedValueOnce([])

    const res = await POST(postReq({
      ...validBody,
      education: ['2018 – 2022: MIT, Computer Science'],
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when certifications is not an array (validateStringArray)', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ ...validBody, certifications: 'not-an-array' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/certifications/)
  })

  it('returns 400 when languages is not an array (validateStringArray)', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ ...validBody, languages: 99 }))
    expect(res.status).toBe(400)
  })

  it('accepts valid projectAssignments and returns them parsed', async () => {
    const pa = [{ projectId: 'p1', status: 'current', contribution: 'Lead dev' }]
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([])
    mockRunQuery.mockResolvedValueOnce([])

    const res = await POST(postReq({ ...validBody, projectAssignments: pa }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.projectAssignments).toEqual(pa)
  })

  it('returns 500 on a non-constraint DB error during CREATE', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // email duplicate check
    mockRunQuery.mockRejectedValueOnce(new Error('DB write error'))
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(500)
  })
})
