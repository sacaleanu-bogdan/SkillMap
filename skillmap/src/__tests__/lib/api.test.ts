import { isConstraintError, apiError } from '@/lib/api'

// ─── isConstraintError ────────────────────────────────────────────────────────

describe('isConstraintError', () => {
  // Happy paths — correct Neo4j constraint code
  it('returns true for an object with the constraint violation code', () => {
    const err = { code: 'Neo.ClientError.Schema.ConstraintValidationFailed' }
    expect(isConstraintError(err)).toBe(true)
  })

  // Unhappy paths
  it('returns false for null', () => {
    expect(isConstraintError(null)).toBe(false)
  })

  it('returns false for a plain string', () => {
    expect(isConstraintError('error string')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isConstraintError(42)).toBe(false)
  })

  it('returns false for an Error instance (no .code property)', () => {
    expect(isConstraintError(new Error('oops'))).toBe(false)
  })

  it('returns false for an object with a different error code', () => {
    expect(isConstraintError({ code: 'Neo.ClientError.Schema.SomethingElse' })).toBe(false)
  })

  it('returns false for an object without a code property', () => {
    expect(isConstraintError({ message: 'no code here' })).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isConstraintError(undefined)).toBe(false)
  })

  it('returns false for an empty object', () => {
    expect(isConstraintError({})).toBe(false)
  })
})

// ─── apiError ────────────────────────────────────────────────────────────────

describe('apiError', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    // Suppress error output during tests while still verifying it was called
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('returns a NextResponse with status 500 by default', async () => {
    const response = apiError(new Error('oops'))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: 'Internal server error' })
  })

  it('returns a NextResponse with a custom status when provided', async () => {
    const response = apiError(new Error('db down'), 503)
    expect(response.status).toBe(503)
  })

  it('always returns the safe generic message — never leaks the original error', async () => {
    const response = apiError(new Error('secret db details'))
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
    expect(body.error).not.toContain('secret db details')
  })

  it('calls console.error with the original error', () => {
    const original = new Error('original message')
    apiError(original)
    expect(consoleSpy).toHaveBeenCalledWith('[API Error]', original)
  })

  it('handles non-Error values (strings, objects, null)', async () => {
    apiError('string error')
    apiError({ code: 500 })
    apiError(null)
    expect(consoleSpy).toHaveBeenCalledTimes(3)
  })
})
