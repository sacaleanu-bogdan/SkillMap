/**
 * PATCH /api/skills/[id] — update a skill (admin only)
 */
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/skills/[id]/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION, EMPLOYEE_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

function patchReq(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost/api/skills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) },
  ]
}

afterEach(() => jest.clearAllMocks())

describe('PATCH /api/skills/[id]', () => {
  // ── Auth guards ───────────────────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const [req, ctx] = patchReq('s1', { name: 'Go', category: 'Language' })
    expect((await PATCH(req, ctx)).status).toBe(401)
  })

  it('returns 403 when caller is not admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    const [req, ctx] = patchReq('s1', { name: 'Go', category: 'Language' })
    expect((await PATCH(req, ctx)).status).toBe(403)
  })

  // ── Validation ────────────────────────────────────────────────────────────
  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const [req, ctx] = patchReq('s1', { category: 'Language' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  it('returns 400 when category is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const [req, ctx] = patchReq('s1', { name: 'Go' })
    expect((await PATCH(req, ctx)).status).toBe(400)
  })

  // ── Not found ─────────────────────────────────────────────────────────────
  it('returns 404 when the skill does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // exists check → empty

    const [req, ctx] = patchReq('nonexistent', { name: 'Go', category: 'Language' })
    expect((await PATCH(req, ctx)).status).toBe(404)
  })

  // ── Conflict ─────────────────────────────────────────────────────────────
  it('returns 409 when another skill already has that name', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 's1' }]) // exists
    mockRunQuery.mockResolvedValueOnce([{ id: 's2' }]) // duplicate name

    const [req, ctx] = patchReq('s1', { name: 'TypeScript', category: 'Language' })
    expect((await PATCH(req, ctx)).status).toBe(409)
  })

  // ── Happy paths ───────────────────────────────────────────────────────────
  it('returns 200 with the updated skill', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 's1' }]) // exists
    mockRunQuery.mockResolvedValueOnce([])              // no name collision
    mockRunQuery.mockResolvedValueOnce([])              // SET

    const [req, ctx] = patchReq('s1', { name: 'Go', category: 'Backend', icon: '🐹' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: 's1', name: 'Go', category: 'Backend', icon: '🐹' })
  })

  it('sets icon to null when not provided', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 's1' }])
    mockRunQuery.mockResolvedValueOnce([])
    mockRunQuery.mockResolvedValueOnce([])

    const [req, ctx] = patchReq('s1', { name: 'Rust', category: 'Systems' })
    const res = await PATCH(req, ctx)
    expect((await res.json()).icon).toBeNull()
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ id: 's1' }])
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const [req, ctx] = patchReq('s1', { name: 'Go', category: 'Backend' })
    expect((await PATCH(req, ctx)).status).toBe(500)
  })
})
