// neo4j.ts wraps neo4j-driver — mock the driver entirely to keep tests fast and offline
const mockClose = jest.fn().mockResolvedValue(undefined)
const mockRun = jest.fn()
const mockSession = jest.fn().mockReturnValue({ run: mockRun, close: mockClose })
const mockDriver = { session: mockSession }
const mockDriverFactory = jest.fn().mockReturnValue(mockDriver)

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: {
    driver: mockDriverFactory,
    auth: {
      basic: jest.fn().mockReturnValue({ scheme: 'basic', principal: 'neo4j', credentials: 'test' }),
    },
  },
}))

describe('runQuery', () => {
  // Re-import inside each isolation block to reset the driver singleton
  beforeEach(() => {
    jest.resetModules()
    mockRun.mockReset()
    mockClose.mockReset()
    mockClose.mockResolvedValue(undefined)
    mockDriverFactory.mockReturnValue(mockDriver)
  })

  it('maps Neo4j records to plain objects and returns them', async () => {
    // Arrange: each record has a toObject() method
    mockRun.mockResolvedValueOnce({
      records: [
        { toObject: () => ({ id: '1', name: 'Alice' }) },
        { toObject: () => ({ id: '2', name: 'Bob' }) },
      ],
    })

    // Act
    const { runQuery } = await import('@/lib/neo4j')
    const result = await runQuery<{ id: string; name: string }>('MATCH (u:User) RETURN u.id AS id, u.name AS name')

    // Assert
    expect(result).toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])
    expect(mockRun).toHaveBeenCalledWith(
      'MATCH (u:User) RETURN u.id AS id, u.name AS name',
      {}
    )
  })

  it('passes parameters to the query', async () => {
    mockRun.mockResolvedValueOnce({ records: [] })

    const { runQuery } = await import('@/lib/neo4j')
    await runQuery('MATCH (u:User {id: $id}) RETURN u', { id: 'abc-123' })

    expect(mockRun).toHaveBeenCalledWith(
      'MATCH (u:User {id: $id}) RETURN u',
      { id: 'abc-123' }
    )
  })

  it('returns an empty array when the query yields no records', async () => {
    mockRun.mockResolvedValueOnce({ records: [] })

    const { runQuery } = await import('@/lib/neo4j')
    const result = await runQuery('RETURN 1 AS ok')

    expect(result).toEqual([])
  })

  it('always closes the session even when the query throws', async () => {
    mockRun.mockRejectedValueOnce(new Error('DB error'))

    const { runQuery } = await import('@/lib/neo4j')
    await expect(runQuery('BAD QUERY')).rejects.toThrow('DB error')
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('throws when NEO4J_URI is missing', async () => {
    const saved = process.env.NEO4J_URI
    delete process.env.NEO4J_URI

    let runQueryIsolated!: (q: string) => Promise<unknown[]>
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      runQueryIsolated = require('@/lib/neo4j').runQuery
    })

    await expect(runQueryIsolated('RETURN 1')).rejects.toThrow('Missing Neo4j environment variables')
    process.env.NEO4J_URI = saved
  })

  it('throws when NEO4J_USER is missing', async () => {
    const saved = process.env.NEO4J_USER
    delete process.env.NEO4J_USER

    let runQueryIsolated!: (q: string) => Promise<unknown[]>
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      runQueryIsolated = require('@/lib/neo4j').runQuery
    })

    await expect(runQueryIsolated('RETURN 1')).rejects.toThrow('Missing Neo4j environment variables')
    process.env.NEO4J_USER = saved
  })

  it('throws when NEO4J_PASSWORD is missing', async () => {
    const saved = process.env.NEO4J_PASSWORD
    delete process.env.NEO4J_PASSWORD

    let runQueryIsolated!: (q: string) => Promise<unknown[]>
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      runQueryIsolated = require('@/lib/neo4j').runQuery
    })

    await expect(runQueryIsolated('RETURN 1')).rejects.toThrow('Missing Neo4j environment variables')
    process.env.NEO4J_PASSWORD = saved
  })
})
