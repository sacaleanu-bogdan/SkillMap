/**
 * @jest-environment jsdom
 *
 * useGraphData — fetches /api/graph, transforms the payload, and exposes
 * nodes, edges, projects, loading, error, and a refetch() trigger.
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGraphData } from '@/hooks/useGraphData'

// Mock the transform utility so the hook test stays focused on fetch/state logic
jest.mock('@/lib/graph/transform', () => ({
  transformGraphData: jest.fn((nodes, edges) => ({
    nodes: nodes.map((n: { id: string }) => ({ id: n.id, type: 'user', data: {}, position: { x: 0, y: 0 } })),
    edges: edges.map((e: { id: string }) => ({ id: e.id })),
  })),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const GRAPH_PAYLOAD = {
  nodes: [{ id: 'user-1' }, { id: 'skill-1' }],
  edges: [{ id: 'edge-1' }],
  projects: [{ id: 'p1', name: 'Atlas' }],
}

function mockSuccess(payload = GRAPH_PAYLOAD) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(payload),
  })
}

function mockFailure(status = 500) {
  mockFetch.mockResolvedValueOnce({ ok: false, status })
}

afterEach(() => jest.clearAllMocks())

describe('useGraphData', () => {
  // ── Loading state ─────────────────────────────────────────────────────────
  it('starts with loading=true and no data', () => {
    mockSuccess()
    const { result } = renderHook(() => useGraphData())
    expect(result.current.loading).toBe(true)
    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
    expect(result.current.error).toBeNull()
  })

  // ── Happy path ────────────────────────────────────────────────────────────
  it('populates nodes, edges, and projects after a successful fetch', async () => {
    mockSuccess()
    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.nodes).toHaveLength(GRAPH_PAYLOAD.nodes.length)
    expect(result.current.edges).toHaveLength(GRAPH_PAYLOAD.edges.length)
    expect(result.current.projects).toEqual(GRAPH_PAYLOAD.projects)
  })

  it('sets loading=false after a successful fetch', async () => {
    mockSuccess()
    const { result } = renderHook(() => useGraphData())
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('fetches /api/graph', async () => {
    mockSuccess()
    renderHook(() => useGraphData())
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(mockFetch).toHaveBeenCalledWith('/api/graph')
  })

  // ── Empty response ────────────────────────────────────────────────────────
  it('handles a response with missing nodes/edges/projects arrays gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}), // no nodes, edges, projects keys
    })

    const { result } = renderHook(() => useGraphData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
    expect(result.current.projects).toEqual([])
  })

  // ── Error path ────────────────────────────────────────────────────────────
  it('sets error when the API returns a non-ok response', async () => {
    mockFailure(401)
    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toContain('401')
    expect(result.current.nodes).toEqual([])
  })

  it('sets error when fetch itself throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Network failure')
  })

  // ── refetch ───────────────────────────────────────────────────────────────
  it('refetch() triggers a second fetch call', async () => {
    mockSuccess()
    mockSuccess() // second call for refetch

    const { result } = renderHook(() => useGraphData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
  })

  it('resets error to null on a successful refetch', async () => {
    mockFailure()
    mockSuccess()

    const { result } = renderHook(() => useGraphData())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.error).toBeNull())
  })
})
