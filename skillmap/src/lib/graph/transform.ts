import type { Node, Edge } from 'reactflow'
import type { GraphNode, GraphEdge } from '@/types'

// Edge stroke width scales with years of experience (clamped 1–5)
function levelStrokeWidth(years: number): number {
  if (years >= 10) return 5
  if (years >= 5) return 3
  if (years >= 2) return 2
  return 1
}

// Edge color based on years of experience thresholds
function levelStrokeColor(years: number): string {
  if (years >= 10) return '#a78bfa' // violet-400
  if (years >= 5) return '#34d399'  // emerald-400
  if (years >= 2) return '#60a5fa'  // blue-400
  return '#6b7280'                   // gray-500
}

// Lay users out in a left column, skills in a centre column, and projects in a right column,
// evenly spaced vertically. The frontend layout algorithm (ELK / d3-force)
// will replace this in a later phase; for now this gives a readable default.
function positionNodes(rawNodes: GraphNode[]): Node[] {
  const users = rawNodes.filter((n) => n.type === 'user')
  const skills = rawNodes.filter((n) => n.type === 'skill')
  const projects = rawNodes.filter((n) => n.type === 'project')

  const ROW_HEIGHT = 80
  const USER_X = 80
  const SKILL_X = 500
  const PROJECT_X = 920

  const positioned: Node[] = []

  users.forEach((node, i) => {
    positioned.push({
      id: node.id,
      type: node.type,     // maps to the custom node type registered in SkillGraph
      data: node.data,
      position: { x: USER_X, y: i * ROW_HEIGHT + 40 },
    })
  })

  skills.forEach((node, i) => {
    positioned.push({
      id: node.id,
      type: node.type,
      data: node.data,
      position: { x: SKILL_X, y: i * ROW_HEIGHT + 40 },
    })
  })

  projects.forEach((node, i) => {
    positioned.push({
      id: node.id,
      type: node.type,
      data: node.data,
      position: { x: PROJECT_X, y: i * ROW_HEIGHT + 40 },
    })
  })

  return positioned
}

// Transform raw API response into React Flow Node[] and Edge[]
export function transformGraphData(rawNodes: GraphNode[], rawEdges: GraphEdge[]) {
  const nodes = positionNodes(rawNodes)

  const edges: Edge[] = rawEdges.map((e) => {
    if (e.data.edgeKind === 'project') {
      // User → Project membership edge: amber dashed line, no label
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        style: { strokeWidth: 1, stroke: '#d97706', strokeDasharray: '5 4' },
        data: e.data,
      }
    }
    // User → Skill proficiency edge: variable thickness + color by years of experience
    const { level } = e.data
    const label = `${level}yr`
    const color = levelStrokeColor(level)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label,
      style: {
        strokeWidth: levelStrokeWidth(level),
        stroke: color,
      },
      labelStyle: { fill: color, fontSize: 10 },
      labelBgStyle: { fill: '#111827', fillOpacity: 0.8 },
      data: e.data,
    }
  })

  return { nodes, edges }
}
