import { NextResponse } from 'next/server'

/**
 * Returns true if the error is a Neo4j uniqueness constraint violation.
 * Used to convert ConstraintValidationFailed into HTTP 409 instead of 500.
 */
export function isConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === 'Neo.ClientError.Schema.ConstraintValidationFailed'
  )
}

/**
 * Logs the error server-side and returns a safe generic 500 response.
 * Never exposes internal driver messages to clients.
 */
export function apiError(error: unknown, status = 500): NextResponse {
  console.error('[API Error]', error)
  return NextResponse.json({ error: 'Internal server error' }, { status })
}
