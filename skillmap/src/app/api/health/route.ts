import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'

// GET /api/health
// Smoke-tests the Neo4j connection. Requires authentication to prevent tech-stack
// fingerprinting by unauthenticated callers. (VULN-006)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await runQuery('RETURN 1 AS ok')
    // Return only up/down status — never echo raw DB result back to callers
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[API Health] Neo4j connectivity error:', error)
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
