import { transformGraphData } from '@/lib/graph/transform'
import type { GraphNode, GraphEdge } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUserNode(id: string): GraphNode {
  return {
    id: `user-${id}`,
    type: 'user',
    data: { label: `User ${id}`, meta: { id, name: `User ${id}`, email: '', department: '', seniority: '', role: 'employee' } },
    position: { x: 0, y: 0 },
  }
}

function makeSkillNode(id: string): GraphNode {
  return {
    id: `skill-${id}`,
    type: 'skill',
    data: { label: `Skill ${id}`, meta: { id, name: `Skill ${id}`, category: 'Engineering' } },
    position: { x: 0, y: 0 },
  }
}

function makeProjectNode(id: string): GraphNode {
  return {
    id: `project-${id}`,
    type: 'project',
    data: { label: `Project ${id}`, meta: { id, name: `Project ${id}` } },
    position: { x: 0, y: 0 },
  }
}

function makeSkillEdge(userId: string, skillId: string, level = 3): GraphEdge {
  return {
    id: `edge-user-${userId}-skill-${skillId}`,
    source: `user-${userId}`,
    target: `skill-${skillId}`,
    data: { edgeKind: 'skill', level, source: 'manual' },
  }
}

function makeProjectEdge(userId: string, projectId: string): GraphEdge {
  return {
    id: `edge-user-${userId}-project-${projectId}`,
    source: `user-${userId}`,
    target: `project-${projectId}`,
    data: { edgeKind: 'project' },
  }
}

// ─── Node positioning ─────────────────────────────────────────────────────────

describe('transformGraphData — node positioning', () => {
  it('returns empty nodes and edges for empty input', () => {
    const { nodes, edges } = transformGraphData([], [])
    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })

  it('places user nodes at x = 80', () => {
    const { nodes } = transformGraphData([makeUserNode('1'), makeUserNode('2')], [])
    for (const n of nodes.filter((n) => n.id.startsWith('user-'))) {
      expect(n.position.x).toBe(80)
    }
  })

  it('places skill nodes at x = 500', () => {
    const { nodes } = transformGraphData([makeSkillNode('1')], [])
    expect(nodes[0].position.x).toBe(500)
  })

  it('places project nodes at x = 920', () => {
    const { nodes } = transformGraphData([makeProjectNode('1')], [])
    expect(nodes[0].position.x).toBe(920)
  })

  it('spaces multiple nodes of the same type vertically (ROW_HEIGHT = 80)', () => {
    const { nodes } = transformGraphData(
      [makeUserNode('a'), makeUserNode('b'), makeUserNode('c')],
      []
    )
    const ys = nodes.map((n) => n.position.y)
    // Each user is offset by 80px from the previous
    expect(ys[1] - ys[0]).toBe(80)
    expect(ys[2] - ys[1]).toBe(80)
  })

  it('preserves node id, type, and data through transformation', () => {
    const raw = makeUserNode('42')
    const { nodes } = transformGraphData([raw], [])
    expect(nodes[0].id).toBe('user-42')
    expect(nodes[0].type).toBe('user')
    expect(nodes[0].data.label).toBe('User 42')
  })

  it('handles a mix of user, skill, and project nodes', () => {
    const raw = [makeUserNode('1'), makeSkillNode('2'), makeProjectNode('3')]
    const { nodes } = transformGraphData(raw, [])
    const types = nodes.map((n) => n.type)
    expect(types).toContain('user')
    expect(types).toContain('skill')
    expect(types).toContain('project')
  })
})

// ─── Skill edge styling ───────────────────────────────────────────────────────

describe('transformGraphData — skill edges', () => {
  const sampleYears = [0, 1, 3, 7, 12]

  it.each(sampleYears)('produces a skill edge for %s years of experience', (years) => {
    const edge = makeSkillEdge('u1', 's1', years)
    const { edges } = transformGraphData([], [edge])
    expect(edges).toHaveLength(1)
    expect(edges[0].id).toBe(edge.id)
  })

  it('attaches the years as a label on skill edges', () => {
    const edge = makeSkillEdge('u1', 's1', 7)
    const { edges } = transformGraphData([], [edge])
    expect(edges[0].label).toBe('7yr')
  })

  it('uses a thicker stroke for more years than fewer years', () => {
    const moreYearsEdge = makeSkillEdge('u1', 's1', 12)
    const fewerYearsEdge = makeSkillEdge('u1', 's2', 1)
    const { edges } = transformGraphData([], [moreYearsEdge, fewerYearsEdge])
    const more = edges.find((e) => e.id.includes('s1'))!
    const fewer = edges.find((e) => e.id.includes('s2'))!
    expect(more.style!.strokeWidth).toBeGreaterThan(fewer.style!.strokeWidth as number)
  })

  it('uses gray stroke color for 0-1 years', () => {
    const { edges } = transformGraphData([], [makeSkillEdge('u1', 's1', 0)])
    expect(edges[0].style!.stroke).toMatch(/^#[0-9a-fA-F]{6}$/)
    // 0 years maps to gray-500 (#6b7280)
    expect(edges[0].style!.stroke).toBe('#6b7280')
  })

  it('uses violet stroke color for 10+ years', () => {
    const { edges } = transformGraphData([], [makeSkillEdge('u1', 's1', 10)])
    expect(edges[0].style!.stroke).toBe('#a78bfa')
  })

  it('preserves source and target node ids on skill edges', () => {
    const { edges } = transformGraphData([], [makeSkillEdge('u1', 's1')])
    expect(edges[0].source).toBe('user-u1')
    expect(edges[0].target).toBe('skill-s1')
  })
})

// ─── Project edge styling ─────────────────────────────────────────────────────

describe('transformGraphData — project edges', () => {
  it('renders project edges as amber dashed lines', () => {
    const { edges } = transformGraphData([], [makeProjectEdge('u1', 'p1')])
    expect(edges[0].style!.stroke).toBe('#d97706')
    expect(String(edges[0].style!.strokeDasharray)).toContain('5')
  })

  it('project edges have no label', () => {
    const { edges } = transformGraphData([], [makeProjectEdge('u1', 'p1')])
    expect(edges[0].label).toBeUndefined()
  })

  it('project edges have strokeWidth of 1', () => {
    const { edges } = transformGraphData([], [makeProjectEdge('u1', 'p1')])
    expect(edges[0].style!.strokeWidth).toBe(1)
  })

  it('preserves source and target ids on project edges', () => {
    const { edges } = transformGraphData([], [makeProjectEdge('u1', 'p1')])
    expect(edges[0].source).toBe('user-u1')
    expect(edges[0].target).toBe('project-p1')
  })
})

// ─── Combined output ──────────────────────────────────────────────────────────

describe('transformGraphData — combined output', () => {
  it('returns the correct counts for nodes and edges', () => {
    const rawNodes = [makeUserNode('1'), makeSkillNode('2'), makeProjectNode('3')]
    const rawEdges = [makeSkillEdge('1', '2'), makeProjectEdge('1', '3')]
    const { nodes, edges } = transformGraphData(rawNodes, rawEdges)
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
  })
})
