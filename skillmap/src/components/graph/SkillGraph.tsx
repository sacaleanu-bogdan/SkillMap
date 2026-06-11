'use client'

import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useEffect, useState, useMemo } from 'react'
import { useGraphData } from '@/hooks/useGraphData'
import { UserNode } from './UserNode'
import { SkillNode } from './SkillNode'
import { FilterBar, type FilterCriterion } from './FilterBar'
import type { SkillLevel } from '@/types'

// Register custom node types — keys must match the `type` field on each node
const NODE_TYPES: NodeTypes = {
  user: UserNode,
  skill: SkillNode,
}

// Numeric rank for level comparison — higher means more proficient
const LEVEL_RANK: Record<SkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
}

// Full-screen interactive graph canvas with multi-criteria filter support.
export function SkillGraph() {
  const { nodes: apiNodes, edges: apiEdges, loading, error } = useGraphData()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [filters, setFilters] = useState<FilterCriterion[]>([])

  // Derive the skill list for the filter dropdown from the fetched graph nodes
  const availableSkills = useMemo(
    () =>
      apiNodes
        .filter((n) => n.type === 'skill')
        .map((n) => ({ id: n.id, label: n.data.label as string }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apiNodes]
  )

  // Recompute node/edge visibility whenever data or filters change.
  // Nodes that don't satisfy ALL filter criteria are dimmed (opacity 0.12).
  useEffect(() => {
    if (loading || error) return

    if (filters.length === 0) {
      // No filters — show everything at full opacity
      setNodes(apiNodes.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })))
      setEdges(apiEdges.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })))
      return
    }

    // Build edge map: userNodeId → [{skillNodeId, level}]
    const edgesByUser: Record<string, Array<{ skillNodeId: string; level: SkillLevel }>> = {}
    for (const edge of apiEdges) {
      const level = (edge.data as { level: SkillLevel } | undefined)?.level
      if (!level) continue
      if (!edgesByUser[edge.source]) edgesByUser[edge.source] = []
      edgesByUser[edge.source].push({ skillNodeId: edge.target, level })
    }

    // A user matches if they satisfy ALL active criteria (AND logic).
    // Each criterion: user must have an edge to skillNodeId with level >= minLevel.
    const matchingUserIds = new Set<string>()
    for (const node of apiNodes) {
      if (node.type !== 'user') continue
      const userEdges = edgesByUser[node.id] ?? []
      const satisfiesAll = filters.every((f) =>
        userEdges.some(
          (e) =>
            e.skillNodeId === f.skillNodeId &&
            LEVEL_RANK[e.level] >= LEVEL_RANK[f.minLevel]
        )
      )
      if (satisfiesAll) matchingUserIds.add(node.id)
    }

    // Skill nodes that are connected to at least one matching user stay visible
    const relevantSkillIds = new Set<string>()
    for (const edge of apiEdges) {
      if (matchingUserIds.has(edge.source)) relevantSkillIds.add(edge.target)
    }

    setNodes(
      apiNodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity:
            (n.type === 'user' && matchingUserIds.has(n.id)) ||
            (n.type === 'skill' && relevantSkillIds.has(n.id))
              ? 1
              : 0.1,
        },
      }))
    )

    setEdges(
      apiEdges.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: matchingUserIds.has(e.source) ? 1 : 0.04,
        },
      }))
    )
  }, [apiNodes, apiEdges, filters, loading, error])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        Loading graph…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400 text-sm">
        Failed to load graph: {error}
      </div>
    )
  }

  if (apiNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-600 text-sm">
        No data yet — add users and skills in the{' '}
        <a href="/matrix" className="ml-1 text-blue-500 underline">
          Skill Matrix
        </a>
        .
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Filter bar floats above the canvas */}
      <FilterBar
        availableSkills={availableSkills}
        filters={filters}
        onChange={setFilters}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        defaultEdgeOptions={{ style: { stroke: '#4b5563' } }}
      >
        {/* Dark dot grid background inspired by Obsidian */}
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#374151" />
        <Controls className="!bg-gray-900 !border-gray-700 !shadow-none" />
        <MiniMap
          nodeColor={(n) => (n.type === 'user' ? '#1d4ed8' : '#15803d')}
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>
    </div>
  )
}

