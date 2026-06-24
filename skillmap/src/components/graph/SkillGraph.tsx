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
import { ProjectNode } from './ProjectNode'
import { FilterBar, type FilterCriterion, type SkillCriterion, type ProjectCriterion } from './FilterBar'
import type { User, ProjectAssignment } from '@/types'

// Register custom node types — keys must match the `type` field on each node
const NODE_TYPES: NodeTypes = {
  user: UserNode,
  skill: SkillNode,
  project: ProjectNode,
}

// Full-screen interactive graph canvas with multi-criteria filter support.
export function SkillGraph() {
  const { nodes: apiNodes, edges: apiEdges, projects: apiProjects, loading, error, refetch } = useGraphData()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [filters, setFilters] = useState<FilterCriterion[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleTypes, setVisibleTypes] = useState({ user: true, skill: true, project: true })

  // Refetch graph data whenever any user edits their profile
  useEffect(() => {
    function handleProfileUpdate() { refetch() }
    window.addEventListener('skillmap:profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('skillmap:profile-updated', handleProfileUpdate)
  }, [refetch])

  // Derive the skill list for the filter dropdown from the fetched graph nodes
  const availableSkills = useMemo(
    () =>
      apiNodes
        .filter((n) => n.type === 'skill')
        .map((n) => ({ id: n.id, label: n.data.label as string }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apiNodes]
  )

  // Projects come directly from the API response, already sorted
  const availableProjects = useMemo(() => apiProjects, [apiProjects])

  // Build a lookup map: projectId → name (used for text search against project names)
  const projectNameById = useMemo(
    () => new Map(apiProjects.map((p) => [p.id, p.name.toLowerCase()])),
    [apiProjects]
  )

  // Recompute node/edge visibility (opacity) whenever data, filters, or search query change.
  useEffect(() => {
    if (loading || error) return

    const query = searchQuery.trim().toLowerCase()
    const hasFilters = filters.length > 0
    const hasSearch = query.length > 0

    if (!hasFilters && !hasSearch) {
      // Nothing active — show everything at full opacity
      setNodes(apiNodes.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })))
      setEdges(apiEdges.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })))
      return
    }

    // Split structured filters into skill and project criteria
    const skillFilters = filters.filter((f): f is SkillCriterion => f.type === 'skill')
    const projectFilters = filters.filter((f): f is ProjectCriterion => f.type === 'project')

    // Build skill-edge map: userNodeId → [{skillNodeId, level (years)}]
    const edgesByUser: Record<string, Array<{ skillNodeId: string; level: number }>> = {}
    for (const edge of apiEdges) {
      const d = edge.data as { edgeKind?: string; level?: number }
      if (d?.edgeKind !== 'skill' || d.level === undefined) continue
      if (!edgesByUser[edge.source]) edgesByUser[edge.source] = []
      edgesByUser[edge.source].push({ skillNodeId: edge.target, level: d.level })
    }

    // Pre-compute which skill/project nodes match the text query
    const nodeMatchesSearch = new Map<string, boolean>()
    if (hasSearch) {
      for (const node of apiNodes) {
        if (node.type === 'skill' || node.type === 'project') {
          nodeMatchesSearch.set(node.id, (node.data.label as string).toLowerCase().includes(query))
        }
      }
    }

    // Determine matching user nodes (must pass BOTH structured filters AND text search)
    const matchingUserIds = new Set<string>()
    for (const node of apiNodes) {
      if (node.type !== 'user') continue
      const userEdges = edgesByUser[node.id] ?? []
      const assignments: ProjectAssignment[] = (node.data.meta as User)?.projectAssignments ?? []
      const userProjects: string[] = assignments.map((pa) => pa.projectId)

      // --- Structured filter checks ---
      const satisfiesSkillFilters = skillFilters.every((f) =>
        userEdges.some(
          (e) => e.skillNodeId === f.skillNodeId && e.level >= f.minYears
        )
      )
      const satisfiesProjectFilters = projectFilters.every((f) =>
        userProjects.includes(f.projectId)
      )

      // --- Text search check ---
      // A user matches if their name, any of their skills, or any of their project names match
      let satisfiesSearch = true
      if (hasSearch) {
        const nameMatch = (node.data.label as string).toLowerCase().includes(query)
        const skillMatch = userEdges.some((e) => nodeMatchesSearch.get(e.skillNodeId) === true)
        const projectMatch = userProjects.some((pid) => (projectNameById.get(pid) ?? '').includes(query))
        satisfiesSearch = nameMatch || skillMatch || projectMatch
      }

      if (satisfiesSkillFilters && satisfiesProjectFilters && satisfiesSearch) {
        matchingUserIds.add(node.id)
      }
    }

    // Skill/project nodes are relevant if connected to at least one matching user,
    // OR if they directly match the search query (search-only mode, no structured filters)
    const relevantLinkedIds = new Set<string>()
    for (const edge of apiEdges) {
      if (matchingUserIds.has(edge.source)) relevantLinkedIds.add(edge.target)
    }
    if (hasSearch && !hasFilters) {
      for (const [id, matches] of nodeMatchesSearch) {
        if (matches) relevantLinkedIds.add(id)
      }
    }

    setNodes(
      apiNodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity:
            (n.type === 'user' && matchingUserIds.has(n.id)) ||
            ((n.type === 'skill' || n.type === 'project') && relevantLinkedIds.has(n.id))
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
  }, [apiNodes, apiEdges, filters, searchQuery, loading, error, projectNameById])

  // Apply node-type visibility toggles on top of the opacity-based search/filter highlighting.
  // Nodes of hidden types are removed from the rendered graph; their edges are hidden too.
  const hiddenNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of nodes) {
      const t = n.type as string
      if (
        (t === 'user' && !visibleTypes.user) ||
        (t === 'skill' && !visibleTypes.skill) ||
        (t === 'project' && !visibleTypes.project)
      ) {
        ids.add(n.id)
      }
    }
    return ids
  }, [nodes, visibleTypes])

  const displayNodes = useMemo(
    () => nodes.map((n) => (hiddenNodeIds.has(n.id) ? { ...n, hidden: true } : n)),
    [nodes, hiddenNodeIds]
  )

  const displayEdges = useMemo(
    () => edges.map((e) =>
      hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target)
        ? { ...e, hidden: true }
        : e
    ),
    [edges, hiddenNodeIds]
  )

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
      {/* Structured filter bar — centred at the top */}
      <FilterBar
        availableSkills={availableSkills}
        availableProjects={availableProjects}
        filters={filters}
        onChange={setFilters}
      />

      {/* Node-type visibility checkboxes — top-left corner */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-sm px-3 py-2 shadow-2xl">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Show</span>
        {([
          { key: 'user',    label: 'Users',    color: 'text-blue-400' },
          { key: 'skill',   label: 'Skills',   color: 'text-emerald-400' },
          { key: 'project', label: 'Projects', color: 'text-amber-400' },
        ] as const).map(({ key, label, color }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleTypes[key]}
              onChange={(e) => setVisibleTypes((prev) => ({ ...prev, [key]: e.target.checked }))}
              className="accent-gray-400 w-3 h-3"
            />
            <span className={`text-xs ${color}`}>{label}</span>
          </label>
        ))}
      </div>

      {/* Text search bar — top-right corner */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-sm px-3 py-2 shadow-2xl">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes…"
          className="bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none w-36"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-gray-600 hover:text-gray-400 transition-colors text-xs leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
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
          nodeColor={(n) => {
            if (n.type === 'user') return '#1d4ed8'
            if (n.type === 'project') return '#b45309'
            return '#15803d'
          }}
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>
    </div>
  )
}

