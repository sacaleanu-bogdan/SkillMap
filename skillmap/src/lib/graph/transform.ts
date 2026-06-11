import type { Node, Edge } from 'reactflow'
import type { GraphNode, GraphEdge, SkillLevel } from '@/types'

// Edge stroke width and color keyed by proficiency level
const LEVEL_STROKE_WIDTH: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 5,
}

const LEVEL_STROKE_COLOR: Record<SkillLevel, string> = {
  beginner: '#6b7280',    // gray-500
  intermediate: '#60a5fa', // blue-400
  advanced: '#34d399',    // emerald-400
  expert: '#a78bfa',      // violet-400
}

// Lay users out in a left column and skills in a right column,
// evenly spaced vertically. The frontend layout algorithm (ELK / d3-force)
// will replace this in a later phase; for now this gives a readable default.
function positionNodes(rawNodes: GraphNode[]): Node[] {
  const users = rawNodes.filter((n) => n.type === 'user')
  const skills = rawNodes.filter((n) => n.type === 'skill')

  const ROW_HEIGHT = 80
  const USER_X = 80
  const SKILL_X = 500

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

  return positioned
}

// Transform raw API response into React Flow Node[] and Edge[]
export function transformGraphData(rawNodes: GraphNode[], rawEdges: GraphEdge[]) {
  const nodes = positionNodes(rawNodes)

  const edges: Edge[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.data.level,
    // Variable thickness and color communicate proficiency at a glance
    style: {
      strokeWidth: LEVEL_STROKE_WIDTH[e.data.level],
      stroke: LEVEL_STROKE_COLOR[e.data.level],
    },
    labelStyle: { fill: LEVEL_STROKE_COLOR[e.data.level], fontSize: 10 },
    labelBgStyle: { fill: '#111827', fillOpacity: 0.8 },
    data: e.data,
  }))

  return { nodes, edges }
}
