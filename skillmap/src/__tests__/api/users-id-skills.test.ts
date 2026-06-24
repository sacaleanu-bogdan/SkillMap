/**
 * GET    /api/users/[id]/skills — list user's skills
 * POST   /api/users/[id]/skills — assign a skill (admin or owner)
 * DELETE /api/users/[id]/skills?skillId=xxx — remove a skill (admin or owner)
 */
import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '@/app/api/users/[id]/skills/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION, EMPLOYEE_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

const ownerEmail = EMPLOYEE_SESSION.user?.email as string

function getReq(userId: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost/api/users/${userId}/skills`),
    { params: Promise.resolve({ id: userId }) },
  ]
}

function postReq(userId: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost/api/users/${userId}/skills`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: userId }) },
  ]
}

function deleteReq(userId: string, skillId?: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const url = skillId
    ? `http://localhost/api/users/${userId}/skills?skillId=${skillId}`
    : `http://localhost/api/users/${userId}/skills`
  return [
    new NextRequest(url, { method: 'DELETE' }),
    { params: Promise.resolve({ id: userId }) },
  ]
}

afterEach(() => jest.clearAllMocks())

// ─── GET /api/users/[id]/skills ───────────────────────────────────────────────

describe('GET /api/users/[id]/skills', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = getReq('u1')
    expect((await GET(req, ctx)).status).toBe(401)
  })

  it('returns 200 with the user\'s skill list', async () => {
    const skills = [
      { skillId: 's1', name: 'TypeScript', category: 'Language', level: 3, source: 'manual' },
    ]
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce(skills)

    const [req, ctx] = getReq('u1')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(skills)
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const [req, ctx] = getReq('u1')
    expect((await GET(req, ctx)).status).toBe(500)
  })
})

// ─── POST /api/users/[id]/skills ─────────────────────────────────────────────

describe('POST /api/users/[id]/skills', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = postReq('u1', { skillId: 's1', level: 'beginner' })
    expect((await POST(req, ctx)).status).toBe(401)
  })

  it('returns 404 when the user does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // user lookup → empty

    const [req, ctx] = postReq('nonexistent', { skillId: 's1', level: 'beginner' })
    expect((await POST(req, ctx)).status).toBe(404)
  })

  it('returns 403 when caller is not admin and not the owner', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'someone-else@example.com' }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 1 })
    expect((await POST(req, ctx)).status).toBe(403)
  })

  it('returns 400 when skillId is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = postReq('u1', { level: 1 })
    expect((await POST(req, ctx)).status).toBe(400)
  })

  it('returns 400 when level is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = postReq('u1', { skillId: 's1' })
    expect((await POST(req, ctx)).status).toBe(400)
  })

  it('returns 400 when level is invalid', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 'legendary' })
    expect((await POST(req, ctx)).status).toBe(400)
  })

  it('returns 400 when level is a negative number', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: -1 })
    expect((await POST(req, ctx)).status).toBe(400)
  })

  it('returns 400 when level exceeds maximum allowed years', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 51 })
    expect((await POST(req, ctx)).status).toBe(400)
  })

  it('returns 400 when source is invalid', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 1, source: 'github' })
    expect((await POST(req, ctx)).status).toBe(400)
  })

  it('returns 404 when the MERGE finds no matching user or skill', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }]) // user lookup
    mockRunQuery.mockResolvedValueOnce([]) // MERGE returns empty

    const [req, ctx] = postReq('u1', { skillId: 'nonexistent-skill', level: 1 })
    expect((await POST(req, ctx)).status).toBe(404)
  })

  it('returns 201 for a successful skill assignment by admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    mockRunQuery.mockResolvedValueOnce([{ found: true }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 5 })
    const res = await POST(req, ctx)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ skillId: 's1', level: 5, source: 'manual' })
  })

  it('returns 201 when the owner assigns a skill to themselves', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: ownerEmail }])
    mockRunQuery.mockResolvedValueOnce([{ found: true }])

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 1 })
    expect((await POST(req, ctx)).status).toBe(201)
  })

  it('returns 500 on a DB error after auth check succeeds', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const [req, ctx] = postReq('u1', { skillId: 's1', level: 1 })
    expect((await POST(req, ctx)).status).toBe(500)
  })
})

// ─── DELETE /api/users/[id]/skills ───────────────────────────────────────────

describe('DELETE /api/users/[id]/skills', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = deleteReq('u1', 's1')
    expect((await DELETE(req, ctx)).status).toBe(401)
  })

  it('returns 400 when skillId query param is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const [req, ctx] = deleteReq('u1') // no skillId
    expect((await DELETE(req, ctx)).status).toBe(400)
  })

  it('returns 404 when the user does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // user lookup → empty

    const [req, ctx] = deleteReq('nonexistent', 's1')
    expect((await DELETE(req, ctx)).status).toBe(404)
  })

  it('returns 403 when caller is not admin and not the owner', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'someone-else@example.com' }])

    const [req, ctx] = deleteReq('u1', 's1')
    expect((await DELETE(req, ctx)).status).toBe(403)
  })

  it('returns 204 when admin deletes a skill from a user', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    mockRunQuery.mockResolvedValueOnce([]) // DELETE relationship

    const [req, ctx] = deleteReq('u1', 's1')
    expect((await DELETE(req, ctx)).status).toBe(204)
  })

  it('returns 204 when the owner removes their own skill', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: ownerEmail }])
    mockRunQuery.mockResolvedValueOnce([])

    const [req, ctx] = deleteReq('u1', 's1')
    expect((await DELETE(req, ctx)).status).toBe(204)
  })

  it('returns 500 on a DB error during DELETE', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ email: 'alice@example.com' }])
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const [req, ctx] = deleteReq('u1', 's1')
    expect((await DELETE(req, ctx)).status).toBe(500)
  })
})
