/**
 * GET /api/users/me — returns the current user's full profile
 */
import { GET } from '@/app/api/users/me/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import type { Session } from 'next-auth'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

const SESSION: Session = {
  user: { name: 'Alice', email: 'alice@example.com', role: 'employee' },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

const SESSION_NO_EMAIL: Session = {
  user: { name: 'Anon', email: undefined, role: 'employee' },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

const rawUser = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  department: 'Engineering',
  seniority: 'Senior',
  role: 'employee',
  education: [],
  certifications: [],
  languages: [],
  shortDescription: '',
  projectAssignments: null,
}

afterEach(() => jest.clearAllMocks())

describe('GET /api/users/me', () => {
  // ── Unhappy paths ────────────────────────────────────────────────────────
  it('returns 401 when there is no session', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when the session has no email', async () => {
    mockGetServerSession.mockResolvedValueOnce(SESSION_NO_EMAIL)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 404 when the user is not found in the database', async () => {
    mockGetServerSession.mockResolvedValueOnce(SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no records

    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
  })

  // ── Happy paths ───────────────────────────────────────────────────────────
  it('returns 200 with the user profile and an empty projectAssignments array when null in DB', async () => {
    mockGetServerSession.mockResolvedValueOnce(SESSION)
    mockRunQuery.mockResolvedValueOnce([rawUser])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('alice@example.com')
    expect(body.projectAssignments).toEqual([])
  })

  it('returns parsed projectAssignments when stored as JSON string', async () => {
    const pa = [{ projectId: 'p1', status: 'current', contribution: 'Owned frontend' }]
    mockGetServerSession.mockResolvedValueOnce(SESSION)
    mockRunQuery.mockResolvedValueOnce([{ ...rawUser, projectAssignments: JSON.stringify(pa) }])

    const res = await GET()
    const body = await res.json()
    expect(body.projectAssignments).toEqual(pa)
  })

  // ── Edge case ─────────────────────────────────────────────────────────────
  it('falls back to [] when projectAssignments JSON is malformed', async () => {
    mockGetServerSession.mockResolvedValueOnce(SESSION)
    mockRunQuery.mockResolvedValueOnce([{ ...rawUser, projectAssignments: 'not-valid-json' }])

    const res = await GET()
    const body = await res.json()
    expect(body.projectAssignments).toEqual([])
  })
})
