import neo4j, { Driver } from 'neo4j-driver'

// Singleton driver — lazily initialized on first use so that
// module evaluation during `next build` does not require env vars.
// Env vars are only available at runtime (request time), not build time.
let _driver: Driver | null = null

function getDriver(): Driver {
  if (_driver) return _driver

  // Validate at first use (request time), not at module load (build time)
  const uri = process.env.NEO4J_URI
  const user = process.env.NEO4J_USER
  const password = process.env.NEO4J_PASSWORD

  if (!uri || !user || !password) {
    throw new Error(
      'Missing Neo4j environment variables. ' +
      'Ensure NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD are set.'
    )
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  return _driver
}

export { getDriver as driver }

/**
 * Execute a parameterized Cypher query and return the results as plain objects.
 *
 * @param cypher - A parameterized Cypher query string. Never interpolate user input.
 * @param params - Named parameters referenced in the Cypher query.
 * @returns An array of plain JavaScript objects, one per result record.
 */
export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = getDriver().session()
  try {
    const result = await session.run(cypher, params)
    // Map each record to a plain object for easy consumption
    return result.records.map((record) => record.toObject() as T)
  } finally {
    // Always close the session to return it to the connection pool
    await session.close()
  }
}
