/**
 * GET /api/skills — list skills
 * POST /api/skills — create skill (admin only)
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/skills/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import { ADMIN_SESSION, EMPLOYEE_SESSION } from './__helpers__/sessions'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/skills', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => jest.clearAllMocks())

// ─── GET /api/skills ──────────────────────────────────────────────────────────

describe('GET /api/skills', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('returns 200 with the list of skills', async () => {
    // Arrange
    const skills = [
      { id: '1', name: 'TypeScript', category: 'Language', icon: null },
      { id: '2', name: 'React', category: 'Frontend', icon: '⚛' },
    ]
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockResolvedValueOnce(skills)

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(skills)
  })

  it('returns 500 on a database error', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))
    const response = await GET()
    expect(response.status).toBe(500)
  })
})

// ─── POST /api/skills ─────────────────────────────────────────────────────────

describe('POST /api/skills', () => {
  // ── RBAC guards ───────────────────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const response = await POST(postRequest({ name: 'Go', category: 'Language' }))
    expect(response.status).toBe(401)
  })

  it('returns 403 when the caller is not an admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(EMPLOYEE_SESSION)
    const response = await POST(postRequest({ name: 'Go', category: 'Language' }))
    expect(response.status).toBe(403)
  })

  // ── Validation ────────────────────────────────────────────────────────────
  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const response = await POST(postRequest({ category: 'Language' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/name/)
  })

  it('returns 400 when category is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const response = await POST(postRequest({ name: 'Go' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/category/)
  })

  // ── Conflict ─────────────────────────────────────────────────────────────
  it('returns 409 when the skill name already exists', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    // duplicate check returns a row
    mockRunQuery.mockResolvedValueOnce([{ id: 'existing-id' }])

    const response = await POST(postRequest({ name: 'TypeScript', category: 'Language' }))
    expect(response.status).toBe(409)
  })

  it('returns 409 when a Neo4j constraint error is thrown', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no duplicate
    mockRunQuery.mockRejectedValueOnce({
      code: 'Neo.ClientError.Schema.ConstraintValidationFailed',
    })

    const response = await POST(postRequest({ name: 'TypeScript', category: 'Language' }))
    expect(response.status).toBe(409)
  })

  // ── Happy path ────────────────────────────────────────────────────────────
  it('returns 201 with the created skill', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no duplicate
    mockRunQuery.mockResolvedValueOnce([]) // CREATE

    const response = await POST(postRequest({ name: 'Go', category: 'Backend', icon: '🐹' }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.name).toBe('Go')
    expect(body.category).toBe('Backend')
    expect(body.icon).toBe('🐹')
    expect(body.id).toBeDefined()
  })

  it('omits icon when not provided', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockRunQuery.mockResolvedValueOnce([]) // no duplicate
    mockRunQuery.mockResolvedValueOnce([]) // CREATE

    const response = await POST(postRequest({ name: 'Rust', category: 'Systems' }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.icon).toBeNull()
  })
})
