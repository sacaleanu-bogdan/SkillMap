import { NextResponse } from 'next/server'
import { runQuery } from '@/lib/neo4j'

// GET /api/health
// Smoke-tests the Neo4j connection by running a trivial query.
// Returns { ok: true, neo4j: [{ ok: 1 }] } on success.
export async function GET() {
  try {
    const result = await runQuery<{ ok: number }>('RETURN 1 AS ok')
    return NextResponse.json({ ok: true, neo4j: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 503 }
    )
  }
}
