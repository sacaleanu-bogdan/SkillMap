'use client'

import { useState, useEffect } from 'react'
import type { Node, Edge } from 'reactflow'
import { transformGraphData } from '@/lib/graph/transform'

interface GraphDataState {
  nodes: Node[]
  edges: Edge[]
  projects: Array<{ id: string; name: string }>
  loading: boolean
  error: string | null
  // Manually trigger a re-fetch (e.g. after a mutation)
  refetch: () => void
}

// Client hook that fetches /api/graph and transforms the response
// into React Flow nodes and edges via the transform utility.
export function useGraphData(): GraphDataState {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  function refetch() {
    setTick((t) => t + 1)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/graph')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Graph API returned ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const transformed = transformGraphData(data.nodes ?? [], data.edges ?? [])
        setNodes(transformed.nodes)
        setEdges(transformed.edges)
        setProjects(data.projects ?? [])
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [tick])

  return { nodes, edges, projects, loading, error, refetch }
}
