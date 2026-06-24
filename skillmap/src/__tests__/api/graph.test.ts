/**
 * GET /api/graph — returns nodes (user, skill, project) and edges
 */
import { GET } from '@/app/api/graph/route'
import { getServerSession } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import type { Session } from 'next-auth'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/neo4j', () => ({ runQuery: jest.fn() }))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>

function makeSession(role: 'admin' | 'manager' | 'employee'): Session {
  return {
    user: { name: 'Test', email: `${role}@example.com`, role },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  }
}

/**
 * Set up the four parallel runQuery calls in the order the graph route makes them:
 * 1. userRecords
 * 2. skillRecords
 * 3. edgeRecords (HAS_SKILL relationships)
 * 4. projectRecords
 */
function mockGraphQueries(
  users: unknown[] = [],
  skills: unknown[] = [],
  edges: unknown[] = [],
  projects: unknown[] = []
) {
  mockRunQuery
    .mockResolvedValueOnce(users as never)
    .mockResolvedValueOnce(skills as never)
    .mockResolvedValueOnce(edges as never)
    .mockResolvedValueOnce(projects as never)
}

afterEach(() => jest.clearAllMocks())

describe('GET /api/graph', () => {
  // ── Auth guard ───────────────────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  // ── Happy paths ───────────────────────────────────────────────────────────
  it('returns 200 with empty nodes, edges, and projects when the DB is empty', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries()

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nodes).toEqual([])
    expect(body.edges).toEqual([])
    expect(body.projects).toEqual([])
  })

  it('maps user records to user nodes with prefixed ids', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [{ id: 'u1', name: 'Alice', seniority: 'Senior', projects: null, projectAssignments: null }]
    )

    const body = await (await GET()).json()
    const userNode = body.nodes.find((n: { id: string }) => n.id === 'user-u1')
    expect(userNode).toBeDefined()
    expect(userNode.type).toBe('user')
    expect(userNode.data.label).toBe('Alice')
  })

  it('parses projectAssignments JSON from user records', async () => {
    const pa = [{ projectId: 'p1', status: 'current' }]
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [{ id: 'u1', name: 'Alice', seniority: 'Senior', projects: ['p1'], projectAssignments: JSON.stringify(pa) }]
    )

    const body = await (await GET()).json()
    const userNode = body.nodes.find((n: { id: string }) => n.id === 'user-u1')
    expect(userNode.data.meta.projectAssignments).toEqual(pa)
  })

  it('falls back to [] when projectAssignments JSON is malformed', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [{ id: 'u1', name: 'Alice', seniority: 'Senior', projects: null, projectAssignments: 'bad{json' }]
    )

    const body = await (await GET()).json()
    const userNode = body.nodes.find((n: { id: string }) => n.id === 'user-u1')
    expect(userNode.data.meta.projectAssignments).toEqual([])
  })

  it('maps skill records to skill nodes with prefixed ids', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [],
      [{ id: 's1', name: 'TypeScript', category: 'Language', icon: null }]
    )

    const body = await (await GET()).json()
    const skillNode = body.nodes.find((n: { id: string }) => n.id === 'skill-s1')
    expect(skillNode).toBeDefined()
    expect(skillNode.type).toBe('skill')
  })

  it('maps project records to project nodes', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [], [], [],
      [{ id: 'p1', name: 'Atlas' }]
    )

    const body = await (await GET()).json()
    const projectNode = body.nodes.find((n: { id: string }) => n.id === 'project-p1')
    expect(projectNode).toBeDefined()
    expect(projectNode.type).toBe('project')
  })

  it('creates skill edges from HAS_SKILL relationships', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [],
      [],
      [{ userId: 'u1', skillId: 's1', level: 5, source: 'manual' }]
    )

    const body = await (await GET()).json()
    const edge = body.edges.find((e: { id: string }) => e.id === 'edge-user-u1-skill-s1')
    expect(edge).toBeDefined()
    expect(edge.data.edgeKind).toBe('skill')
    expect(edge.data.level).toBe(5)
  })

  it('creates project membership edges from flat projects array on user', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [{ id: 'u1', name: 'Alice', seniority: 'Senior', projects: ['p1', 'p2'], projectAssignments: null }],
      [], [],
      [{ id: 'p1', name: 'Atlas' }, { id: 'p2', name: 'Bolt' }]
    )

    const body = await (await GET()).json()
    const projectEdges = body.edges.filter((e: { data: { edgeKind: string } }) => e.data.edgeKind === 'project')
    expect(projectEdges).toHaveLength(2)
    const ids = projectEdges.map((e: { id: string }) => e.id)
    expect(ids).toContain('edge-user-u1-project-p1')
    expect(ids).toContain('edge-user-u1-project-p2')
  })

  it('does not create project edges when user has no projects', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [{ id: 'u1', name: 'Alice', seniority: 'Senior', projects: null, projectAssignments: null }]
    )

    const body = await (await GET()).json()
    const projectEdges = body.edges.filter((e: { data: { edgeKind: string } }) => e.data.edgeKind === 'project')
    expect(projectEdges).toHaveLength(0)
  })

  it('includes department and role for a manager session', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('manager'))
    mockGraphQueries(
      [{ id: 'u1', name: 'Alice', department: 'Engineering', seniority: 'Senior', role: 'employee', projects: null, projectAssignments: null }]
    )

    const body = await (await GET()).json()
    const userNode = body.nodes.find((n: { id: string }) => n.id === 'user-u1')
    expect(userNode.data.meta.department).toBe('Engineering')
  })

  it('exposes projects array in the top-level response', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockGraphQueries(
      [], [], [],
      [{ id: 'p1', name: 'Atlas' }]
    )

    const body = await (await GET()).json()
    expect(body.projects).toEqual([{ id: 'p1', name: 'Atlas' }])
  })

  // ── Error handling ────────────────────────────────────────────────────────
  it('returns 500 when a database query throws', async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession('employee'))
    mockRunQuery.mockRejectedValueOnce(new Error('DB error'))

    expect((await GET()).status).toBe(500)
  })
})
