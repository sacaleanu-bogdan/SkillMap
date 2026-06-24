/**
 * GET & PATCH /api/users/[id]
 */
import { NextRequest } from 'next/server'
import { GET, PATCH } from '@/app/api/users/[id]/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION, EMPLOYEE_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

function patchReq(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return [req, { params: Promise.resolve({ id }) }]
}

const validBody = {
  name: 'Alice Updated',
  department: 'Engineering',
  seniority: 'Senior',
}

// The EMPLOYEE_SESSION email matches the user being patched (ownership)
const ownerEmail = EMPLOYEE_SESSION.user?.email as string

afterEach(() => jest.clearAllMocks())

describe('PATCH /api/users/[id]', () => {
  // ── Auth guards ───────────────────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = patchReq('u1', validBody)
    expect((await PATCH(req, ctx)).status).toBe(401)
  })

  it('returns 404 when the user does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // MATCH → empty

    const [req, ctx] = patchReq('nonexistent', validBody)
    expect((await PATCH(req, ctx)).status).toBe(404)
  })

  it('returns 403 when caller is not admin and not the owner', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    // User exists but belongs to a different email
    mockRunQuery.mockResolvedValueOnce([{ email: 'someone-else@example.com' }])

    const [req, ctx] = patchReq('u1', validBody)
    expect((await PATCH(req, ctx)).status).toBe(403)
  })

  // ── Validation ────────────────────────────────────────────────────────────
  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', { department: 'Eng', seniority: 'Senior' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 when education is not an array', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', { ...validBody, education: 'not an array' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 for an invalid education entry format', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', { ...validBody, education: ['no format match'] })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 when certifications is not an array', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', { ...validBody, certifications: 'bad' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 when projectAssignments is not an array', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', { ...validBody, projectAssignments: 'bad' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 when a projectAssignment has invalid status', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', {
      ...validBody,
      projectAssignments: [{ projectId: 'p1', status: 'ongoing' }],
    })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 when certifications exceed max items (validateStringArray)', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const tooMany = Array.from({ length: 51 }, (_, i) => `cert-${i}`)
    const [req, ctx] = patchReq('u1', { ...validBody, certifications: tooMany })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/certifications/)
  })

  it('returns 400 when shortDescription is too long (validateOptionalString)', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = patchReq('u1', { ...validBody, shortDescription: 'a'.repeat(1001) })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  // ── Happy paths ───────────────────────────────────────────────────────────
  it('returns 200 when the owner updates their own profile', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    // User's email matches session email → owner
    mockRunQuery.mockResolvedValueOnce([{ email: ownerEmail }])
    mockRunQuery.mockResolvedValueOnce([]) // SET

    const [req, ctx] = patchReq('u1', validBody)
    expect((await PATCH(req, ctx)).status).toBe(200)
  })

  it('returns 200 when admin updates any user', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    mockRunQuery.mockResolvedValueOnce([]) // SET

    const [req, ctx] = patchReq('u1', validBody)
    expect((await PATCH(req, ctx)).status).toBe(200)
  })

  it('admin can update the role field', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    const setSpy = mockRunQuery.mockResolvedValueOnce([])

    const [req, ctx] = patchReq('u1', { ...validBody, role: 'manager' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    // The SET query should include the role param
    const lastCall = setSpy.mock.calls[setSpy.mock.calls.length - 1]
    expect(lastCall[1]).toMatchObject({ role: 'manager' })
  })

  it('non-admin role changes are silently ignored', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: ownerEmail }])
    const setSpy = mockRunQuery.mockResolvedValueOnce([])

    const [req, ctx] = patchReq('u1', { ...validBody, role: 'admin' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    // The SET query should NOT include role
    const lastCall = setSpy.mock.calls[setSpy.mock.calls.length - 1]
    expect(lastCall[1]).not.toHaveProperty('role')
  })

  it('accepts valid projectAssignments and derives flat projectIds', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    const setSpy = mockRunQuery.mockResolvedValueOnce([])

    const pa = [
      { projectId: 'p1', status: 'current' },
      { projectId: 'p2', status: 'previous', contribution: 'Led migration' },
    ]
    const [req, ctx] = patchReq('u1', { ...validBody, projectAssignments: pa })
    await PATCH(req, ctx)

    const lastCall = setSpy.mock.calls[setSpy.mock.calls.length - 1]
    expect(lastCall[1]).toMatchObject({ projects: ['p1', 'p2'] })
    expect(JSON.parse(lastCall[1].projectAssignments as string)).toEqual(pa)
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const [req, ctx] = patchReq('u1', validBody)
    expect((await PATCH(req, ctx)).status).toBe(500)
  })
})

// ─── GET /api/users/[id] ─────────────────────────────────────────────────────

function getReq(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost/api/users/${id}`),
    { params: Promise.resolve({ id }) },
  ]
}

describe('GET /api/users/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = getReq('u1')
    expect((await GET(req, ctx)).status).toBe(401)
  })

  it('returns 404 when the user does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // empty result

    const [req, ctx] = getReq('nonexistent')
    expect((await GET(req, ctx)).status).toBe(404)
  })

  it('returns public profile fields to an employee', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{
      id: 'u1', name: 'Alice', email: 'alice@example.com',
      department: 'Engineering', seniority: 'Senior', role: 'employee',
      education: ['2018 – 2022: MIT, CS'], certifications: ['AWS SAA'],
      languages: ['English'], shortDescription: 'Full-stack dev',
      projectAssignments: '[]',
    }])

    const [req, ctx] = getReq('u1')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Alice')
    expect(body.education).toEqual(['2018 – 2022: MIT, CS'])
    // Sensitive fields must be absent for employee role
    expect(body.email).toBeUndefined()
    expect(body.role).toBeUndefined()
  })

  it('returns email and role to an admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{
      id: 'u1', name: 'Alice', email: 'alice@example.com',
      department: 'Engineering', seniority: 'Senior', role: 'employee',
      education: null, certifications: null, languages: null,
      shortDescription: null, projectAssignments: null,
    }])

    const [req, ctx] = getReq('u1')
    const body = await (await GET(req, ctx)).json()
    expect(body.email).toBe('alice@example.com')
    expect(body.role).toBe('employee')
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const [req, ctx] = getReq('u1')
    expect((await GET(req, ctx)).status).toBe(500)
  })
})
