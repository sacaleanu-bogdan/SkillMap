/**
 * GET /api/health
 * Tests: authentication guard, healthy DB response, DB-down (503) response.
 */
import { GET } from '@/app/api/health/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

afterEach(() => jest.clearAllMocks())

describe('GET /api/health', () => {
  // ── Unhappy paths ────────────────────────────────────────────────────────
  it('returns 401 when there is no session', async () => {
    // Arrange
    mockGetServerSession.mockResolvedValueOnce(null)

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  // ── Happy paths ──────────────────────────────────────────────────────────
  it('returns 200 { ok: true } when the DB responds', async () => {
    // Arrange
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([{ ok: 1 }])

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
  })

  // ── Edge cases ───────────────────────────────────────────────────────────
  it('returns 503 { ok: false } when the DB throws', async () => {
    // Arrange
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('connection refused'))

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body).toEqual({ ok: false })
  })
})
