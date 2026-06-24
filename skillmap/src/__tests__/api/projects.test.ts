/**
 * GET /api/projects   — list projects
 * POST /api/projects  — create project (admin only)
 * PATCH /api/projects/[id] — update project (admin only)
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/projects/route'
import { PATCH } from '@/app/api/projects/[id]/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION, EMPLOYEE_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function patchReq(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return [req, { params: Promise.resolve({ id }) }]
}

afterEach(() => jest.clearAllMocks())

// ─── GET /api/projects ────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  it('returns 200 with the list of projects', async () => {
    const projects = [
      { id: 'p1', name: 'Alpha', description: 'First project' },
      { id: 'p2', name: 'Beta', description: null },
    ]
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce(projects)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(projects)
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))
    expect((await GET()).status).toBe(500)
  })
})

// ─── POST /api/projects ───────────────────────────────────────────────────────

describe('POST /api/projects', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    expect((await POST(postReq({ name: 'Alpha' }))).status).toBe(401)
  })

  it('returns 403 when caller is not admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    expect((await POST(postReq({ name: 'Alpha' }))).status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/)
  })

  it('returns 400 when name is an empty string', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const res = await POST(postReq({ name: '   ' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when a project with that name already exists', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 'existing-id' }]) // duplicate check
    const res = await POST(postReq({ name: 'Alpha' }))
    expect(res.status).toBe(409)
  })

  it('returns 409 on a Neo4j constraint violation', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no duplicate
    mockRunQuery.mockRejectedValueOnce({ code: 'Neo.ClientError.Schema.ConstraintValidationFailed' })
    const res = await POST(postReq({ name: 'Alpha' }))
    expect(res.status).toBe(409)
  })

  it('returns 201 with the created project (with description)', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no duplicate
    mockRunQuery.mockResolvedValueOnce([]) // CREATE

    const res = await POST(postReq({ name: '  Gamma  ', description: 'A project' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Gamma') // trimmed
    expect(body.description).toBe('A project')
    expect(body.id).toBeDefined()
  })

  it('returns 201 with null description when description is empty', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([])
    mockRunQuery.mockResolvedValueOnce([])

    const res = await POST(postReq({ name: 'Delta', description: '' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.description).toBeNull()
  })

  it('returns 500 when a non-constraint DB error occurs in POST', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // duplicate check passes
    mockRunQuery.mockRejectedValueOnce(new Error('Connection timeout')) // CREATE throws
    const res = await POST(postReq({ name: 'Gamma' }))
    expect(res.status).toBe(500)
  })
})

// ─── PATCH /api/projects/[id] ─────────────────────────────────────────────────

describe('PATCH /api/projects/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = patchReq('p1', { name: 'Updated' })
    expect((await PATCH(req, ctx)).status).toBe(401)
  })

  it('returns 403 when caller is not admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    const [req, ctx] = patchReq('p1', { name: 'Updated' })
    expect((await PATCH(req, ctx)).status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const [req, ctx] = patchReq('p1', {})
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is blank', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const [req, ctx] = patchReq('p1', { name: '   ' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 404 when the project does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // exists check → empty

    const [req, ctx] = patchReq('nonexistent', { name: 'New Name' })
    expect((await PATCH(req, ctx)).status).toBe(404)
  })

  it('returns 409 when another project has the same name', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 'p1' }]) // exists
    mockRunQuery.mockResolvedValueOnce([{ id: 'p2' }]) // duplicate name check

    const [req, ctx] = patchReq('p1', { name: 'Taken Name' })
    expect((await PATCH(req, ctx)).status).toBe(409)
  })

  it('returns 200 with the updated project', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 'p1' }]) // exists
    mockRunQuery.mockResolvedValueOnce([])              // no name collision
    mockRunQuery.mockResolvedValueOnce([])              // SET

    const [req, ctx] = patchReq('p1', { name: 'Updated Name', description: 'New desc' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated Name')
    expect(body.description).toBe('New desc')
  })

  it('returns 500 on a database error during SET', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 'p1' }]) // exists
    mockRunQuery.mockResolvedValueOnce([])              // no name collision
    mockRunQuery.mockRejectedValueOnce(new Error('DB error')) // SET throws

    const [req, ctx] = patchReq('p1', { name: 'New Name' })
    expect((await PATCH(req, ctx)).status).toBe(500)
  })
})
